import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PerfilCodigo, Permiso } from "@/core/permisos";
import type { PrismaClient } from "@/generated/prisma/client";
import type { RutaHandler } from "@/lib/http";
import type { EtapaTablero } from "@/modules/produccion/tipos";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion, conPermisoRevocado } from "./cotizaciones-ayudas";
import { invocar, leerOrden, ponerEstado } from "./ordenes-ayudas";
import { asignarEtapa, crearAreaLibre, nuevaOrden, prepararLista, prepararProduccion, type EntornoProduccion } from "./produccion-ayudas";

const LECTURAS = ["tablero", "opciones", "verEtapas", "listarAreas", "listarPlantillas"] as const;
const PLANIFICACION = ["agregarEtapa", "editarEtapa", "omitir", "restaurar"] as const;
const EJECUCION = ["iniciar", "completar"] as const;
const AVANCE = ["lista", "retrabajo"] as const;
const CATALOGO = ["crearArea", "editarArea", "archivarArea", "reactivarArea", "crearPlantilla", "editarPlantilla", "archivarPlantilla"] as const;
const OPERACIONES = [...LECTURAS, ...PLANIFICACION, ...EJECUCION, ...AVANCE, ...CATALOGO];
type Operacion = typeof OPERACIONES[number];
type Llamada = { manejador: RutaHandler; metodo: "GET" | "POST" | "PATCH"; ruta: string; id?: string; cuerpo?: Record<string, unknown> };
const PERMISOS: Record<PermisoGrupo, readonly Operacion[]> = { "produccion:ver": LECTURAS,
  "produccion:planificar": PLANIFICACION, "produccion:ejecutar": EJECUCION, "orden:avanzar": AVANCE, "catalogo:gestionar": CATALOGO };
type PermisoGrupo = "produccion:ver" | "produccion:planificar" | "produccion:ejecutar" | "orden:avanzar" | "catalogo:gestionar";
const PERFILES_POR_PERMISO: Record<PermisoGrupo, readonly PerfilCodigo[]> = {
  "produccion:ver": ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION"],
  "produccion:planificar": ["ADMINISTRACION", "OPERACIONES"],
  "produccion:ejecutar": ["ADMINISTRACION", "PRODUCCION"],
  "orden:avanzar": ["ADMINISTRACION", "OPERACIONES", "PRODUCCION"],
  "catalogo:gestionar": ["OPERACIONES"],
};
let entorno: EntornoProduccion;
let db: PrismaClient;

function cookie(perfil: PerfilCodigo) { return entorno.ordenes.sesiones[perfil].cookie; }
function autorizado(operacion: Operacion, perfil: PerfilCodigo) {
  return (Object.keys(PERMISOS) as PermisoGrupo[]).some((permiso) =>
    PERMISOS[permiso].includes(operacion) && PERFILES_POR_PERMISO[permiso].includes(perfil));
}
function perfilAutorizado(operacion: Operacion): PerfilCodigo {
  return ([...PLANIFICACION, ...CATALOGO] as readonly Operacion[]).includes(operacion) ? "OPERACIONES" : "PRODUCCION";
}
function statusExito(operacion: Operacion) {
  return ["agregarEtapa", "crearArea", "crearPlantilla"].includes(operacion) ? 201 : 200;
}
function ejecutar(llamada: Llamada, sesion?: string) {
  return invocar(llamada.manejador, peticion(llamada.metodo, llamada.ruta, { cookie: sesion, cuerpo: llamada.cuerpo }), llamada.id);
}

async function prepararLectura(operacion: Operacion): Promise<Llamada> {
  const { rutas } = entorno;
  if (operacion === "tablero") return { manejador: rutas.tablero.GET, metodo: "GET", ruta: "/api/v1/produccion/tablero" };
  if (operacion === "opciones") return { manejador: rutas.opciones.GET, metodo: "GET", ruta: "/api/v1/produccion/opciones" };
  if (operacion === "listarAreas") return { manejador: rutas.areas.GET, metodo: "GET", ruta: "/api/v1/areas" };
  if (operacion === "listarPlantillas") {
    const id = entorno.ordenes.cotizaciones.referencias.categoria.id;
    return { manejador: rutas.plantillas.GET, metodo: "GET", ruta: `/api/v1/categorias/${id}/plantillas`, id };
  }
  const orden = await nuevaOrden(entorno);
  return { manejador: rutas.etapas.GET, metodo: "GET", ruta: `/api/v1/ordenes/${orden.id}/etapas`, id: orden.id };
}

async function prepararEtapa(operacion: Operacion): Promise<Llamada> {
  const orden = await nuevaOrden(entorno);
  let etapa = orden.etapas[0];
  if (operacion === "agregarEtapa") return { manejador: entorno.rutas.etapas.POST, metodo: "POST", id: orden.id,
    ruta: `/api/v1/ordenes/${orden.id}/etapas`, cuerpo: { areaId: etapa.area.id, nombre: "Etapa API" } };
  if (operacion === "iniciar" || operacion === "completar") etapa = await asignarEtapa(entorno, etapa);
  if (operacion === "completar") etapa = await entorno.servicio.iniciarEtapa(etapa.id, { version: etapa.actualizadoEn }, entorno.actor);
  if (operacion === "restaurar") etapa = await entorno.servicio.omitirEtapa(etapa.id, { version: etapa.actualizadoEn, motivo: "Omisión API" }, entorno.planificador);
  if (operacion === "editarEtapa") return { manejador: entorno.rutas.etapa.PATCH, metodo: "PATCH", id: etapa.id,
    ruta: `/api/v1/etapas/${etapa.id}`, cuerpo: { version: etapa.actualizadoEn, responsableId: entorno.actor.id } };
  const accion = operacion as "iniciar" | "completar" | "omitir" | "restaurar";
  return { manejador: entorno.rutas[accion].POST, metodo: "POST", id: etapa.id, ruta: `/api/v1/etapas/${etapa.id}/${accion}`,
    cuerpo: { version: etapa.actualizadoEn, ...(accion === "omitir" && { motivo: "Omisión API" }) } };
}

async function prepararAvance(operacion: "lista" | "retrabajo"): Promise<Llamada> {
  let orden = await prepararLista(entorno);
  if (operacion === "retrabajo") orden = await entorno.servicio.marcarLista(orden.id, { version: orden.actualizadoEn }, entorno.actor);
  return { manejador: entorno.rutas[operacion].POST, metodo: "POST", id: orden.id, ruta: `/api/v1/ordenes/${orden.id}/${operacion}`,
    cuerpo: { version: orden.actualizadoEn, ...(operacion === "retrabajo" && {
      motivo: "Corrección API", areaId: orden.etapas[0].area.id, nombre: "Retrabajo API" }) } };
}

async function prepararArea(operacion: Operacion): Promise<Llamada> {
  if (operacion === "crearArea") return { manejador: entorno.rutas.areas.POST, metodo: "POST", ruta: "/api/v1/areas",
    cuerpo: { nombre: `Área API ${randomUUID().slice(0, 8)}` } };
  let area = await crearAreaLibre(entorno);
  if (operacion === "reactivarArea") area = await entorno.servicio.archivarArea(area.id, { version: area.actualizadoEn }, entorno.operaciones);
  if (operacion === "editarArea") return { manejador: entorno.rutas.area.PATCH, metodo: "PATCH", id: area.id,
    ruta: `/api/v1/areas/${area.id}`, cuerpo: { version: area.actualizadoEn, nombre: `Área editada ${randomUUID().slice(0, 8)}` } };
  const accion = operacion as "archivarArea" | "reactivarArea";
  return { manejador: entorno.rutas[accion].POST, metodo: "POST", id: area.id,
    ruta: `/api/v1/areas/${area.id}/${accion === "archivarArea" ? "archivar" : "reactivar"}`, cuerpo: { version: area.actualizadoEn } };
}

async function prepararPlantilla(operacion: Operacion): Promise<Llamada> {
  const area = await crearAreaLibre(entorno);
  const categoria = await db.categoria.create({ data: { nombre: `Categoría API ${randomUUID().slice(0, 8)}` } });
  if (operacion === "crearPlantilla") return { manejador: entorno.rutas.plantillas.POST, metodo: "POST", id: categoria.id,
    ruta: `/api/v1/categorias/${categoria.id}/plantillas`, cuerpo: { areaId: area.id, nombre: "Plantilla API" } };
  const plantilla = await entorno.servicio.crearPlantilla(categoria.id, { areaId: area.id, nombre: "Plantilla API" }, entorno.operaciones);
  if (operacion === "editarPlantilla") return { manejador: entorno.rutas.plantilla.PATCH, metodo: "PATCH", id: plantilla.id,
    ruta: `/api/v1/plantillas/${plantilla.id}`, cuerpo: { version: plantilla.actualizadoEn, nombre: "Plantilla editada API" } };
  return { manejador: entorno.rutas.archivarPlantilla.POST, metodo: "POST", id: plantilla.id,
    ruta: `/api/v1/plantillas/${plantilla.id}/archivar`, cuerpo: { version: plantilla.actualizadoEn } };
}

function preparar(operacion: Operacion) {
  if ((LECTURAS as readonly Operacion[]).includes(operacion)) return prepararLectura(operacion);
  if (([...PLANIFICACION, ...EJECUCION] as readonly Operacion[]).includes(operacion)) return prepararEtapa(operacion);
  if (operacion === "lista" || operacion === "retrabajo") return prepararAvance(operacion);
  if (operacion.endsWith("Area")) return prepararArea(operacion);
  return prepararPlantilla(operacion);
}

function registrarMatriz() {
  for (const perfil of ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMIN"] as const) {
    for (const operacion of OPERACIONES) {
      const status = autorizado(operacion, perfil) ? statusExito(operacion) : 403;
      it(`${perfil}: ${operacion} responde ${status}`, async () => {
        const respuesta = await ejecutar(await preparar(operacion), cookie(perfil));
        expect(respuesta.status).toBe(status);
        if (status === 403) expect(respuesta.error?.codigo).toBe("SIN_PERMISO");
      });
    }
  }
  it("todas las rutas sin sesión responden 401", async () => {
    for (const operacion of OPERACIONES) {
      const respuesta = await ejecutar(await preparar(operacion));
      expect(respuesta, operacion).toMatchObject({ status: 401, error: { codigo: "SIN_SESION" } });
    }
  });
}

function registrarRevocaciones() {
  for (const [permiso, operaciones] of Object.entries(PERMISOS) as [Permiso, readonly Operacion[]][]) {
    it(`revocar ${permiso} afecta las sesiones existentes`, async () => {
      const perfil = permiso === "catalogo:gestionar" || permiso === "produccion:planificar" ? "OPERACIONES" : "PRODUCCION";
      const llamadas = await Promise.all(operaciones.map(preparar));
      await conPermisoRevocado(db, { perfil, permiso }, async () => {
        for (const llamada of llamadas) expect(await ejecutar(llamada, cookie(perfil))).toMatchObject({ status: 403, error: { codigo: "SIN_PERMISO" } });
      });
    });
  }
  it("el primer inicio exige orden:avanzar y los siguientes exigen ejecutar", async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = await asignarEtapa(entorno, orden.etapas[0]);
    const llamada: Llamada = { manejador: entorno.rutas.iniciar.POST, metodo: "POST", id: etapa.id,
      ruta: `/api/v1/etapas/${etapa.id}/iniciar`, cuerpo: { version: etapa.actualizadoEn } };
    await conPermisoRevocado(db, { perfil: "PRODUCCION", permiso: "orden:avanzar" }, async () => {
      expect(await ejecutar(llamada, cookie("PRODUCCION"))).toMatchObject({ status: 403, error: { codigo: "SIN_PERMISO" } });
      expect((await leerOrden(entorno.ordenes, orden.id)).estado).toBe("PENDIENTE");
      await ponerEstado(db, orden.id, "EN_PRODUCCION");
      expect((await ejecutar(llamada, cookie("PRODUCCION"))).status).toBe(200);
    });
  });
}

function registrarIdentificadores() {
  const operaciones = OPERACIONES.filter((operacion) => !["tablero", "opciones", "listarAreas", "crearArea"].includes(operacion));
  for (const operacion of operaciones) {
    it(`${operacion}: identificadores inexistentes o inválidos responden 404`, async () => {
      const llamada = await preparar(operacion);
      const sesion = cookie(perfilAutorizado(operacion));
      for (const id of [randomUUID(), "id-invalido"]) {
        const destino = { ...llamada, id, ruta: llamada.ruta.replace(`/${llamada.id}`, `/${id}`) };
        expect(await ejecutar(destino, sesion)).toMatchObject({ status: 404, error: { codigo: "NO_ENCONTRADO" } });
      }
    });
  }
}

function registrarVersiones() {
  const exclusiones: readonly Operacion[] = [...LECTURAS, "agregarEtapa", "crearArea", "crearPlantilla"];
  const operaciones = OPERACIONES.filter((operacion) => !exclusiones.includes(operacion));
  for (const operacion of operaciones) {
    it(`${operacion}: exige versión y rechaza versión antigua`, async () => {
      const llamada = await preparar(operacion);
      const sesion = cookie(perfilAutorizado(operacion));
      const cuerpo = { ...llamada.cuerpo };
      delete cuerpo.version;
      expect(await ejecutar({ ...llamada, cuerpo }, sesion)).toMatchObject({ status: 422, error: { codigo: "VALIDACION", campos: { version: expect.any(String) } } });
      expect(await ejecutar({ ...llamada, cuerpo: { ...cuerpo, version: "2000-01-01T00:00:00.000Z" } }, sesion))
        .toMatchObject({ status: 409, error: { codigo: "CONFLICTO_EDICION" } });
    });
  }
}

function registrarGuardasEtapas() {
  it("iniciar sin responsable responde 409 y conserva la orden", async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = orden.etapas[0];
    const respuesta = await invocar(entorno.rutas.iniciar.POST, peticion("POST", `/api/v1/etapas/${etapa.id}/iniciar`, {
      cookie: cookie("PRODUCCION"), cuerpo: { version: etapa.actualizadoEn } }), etapa.id);
    expect(respuesta).toMatchObject({ status: 409, error: { codigo: "ETAPA_SIN_RESPONSABLE" } });
    expect(await leerOrden(entorno.ordenes, orden.id)).toEqual(orden);
  });
  for (const estado of ["LISTA", "ENTREGADA", "CERRADA", "CANCELADA"] as const) {
    it(`${estado}: todas las acciones de etapa responden 409`, async () => {
      const orden = await nuevaOrden(entorno);
      await ponerEstado(db, orden.id, estado);
      const etapa = orden.etapas[0];
      for (const accion of ["iniciar", "completar", "omitir", "restaurar"] as const) {
        const respuesta = await invocar(entorno.rutas[accion].POST, peticion("POST", `/api/v1/etapas/${etapa.id}/${accion}`, {
          cookie: cookie(perfilAutorizado(accion)), cuerpo: { version: etapa.actualizadoEn, motivo: "Motivo API" } }), etapa.id);
        expect(respuesta).toMatchObject({ status: 409, error: { codigo: "ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA" } });
      }
      const editar = await invocar(entorno.rutas.etapa.PATCH, peticion("PATCH", `/api/v1/etapas/${etapa.id}`, {
        cookie: cookie("OPERACIONES"), cuerpo: { version: etapa.actualizadoEn, responsableId: entorno.actor.id } }), etapa.id);
      const agregar = await invocar(entorno.rutas.etapas.POST, peticion("POST", `/api/v1/ordenes/${orden.id}/etapas`, {
        cookie: cookie("OPERACIONES"), cuerpo: { areaId: etapa.area.id, nombre: "Etapa bloqueada" } }), orden.id);
      for (const respuesta of [editar, agregar]) expect(respuesta).toMatchObject({ status: 409, error: { codigo: "ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA" } });
    });
  }
}

function registrarValidacion() {
  it("rechaza responsable inexistente, otro perfil e inactivo con 422", async () => {
    const llamada = await preparar("editarEtapa");
    for (const responsableId of [randomUUID(), entorno.ordenes.sesiones.ATENCION_CLIENTE.usuarioId, "invalido"]) {
      const respuesta = await ejecutar({ ...llamada, cuerpo: { ...llamada.cuerpo, responsableId } }, cookie("OPERACIONES"));
      expect(respuesta).toMatchObject({ status: 422, error: { codigo: "VALIDACION", campos: { responsableId: expect.any(String) } } });
    }
    const segunda = await abrirSesion(db, entorno.ordenes.cotizaciones.modulos, "OPERACIONES");
    await db.usuario.update({ where: { id: entorno.actor.id }, data: { activo: false } });
    try {
      const respuesta = await ejecutar({ ...llamada, cuerpo: { ...llamada.cuerpo, responsableId: entorno.actor.id } }, segunda.cookie);
      expect(respuesta).toMatchObject({ status: 422, error: { codigo: "VALIDACION", campos: { responsableId: expect.any(String) } } });
    } finally { await db.usuario.update({ where: { id: entorno.actor.id }, data: { activo: true } }); }
  });
  it("rechaza fechas inválidas, fechas invertidas y motivos cortos con 422", async () => {
    const llamada = await preparar("editarEtapa");
    for (const fechas of [{ fechaInicioPlan: "2026-02-30" }, { fechaInicioPlan: "2026-10-10", fechaFinPlan: "2026-10-09" }]) {
      expect((await ejecutar({ ...llamada, cuerpo: { ...llamada.cuerpo, ...fechas } }, cookie("OPERACIONES"))).status).toBe(422);
    }
    for (const operacion of ["omitir", "retrabajo"] as const) {
      const llamada = await preparar(operacion);
      expect(await ejecutar({ ...llamada, cuerpo: { ...llamada.cuerpo, motivo: "no" } }, cookie(perfilAutorizado(operacion))))
        .toMatchObject({ status: 422, error: { campos: { motivo: expect.any(String) } } });
    }
  });
  it("todas las escrituras rechazan JSON roto con 400", async () => {
    for (const operacion of OPERACIONES.filter((operacion) => !(LECTURAS as readonly Operacion[]).includes(operacion))) {
      const llamada = await preparar(operacion);
      const req = new Request(`http://localhost${llamada.ruta}`, { method: llamada.metodo, body: "{json roto",
        headers: { origin: "http://localhost", cookie: cookie(perfilAutorizado(operacion)) } });
      expect(await invocar(llamada.manejador, req, llamada.id)).toMatchObject({ status: 400, error: { codigo: "JSON_INVALIDO" } });
    }
  });
}

function registrarTablero() {
  it("tablero filtra por orden, área, responsable y estado sin dinero en ningún perfil", async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = await asignarEtapa(entorno, orden.etapas[0]);
    const consulta = new URLSearchParams({ q: orden.numero, area: etapa.area.id, responsable: entorno.actor.id, estado: "PENDIENTE" });
    for (const perfil of ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMIN"] as const) {
      const respuesta = await invocar<EtapaTablero[]>(entorno.rutas.tablero.GET, peticion("GET", `/api/v1/produccion/tablero?${consulta}`, { cookie: cookie(perfil) }));
      if (perfil === "ADMIN") {
        expect(respuesta).toMatchObject({ status: 403, error: { codigo: "SIN_PERMISO" } });
        continue;
      }
      expect(respuesta.status).toBe(200);
      expect(respuesta.datos).toHaveLength(1);
      expect(respuesta.datos[0]).toMatchObject({ id: etapa.id, orden: { id: orden.id }, actualizadoEn: etapa.actualizadoEn });
      expect(JSON.stringify(respuesta.datos)).not.toMatch(/"(?:precioUnitario|importe|subtotal|total|costoUnitario|costoTotal|margenPct|impuesto)"/);
      expect(respuesta.cuerpo).toHaveProperty("porArea");
      expect(respuesta.cuerpo).toHaveProperty("porResponsable");
    }
  });
  it("rechaza filtros inválidos con 422 y campos legibles", async () => {
    for (const consulta of ["area=no", "responsable=no", "estado=COMPLETADA", `q=${"a".repeat(201)}`]) {
      const respuesta = await invocar(entorno.rutas.tablero.GET, peticion("GET", `/api/v1/produccion/tablero?${consulta}`, { cookie: cookie("PRODUCCION") }));
      expect(respuesta).toMatchObject({ status: 422, error: { codigo: "VALIDACION", mensaje: expect.any(String), campos: expect.any(Object) } });
    }
  });
}

function registrarGuardasOrden() {
  it("marcar lista con etapas abiertas responde ETAPAS_ABIERTAS", async () => {
    const orden = await nuevaOrden(entorno);
    await ponerEstado(db, orden.id, "EN_PRODUCCION");
    const actual = await leerOrden(entorno.ordenes, orden.id);
    const respuesta = await invocar(entorno.rutas.lista.POST, peticion("POST", `/api/v1/ordenes/${orden.id}/lista`, {
      cookie: cookie("PRODUCCION"), cuerpo: { version: actual.actualizadoEn } }), orden.id);
    expect(respuesta).toMatchObject({ status: 409, error: { codigo: "ETAPAS_ABIERTAS" } });
  });
  it("marcar lista con todas omitidas responde ORDEN_SIN_TRABAJO", async () => {
    const orden = await nuevaOrden(entorno);
    for (const etapa of orden.etapas) await entorno.servicio.omitirEtapa(etapa.id, { version: etapa.actualizadoEn, motivo: "Omisión API" }, entorno.planificador);
    await ponerEstado(db, orden.id, "EN_PRODUCCION");
    const actual = await leerOrden(entorno.ordenes, orden.id);
    const respuesta = await invocar(entorno.rutas.lista.POST, peticion("POST", `/api/v1/ordenes/${orden.id}/lista`, {
      cookie: cookie("PRODUCCION"), cuerpo: { version: actual.actualizadoEn } }), orden.id);
    expect(respuesta).toMatchObject({ status: 409, error: { codigo: "ORDEN_SIN_TRABAJO" } });
  });
  it("archivar área con plantillas activas responde AREA_EN_USO", async () => {
    const areaId = (await nuevaOrden(entorno)).etapas[0].area.id;
    const area = await db.area.findUniqueOrThrow({ where: { id: areaId } });
    const respuesta = await invocar(entorno.rutas.archivarArea.POST, peticion("POST", `/api/v1/areas/${area.id}/archivar`, {
      cookie: cookie("OPERACIONES"), cuerpo: { version: area.actualizadoEn.toISOString() } }), area.id);
    expect(respuesta).toMatchObject({ status: 409, error: { codigo: "AREA_EN_USO" } });
  });
}

describeConBase("producción: API por perfil, validación y contratos", () => {
  db = crearClientePropietario();
  beforeAll(async () => { entorno = await prepararProduccion(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  registrarMatriz();
  registrarRevocaciones();
  registrarIdentificadores();
  registrarVersiones();
  registrarGuardasEtapas();
  registrarGuardasOrden();
  registrarValidacion();
  registrarTablero();
});
