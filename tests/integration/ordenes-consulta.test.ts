import { afterAll, beforeAll, expect, it } from "vitest";
import { esquemaConsultaOrdenes } from "@/modules/ordenes/schema";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearOrden, invocar, leerOrden, ponerEstado, prepararOrdenes, type EntornoOrdenes } from "./ordenes-ayudas";

const CAMPOS_DINERO = /^(precioUnitario|importe|subtotal|descuento|impuesto|total|costo\w*|margen\w*|tasaImpuesto)$/i;
function comprobarSinDinero(valor: unknown): void {
  if (!valor || typeof valor !== "object") return;
  for (const [clave, contenido] of Object.entries(valor)) {
    expect(clave).not.toMatch(CAMPOS_DINERO);
    comprobarSinDinero(contenido);
  }
}

describeConBase("órdenes: DTO, lista y opciones", () => {
  const db = crearClientePropietario();
  let entorno: EntornoOrdenes;
  beforeAll(async () => { entorno = await prepararOrdenes(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("Producción recibe lista blanca sin dinero ni datos restringidos del cliente", async () => {
    const orden = await crearOrden(entorno);
    await db.cliente.update({ where: { id: orden.cliente.id }, data: { ruc: `ORD${Date.now()}`, direccion: "Dirección reservada" } });
    await db.bitacora.create({ data: { entidad: "ORDEN_TRABAJO", entidadId: orden.id, ordenId: orden.id,
      accion: "EDITAR", usuarioId: entorno.sesiones.VENTAS.usuarioId,
      detalle: { total: "999.99", costoTotal: "200", items: [{ precioUnitario: "30", margenPct: "35" }],
        cambios: { importe: { anterior: "100", nuevo: "500" } }, motivo: "Motivo visible" } } });
    const ficha = await entorno.modulos.servicio.obtenerOrden(orden.id, entorno.sesiones.PRODUCCION.actor);
    comprobarSinDinero(ficha);
    expect(ficha.cliente).not.toHaveProperty("ruc");
    expect(ficha.cliente).not.toHaveProperty("direccion");
    expect(ficha.cliente).toMatchObject({ nombre: orden.cliente.nombre, tipo: "EMPRESA", telefono: "8888 0101" });
    expect(ficha.items[2].lineas[0].cantidad).toBe("5.000");
    expect(ficha.consumosEstimados[0].cantidad).toBe("9.409");
    expect(ficha.eventos.find((evento) => evento.accion === "EDITAR")?.detalle).toEqual({ motivo: "Motivo visible" });
    expect(ficha.eventos[0]).toMatchObject({ accion: expect.any(String), actor: expect.any(String), creadoEn: expect.any(String) });
    const ventas = await leerOrden(entorno, orden.id);
    expect(ventas.cotizacion.total).toBeTruthy();
    expect(ventas.items[2].lineas[0].costoUnitario).toBe("2850.0000");
    expect(ventas.cliente.direccion).toBe("Dirección reservada");
    expect(ventas.eventos.find((evento) => evento.accion === "EDITAR")?.detalle).toHaveProperty("total", "999.99");
  });

  it("la API de Producción también oculta dinero al entregar y consultar", async () => {
    const inicial = await crearOrden(entorno);
    await ponerEstado(db, inicial.id, "LISTA");
    const orden = await leerOrden(entorno, inicial.id);
    const respuesta = await invocar(entorno.modulos.entregar.POST, peticion("POST", `/api/v1/ordenes/${orden.id}/entregar`, {
      cookie: entorno.sesiones.PRODUCCION.cookie, cuerpo: { version: orden.actualizadoEn },
    }), orden.id);
    expect(respuesta.status).toBe(200);
    comprobarSinDinero(respuesta.datos);
    const consulta = await invocar(entorno.modulos.ficha.GET, peticion("GET", `/api/v1/ordenes/${orden.id}`, { cookie: entorno.sesiones.PRODUCCION.cookie }), orden.id);
    expect(consulta.status).toBe(200);
    comprobarSinDinero(consulta.datos);
  });

  it("la lista pagina, filtra por estado, cliente, responsable y texto", async () => {
    const ordenes = await Promise.all([crearOrden(entorno), crearOrden(entorno), crearOrden(entorno)]);
    const actor = entorno.sesiones.PRODUCCION.actor;
    const consulta = esquemaConsultaOrdenes.parse({ cliente: entorno.cotizaciones.referencias.cliente.id, porPagina: 2 });
    const primera = await entorno.modulos.servicio.listarOrdenes(consulta, actor);
    expect(primera.datos).toHaveLength(2);
    expect(primera.total).toBeGreaterThanOrEqual(3);
    const segunda = await entorno.modulos.servicio.listarOrdenes({ ...consulta, pagina: 2 }, actor);
    expect(primera.datos.every((fila) => !segunda.datos.some((otra) => otra.id === fila.id))).toBe(true);
    const individual = await entorno.modulos.servicio.listarOrdenes(esquemaConsultaOrdenes.parse({
      q: ordenes[0].numero, estado: "PENDIENTE", responsable: ordenes[0].responsable.id, cliente: ordenes[0].cliente.id,
    }), actor);
    expect(individual.datos.map((fila) => fila.id)).toEqual([ordenes[0].id]);
    comprobarSinDinero(individual.datos);
  });

  it("vencidas incluye solo fechas pasadas de órdenes no terminales", async () => {
    const pendiente = await crearOrden(entorno);
    const entregada = await crearOrden(entorno);
    await db.ordenTrabajo.updateMany({ where: { id: { in: [pendiente.id, entregada.id] } }, data: { fechaEntrega: new Date("2000-01-01") } });
    await ponerEstado(db, entregada.id, "ENTREGADA");
    const lista = await entorno.modulos.servicio.listarOrdenes(esquemaConsultaOrdenes.parse({
      vencidas: "true", terminales: "todas", cliente: pendiente.cliente.id,
    }), entorno.sesiones.PRODUCCION.actor);
    expect(lista.datos.map((fila) => fila.id)).toContain(pendiente.id);
    expect(lista.datos.map((fila) => fila.id)).not.toContain(entregada.id);
    expect(lista.datos.every((fila) => fila.atrasada)).toBe(true);
  });

  it("terminales separa entregadas, cerradas y canceladas", async () => {
    const inicial = await crearOrden(entorno);
    await ponerEstado(db, inicial.id, "CANCELADA");
    const actor = entorno.sesiones.VENTAS.actor;
    const terminal = await entorno.modulos.servicio.listarOrdenes(esquemaConsultaOrdenes.parse({ q: inicial.numero, terminales: "true" }), actor);
    expect(terminal.datos.map((fila) => fila.id)).toEqual([inicial.id]);
    expect(terminal.datos[0].atrasada).toBe(false);
    const activas = await entorno.modulos.servicio.listarOrdenes(esquemaConsultaOrdenes.parse({ q: inicial.numero }), actor);
    expect(activas.total).toBe(0);
  });

  it("escapa comodines y busca el nombre del cliente y el asunto", async () => {
    const orden = await crearOrden(entorno);
    const original = orden.cliente.nombre;
    await db.cliente.update({ where: { id: orden.cliente.id }, data: { nombre: `Cliente_100% ${orden.id}` } });
    try {
      const consulta = esquemaConsultaOrdenes.parse({ cliente: orden.cliente.id, q: "Cliente_100%" });
      expect((await entorno.modulos.servicio.listarOrdenes(consulta, entorno.sesiones.VENTAS.actor)).total).toBeGreaterThan(0);
      expect((await entorno.modulos.servicio.listarOrdenes({ ...consulta, q: "ClienteX100Y" }, entorno.sesiones.VENTAS.actor)).total).toBe(0);
      const asunto = await entorno.modulos.servicio.listarOrdenes(esquemaConsultaOrdenes.parse({ q: orden.cotizacion.asunto! }), entorno.sesiones.VENTAS.actor);
      expect(asunto.datos.map((fila) => fila.id)).toContain(orden.id);
    } finally { await db.cliente.update({ where: { id: orden.cliente.id }, data: { nombre: original } }); }
  });

  it("opciones enumera responsables activos y categorías con conteo de etapas activas", async () => {
    const opciones = await entorno.modulos.servicio.opcionesOrden(entorno.sesiones.GERENCIA.actor);
    expect(opciones.responsables.map((responsable) => responsable.id)).toContain(entorno.sesiones.PRODUCCION.usuarioId);
    expect(opciones.responsables.map((responsable) => responsable.id)).not.toContain(entorno.sesiones.VENTAS.usuarioId);
    expect(opciones.categorias.find((categoria) => categoria.id === entorno.cotizaciones.referencias.categoria.id)?.etapas).toBe(2);
    comprobarSinDinero(opciones);
  });

  it("los permisos se deciden en el servidor para lecturas y escrituras del servicio", async () => {
    const orden = await crearOrden(entorno);
    await expect(entorno.modulos.servicio.obtenerOrden(orden.id, entorno.sesiones.ADMIN.actor)).rejects.toMatchObject({ status: 403 });
    await expect(entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn }, entorno.sesiones.PRODUCCION.actor)).rejects.toMatchObject({ status: 403 });
    await expect(entorno.modulos.servicio.cancelarOrden(orden.id, { version: orden.actualizadoEn, motivo: "Cancelación prohibida" }, entorno.sesiones.VENTAS.actor))
      .rejects.toMatchObject({ status: 403 });
    expect(await leerOrden(entorno, orden.id)).toEqual(orden);
  });
});
