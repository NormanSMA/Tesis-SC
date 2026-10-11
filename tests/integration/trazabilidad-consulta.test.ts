import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { esquemaConsultaBitacora } from "@/modules/trazabilidad/schema";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearTrabajo, prepararTrazabilidad, type EntornoTrazabilidad } from "./trazabilidad-ayudas";

describeConBase("trazabilidad: consultas vinculadas", () => {
  const db = crearClientePropietario();
  let entorno: EntornoTrazabilidad;
  beforeAll(async () => { entorno = await prepararTrazabilidad(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("lee historial propio cronológicamente, con actor, fecha y desempate por id", async () => {
    const orden = await crearTrabajo(entorno);
    const ids: string[] = [randomUUID(), randomUUID()].sort();
    const tardio = randomUUID();
    const usuario = entorno.sesiones.OPERACIONES.actor;
    const etapa = orden.etapas[0];
    const base = { ordenId: orden.id, etapaId: etapa.id, usuarioId: usuario.id,
      estadoAnterior: "PENDIENTE" as const, estadoNuevo: "PENDIENTE" as const,
      responsableId: entorno.sesiones.PRODUCCION.usuarioId };
    for (const [id, fecha] of [[tardio, "2000-01-03T00:00:00Z"],
      [ids[1], "2000-01-01T00:00:00Z"], [ids[0], "2000-01-01T00:00:00Z"]]) {
      await db.historialEtapa.create({ data: { ...base, id, creadoEn: new Date(fecha) } });
    }
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.GERENCIA.actor);
    const historial = traza.cadena.historialEtapas!;
    expect(historial.slice(0, 3).map((fila) => fila.id)).toEqual([...ids, tardio]);
    expect(historial.map((fila) => `${fila.creadoEn}:${fila.id}`))
      .toEqual(historial.map((fila) => `${fila.creadoEn}:${fila.id}`).sort());
    expect(historial[0]).toMatchObject({ ordenId: orden.id, etapa: { id: etapa.id, nombre: etapa.nombre },
      usuario: { id: usuario.id, nombre: usuario.nombre }, estadoAnterior: "Pendiente", estadoNuevo: "Pendiente",
      responsable: { id: entorno.sesiones.PRODUCCION.usuarioId }, creadoEn: "2000-01-01T00:00:00.000Z" });
    expect(traza.eventos.some((evento) => [...ids, tardio].includes(evento.id))).toBe(false);
  });

  it("consulta una orden sin responsable y conserva los usuarios que intervinieron", async () => {
    const { crearOrden } = await import("./ordenes-ayudas");
    const orden = await crearOrden(entorno.produccion.ordenes, { responsableId: null });
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.GERENCIA.actor);
    expect(traza.cadena.orden.responsable).toBeNull();
    expect(traza.responsables.find((fila) => fila.id === entorno.sesiones.OPERACIONES.usuarioId)?.roles).toContain("Creó la orden");
    expect(traza.responsables.some((fila) => fila.roles.includes("Responsable de orden"))).toBe(false);
  });

  it("pagina de forma estable, descendente y sin duplicados", async () => {
    const orden = await crearTrabajo(entorno);
    const actor = entorno.sesiones.GERENCIA.actor;
    const consulta = esquemaConsultaBitacora.parse({ orden: orden.numero, porPagina: 2 });
    const primera = await entorno.servicio.listarBitacora(consulta, actor);
    const segunda = await entorno.servicio.listarBitacora({ ...consulta, pagina: 2 }, actor);
    const todos = await entorno.servicio.listarBitacora({ ...consulta, porPagina: 100 }, actor);
    expect(primera.datos).toHaveLength(2); expect(segunda.datos).toHaveLength(2);
    expect(primera.total).toBe(todos.datos.length);
    expect([...primera.datos, ...segunda.datos].map((evento) => evento.id)).toEqual(todos.datos.slice(0, 4).map((evento) => evento.id));
    expect(todos.datos.map((evento) => `${evento.creadoEn}:${evento.id}`)).toEqual(todos.datos.map((evento) => `${evento.creadoEn}:${evento.id}`).sort().reverse());
  });
  it("combina entidad, acción, usuario, orden y cotización", async () => {
    const orden = await crearTrabajo(entorno);
    const lista = await entorno.servicio.listarBitacora(esquemaConsultaBitacora.parse({ orden: orden.numero,
      cotizacion: orden.cotizacion.numero, entidad: "ETAPA_ORDEN", accion: "ASIGNAR_RESPONSABLE",
      usuario: entorno.sesiones.OPERACIONES.usuarioId }), entorno.sesiones.GERENCIA.actor);
    expect(lista.total).toBe(1); expect(lista.datos[0].accion).toBe("Asignó el responsable");
    expect(lista.datos[0].registro.href).toBe(`/trazabilidad/ordenes/${orden.id}`);
    expect(lista.datos[0].resumen).toContain(entorno.sesiones.OPERACIONES.actor.nombre);
  });
  it("incluye límites del día local y excluye días vecinos", async () => {
    const orden = await crearTrabajo(entorno);
    const fechas = ["2001-01-02T05:59:59.999Z", "2001-01-02T06:00:00.000Z", "2001-01-03T05:59:59.999Z", "2001-01-03T06:00:00.000Z"];
    const eventos = await Promise.all(fechas.map((fecha) => db.bitacora.create({ data: { entidad: "ORDEN_TRABAJO", entidadId: orden.id,
      ordenId: orden.id, accion: "EDITAR", usuarioId: entorno.sesiones.OPERACIONES.usuarioId, creadoEn: new Date(fecha) } })));
    const lista = await entorno.servicio.listarBitacora(esquemaConsultaBitacora.parse({ orden: orden.numero, desde: "2001-01-02", hasta: "2001-01-02" }), entorno.sesiones.GERENCIA.actor);
    expect(lista.datos.map((evento) => evento.id)).toEqual([eventos[2].id, eventos[1].id]);
  });
  it("busca números, asunto, nombres vinculados y comodines literales", async () => {
    const orden = await crearTrabajo(entorno);
    await db.cliente.update({ where: { id: orden.cliente.id }, data: { nombre: `Tra_100% ${orden.id}` } });
    try {
      for (const texto of [orden.numero, orden.cotizacion.numero, orden.cotizacion.asunto!, "Tra_100%", entorno.sesiones.ATENCION_CLIENTE.actor.nombre]) {
        const lista = await entorno.servicio.listarBitacora(esquemaConsultaBitacora.parse({ texto, orden: orden.numero }), entorno.sesiones.GERENCIA.actor);
        expect(lista.total).toBeGreaterThan(0);
      }
      const vacia = await entorno.servicio.listarBitacora(esquemaConsultaBitacora.parse({ texto: "TraX100Y", orden: orden.numero }), entorno.sesiones.GERENCIA.actor);
      expect(vacia.total).toBe(0);
    } finally { await db.cliente.update({ where: { id: orden.cliente.id }, data: { nombre: orden.cliente.nombre } }); }
  });
  it("busca registros de cliente, material, producto, categoría y área", async () => {
    const referencias = entorno.produccion.ordenes.cotizaciones.referencias;
    for (const [entidad, fila] of [["CLIENTE", referencias.cliente], ["MATERIAL", referencias.material],
      ["PRODUCTO", referencias.unidad], ["CATEGORIA", referencias.categoria]] as const) {
      const perfil = entidad === "CLIENTE" ? "ATENCION_CLIENTE" : entidad === "MATERIAL" ? "ADMINISTRACION" : "OPERACIONES";
      const evento = await db.bitacora.create({ data: { entidad, entidadId: fila.id, usuarioId: entorno.sesiones[perfil].usuarioId,
        accion: "CREAR", detalle: { nombre: fila.nombre } } });
      const lista = await entorno.servicio.listarBitacora(esquemaConsultaBitacora.parse({ texto: fila.nombre, entidad }), entorno.sesiones.GERENCIA.actor);
      expect(lista.datos.map((fila) => fila.id)).toContain(evento.id);
      expect(lista.datos.find((fila) => fila.id === evento.id)?.registro.nombre).toBe(fila.nombre);
    }
    const area = await db.area.create({ data: { nombre: `Área trazabilidad ${Date.now()}` } });
    await db.bitacora.create({ data: { entidad: "AREA", entidadId: area.id, accion: "CREAR", usuarioId: entorno.sesiones.OPERACIONES.usuarioId } });
    const lista = await entorno.servicio.listarBitacora(esquemaConsultaBitacora.parse({ texto: area.nombre, entidad: "AREA" }), entorno.sesiones.GERENCIA.actor);
    expect(lista.datos[0].registro).toEqual({ nombre: area.nombre, href: null });
  });
  it("unifica todos los eventos por cotización u orden, una vez y con desempate por id", async () => {
    const orden = await crearTrabajo(entorno);
    const fecha = new Date("2000-01-01T00:00:00Z");
    const ids = ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000001"];
    for (const id of ids) await db.bitacora.create({ data: { id, entidad: "ORDEN_TRABAJO", entidadId: orden.id, ordenId: orden.id,
      cotizacionId: orden.cotizacion.id, accion: "EDITAR", usuarioId: entorno.sesiones.OPERACIONES.usuarioId, creadoEn: fecha } });
    const esperados = await db.bitacora.findMany({ where: { OR: [{ ordenId: orden.id }, { cotizacionId: orden.cotizacion.id }] }, orderBy: [{ creadoEn: "asc" }, { id: "asc" }] });
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.GERENCIA.actor);
    expect(traza.eventos.map((evento) => evento.id)).toEqual(esperados.map((evento) => evento.id));
    expect(traza.eventos.slice(0, 2).map((evento) => evento.id)).toEqual([...ids].reverse());
    expect(traza.eventos.some((evento) => evento.entidad === "Cotización")).toBe(true);
    expect(traza.eventos.some((evento) => evento.entidad === "Etapa de producción")).toBe(true);
    expect(traza.cadena.cotizacion).toMatchObject({ id: orden.cotizacion.id, estado: "Aprobada", fechaEmision: expect.any(String) });
  });
  it("resuelve números de orden y cotización incluyendo registros archivados", async () => {
    const orden = await crearTrabajo(entorno);
    await db.cotizacion.update({ where: { id: orden.cotizacion.id }, data: { archivada: true } });
    for (const numero of [orden.numero, orden.cotizacion.numero.toLowerCase()]) {
      expect(await entorno.servicio.buscarOrdenPorNumero(numero, entorno.sesiones.GERENCIA.actor)).toEqual({ id: orden.id, numero: orden.numero });
    }
    expect(await entorno.servicio.buscarOrdenPorNumero("OT-0000-0000", entorno.sesiones.GERENCIA.actor)).toBeNull();
  });
  it("enumera usuarios que intervinieron y exige permisos del servicio", async () => {
    const orden = await crearTrabajo(entorno);
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.GERENCIA.actor);
    expect(traza.responsables.find((fila) => fila.id === entorno.sesiones.PRODUCCION.usuarioId)?.roles).toContain("Responsable de orden");
    expect(traza.responsables.find((fila) => fila.id === entorno.sesiones.OPERACIONES.usuarioId)?.roles).toContain("Creó la orden");
    expect((await entorno.servicio.opcionesBitacora(entorno.sesiones.ADMIN.actor)).map((fila) => fila.id)).toContain(entorno.sesiones.ATENCION_CLIENTE.usuarioId);
    await expect(entorno.servicio.listarBitacora(esquemaConsultaBitacora.parse({}), entorno.sesiones.ATENCION_CLIENTE.actor)).rejects.toMatchObject({ status: 403 });
    await expect(entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.ADMIN.actor)).rejects.toMatchObject({ status: 403 });
    await expect(entorno.servicio.buscarOrdenPorNumero(orden.numero, entorno.sesiones.ADMIN.actor)).rejects.toMatchObject({ status: 403 });
  });

  it("conserva el payload de eventos vinculados con filtros SQL", async () => {
    const orden = await crearTrabajo(entorno);
    const { consultarGlobal, incluirEventos } = await import("@/modules/trazabilidad/repo");
    const esperados = await db.bitacora.findMany({
      where: { OR: [{ ordenId: orden.id }, { cotizacion: { orden: { id: orden.id } } }] },
      include: incluirEventos, orderBy: [{ creadoEn: "desc" }, { id: "desc" }], take: 100,
    });
    for (const texto of [undefined, orden.numero]) {
      const resultado = await consultarGlobal(db, esquemaConsultaBitacora.parse({ orden: orden.numero, texto, porPagina: 100 }));
      expect(resultado).toEqual({ eventos: esperados, total: esperados.length });
    }
  });

  it("pagina coincidencias de texto sin recortar los registros buscados", async () => {
    const texto = `Tra\\_100% ${randomUUID()}`;
    const materiales = Array.from({ length: 105 }, (_, indice) => ({ id: randomUUID(),
      codigo: `TR-${texto.slice(-16)}-${indice}`, nombre: `${texto} ${indice}`, unidad: "UNIDAD" as const,
      activo: indice !== 104 }));
    await db.material.createMany({ data: materiales });
    const eventos = materiales.map((material) => ({ id: randomUUID(), entidad: "MATERIAL" as const,
      entidadId: material.id, accion: "CREAR" as const, usuarioId: entorno.sesiones.ADMINISTRACION.usuarioId,
      creadoEn: new Date("2000-01-01T00:00:00Z") }));
    await db.bitacora.createMany({ data: eventos });
    const consulta = esquemaConsultaBitacora.parse({ texto, entidad: "MATERIAL", porPagina: 100 });
    const actor = entorno.sesiones.GERENCIA.actor;
    const primera = await entorno.servicio.listarBitacora(consulta, actor);
    const segunda = await entorno.servicio.listarBitacora({ ...consulta, pagina: 2 }, actor);
    expect(primera.total).toBe(105); expect(segunda.total).toBe(105);
    expect(primera.datos).toHaveLength(100); expect(segunda.datos).toHaveLength(5);
    const lista = [...primera.datos, ...segunda.datos];
    expect(lista.map((evento) => evento.id)).toEqual(eventos.map((evento) => evento.id).sort().reverse());
    for (const evento of lista) {
      expect(evento.registro.nombre).toBe(materiales.find((material) => material.id === evento.entidadId)!.nombre);
    }
    expect((await entorno.servicio.listarBitacora({ ...consulta, pagina: 3 }, actor)).datos).toEqual([]);
  });

  it("conserva eventos, historial y etapas completos al superar un lote", async () => {
    const orden = await crearTrabajo(entorno);
    const creadoEn = new Date("2000-01-01T00:00:00Z");
    const usuarioId = entorno.sesiones.OPERACIONES.usuarioId;
    const eventos = Array.from({ length: 105 }, () => ({ id: randomUUID(), entidad: "ORDEN_TRABAJO" as const,
      entidadId: orden.id, ordenId: orden.id, cotizacionId: orden.cotizacion.id,
      accion: "EDITAR" as const, usuarioId, creadoEn }));
    const historial = Array.from({ length: 105 }, () => ({ id: randomUUID(), ordenId: orden.id,
      etapaId: orden.etapas[0].id, usuarioId, estadoAnterior: "PENDIENTE" as const,
      estadoNuevo: "PENDIENTE" as const, creadoEn }));
    const etapas = Array.from({ length: 105 }, (_, indice) => ({ id: randomUUID(), ordenId: orden.id,
      areaId: orden.etapas[0].area.id, secuencia: 1000 + indice, nombre: `Etapa ${indice}` }));
    await db.bitacora.createMany({ data: eventos });
    await db.historialEtapa.createMany({ data: historial });
    await db.etapaOrden.createMany({ data: etapas });
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.GERENCIA.actor);
    expect(traza.eventos.slice(0, 105).map((evento) => evento.id)).toEqual(eventos.map((evento) => evento.id).sort());
    expect(traza.cadena.historialEtapas!.slice(0, 105).map((fila) => fila.id)).toEqual(historial.map((fila) => fila.id).sort());
    expect(traza.cadena.etapas.filter((etapa) => etapa.secuencia >= 1000).map((etapa) => etapa.id))
      .toEqual(etapas.map((etapa) => etapa.id));
    expect(new Set(traza.eventos.map((evento) => evento.id)).size).toBe(traza.eventos.length);
    expect(new Set(traza.cadena.historialEtapas!.map((fila) => fila.id)).size).toBe(traza.cadena.historialEtapas!.length);
  });
});
