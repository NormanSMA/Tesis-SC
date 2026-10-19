import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import type { Prisma } from "@/generated/prisma/client";
import { sumarDias } from "@/modules/cotizaciones/fechas";
import { esquemaConsultaCotizaciones, ESTADOS, type ConsultaCotizaciones } from "@/modules/cotizaciones/schema";
import { CAMPOS_ORDEN_COTIZACION, type CampoOrdenCotizacion, type EstadoCotizacion } from "@/modules/cotizaciones/tipos";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { invocar, nombreUnico, prepararCotizaciones, type EntornoCotizaciones } from "./cotizaciones-ayudas";

const HOY = "2026-12-31";
const marca = nombreUnico("Lista avanzada");
const db = crearClientePropietario();
type FilaPrueba = Prisma.CotizacionGetPayload<{ include: { cliente: true } }>;
type DatosFila = {
  nombre: string; estado: EstadoCotizacion; dias?: number; clienteId?: string;
  total?: number; grupo?: number; archivada?: boolean; respuesta?: boolean; fuera?: boolean;
};
let entorno: EntornoCotizaciones;
let filas: FilaPrueba[];
let otroClienteId: string;

// Los triggers solo permiten crear en BORRADOR y avanzar BORRADOR -> ENVIADA -> estado final (como panel-ayudas.ts).
async function insertarFila(entrada: DatosFila) {
  const respondida = entrada.respuesta || ["APROBADA", "RECHAZADA", "AJUSTE_SOLICITADO"].includes(entrada.estado);
  const total = String(entrada.total ?? 9);
  return db.$transaction(async (tx) => {
    const [contador] = await tx.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('COTIZACION') AS numero`;
    const nueva = await tx.cotizacion.create({ data: {
      numero: contador.numero, clienteId: entrada.clienteId ?? entorno.referencias.cliente.id,
      creadoPorId: entorno.ventas.usuarioId, asunto: entrada.fuera ? "Fuera del filtro" : `${marca} ${entrada.nombre}`,
      tasaImpuesto: "0", descuento: "0", impuesto: "0", subtotal: total, total, vigenciaDias: 15,
      creadoEn: sumarDias("2026-10-01", entrada.grupo ?? 0),
      fechaEmision: entrada.dias === undefined ? null : sumarDias(HOY, entrada.dias - 15),
      fechaVencimiento: entrada.dias === undefined ? null : sumarDias(HOY, entrada.dias),
    } });
    await tx.itemCotizacion.create({ data: { cotizacionId: nueva.id, tipo: "CATALOGO", secuencia: 1,
      productoId: entorno.referencias.unidad.id, categoriaId: entorno.referencias.categoria.id,
      descripcion: "Ítem de prueba", unidadCobro: "UNIDAD", cantidad: "1", precioUnitario: total, importe: total } });
    if (entrada.estado !== "BORRADOR") await tx.cotizacion.update({ where: { id: nueva.id }, data: { estado: "ENVIADA" } });
    if (entrada.estado !== "BORRADOR" && (entrada.estado !== "ENVIADA" || respondida)) {
      await tx.cotizacion.update({ where: { id: nueva.id }, data: {
        estado: entrada.estado, fechaRespuesta: respondida ? new Date(`${HOY}T12:00:00Z`) : null,
        usuarioAprobacionId: entrada.estado === "APROBADA" ? entorno.ventas.usuarioId : null,
        referenciaAprobacion: entrada.estado === "APROBADA" ? "Correo del cliente" : null,
        motivoRechazo: entrada.estado === "RECHAZADA" ? "Presupuesto insuficiente" : null,
        motivoAjuste: entrada.estado === "AJUSTE_SOLICITADO" ? "Cambiar medidas" : null,
      } });
    }
    if (entrada.archivada) await tx.cotizacion.update({ where: { id: nueva.id }, data: { archivada: true } });
    return tx.cotizacion.findUniqueOrThrow({ where: { id: nueva.id }, include: { cliente: true } });
  });
}

function consultar(extra: Partial<ConsultaCotizaciones> = {}) {
  return entorno.modulos.servicio.listarCotizaciones({ q: marca, archivadas: "false", pagina: 1, porPagina: 100, ...extra });
}

function prepararLista() {
  beforeAll(async () => {
    entorno = await prepararCotizaciones(db);
    await db.cliente.update({ where: { id: entorno.referencias.cliente.id }, data: { nombre: nombreUnico("A Lista") } });
    // La base exige teléfono o correo (cliente_medio_contacto).
    otroClienteId = (await db.cliente.create({ data: { nombre: nombreUnico("Z Lista"), tipo: "EMPRESA", telefono: "88887777" } })).id;
    vi.spyOn(entorno.modulos.fechas, "hoyManagua").mockReturnValue(HOY);
    const datos: DatosFila[] = [
      { nombre: "hoy", estado: "ENVIADA", dias: 0, total: 10, grupo: 1 },
      { nombre: "tercer día", estado: "ENVIADA", dias: 3, total: 10, grupo: 1 },
      { nombre: "cuarto día", estado: "ENVIADA", dias: 4, clienteId: otroClienteId, total: 2, grupo: 2 },
      { nombre: "ayer", estado: "ENVIADA", dias: -1, clienteId: otroClienteId, total: 2, grupo: 2 },
      { nombre: "respondida", estado: "ENVIADA", dias: 0, respuesta: true },
      { nombre: "borrador", estado: "BORRADOR", total: 100, grupo: 2 },
      { nombre: "aprobada", estado: "APROBADA", dias: 1, clienteId: otroClienteId },
      { nombre: "rechazada", estado: "RECHAZADA", dias: 1, clienteId: otroClienteId },
      { nombre: "vencida", estado: "VENCIDA", dias: -1 },
      { nombre: "ajuste", estado: "AJUSTE_SOLICITADO", dias: 1 },
      { nombre: "archivada", estado: "ENVIADA", dias: 2, archivada: true },
      { nombre: "otra búsqueda", estado: "ENVIADA", dias: 1, fuera: true },
    ];
    filas = [];
    for (const entrada of datos) filas.push(await insertarFila(entrada));
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await liberarClienteGlobal();
    await db.$disconnect();
  });
}

function valorOrden(fila: FilaPrueba, campo: CampoOrdenCotizacion): string | number | null {
  if (campo === "creadoEn") return fila.creadoEn.getTime();
  if (campo === "cliente") return fila.cliente.nombre;
  if (campo === "total") return Number(fila.total);
  if (campo === "vencimiento") return fila.fechaVencimiento?.getTime() ?? null;
  return fila.numero;
}

function idsOrdenados(campo: CampoOrdenCotizacion, direccion: "asc" | "desc") {
  const signo = direccion === "asc" ? 1 : -1;
  return filas.slice(0, 10).sort((a, b) => {
    const primero = valorOrden(a, campo);
    const segundo = valorOrden(b, campo);
    if (primero === null && segundo !== null) return 1;
    if (segundo === null && primero !== null) return -1;
    if (primero !== null && segundo !== null && primero !== segundo) return (primero < segundo ? -1 : 1) * signo;
    return (a.id < b.id ? -1 : 1) * signo;
  }).map((fila) => fila.id);
}

function probarOrden() {
  it.each(CAMPOS_ORDEN_COTIZACION)("ordena por %s en ambas direcciones con desempate por id", async (campo) => {
    for (const direccion of ["asc", "desc"] as const) {
      const esperado = idsOrdenados(campo, direccion);
      const lista = await consultar({ orden: { campo, direccion } });
      expect(lista.datos.map((fila) => fila.id)).toEqual(esperado);
      const ids: string[] = [];
      for (let pagina = 1; pagina <= 4; pagina += 1) {
        const parcial = await consultar({ orden: { campo, direccion }, pagina, porPagina: 3 });
        ids.push(...parcial.datos.map((fila) => fila.id));
      }
      expect(ids).toEqual(esperado);
      if (campo === "vencimiento") expect(lista.datos.at(-1)?.fechaVencimiento).toBeNull();
    }
  });
  it("conserva creadoEn descendente e id descendente como orden predeterminado", async () => {
    expect((await consultar()).datos.map((fila) => fila.id)).toEqual(idsOrdenados("creadoEn", "desc"));
  });
}

function probarPorVencer() {
  it("incluye hoy y hoy+3; excluye ayer, hoy+4, respuestas, archivadas y otros estados", async () => {
    const lista = await consultar({ porVencer: "true", orden: { campo: "vencimiento", direccion: "asc" } });
    expect(lista.total).toBe(2);
    expect(lista.datos.map((fila) => fila.id)).toEqual([filas[0].id, filas[1].id]);
    expect((await consultar({ porVencer: "true", archivadas: "true" })).datos.map((fila) => fila.id)).toEqual([filas[10].id]);
    expect((await consultar({ porVencer: "true", estado: "BORRADOR" })).total).toBe(0);
    expect((await consultar({ porVencer: "true", estado: "ENVIADA" })).total).toBe(2);
  });
  it("cambia el día a las seis UTC en Managua y atraviesa el cambio de año", async () => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2027-01-01T05:59:59.999Z"));
      expect((await consultar({ porVencer: "true" })).total).toBe(2);
      vi.setSystemTime(new Date("2027-01-01T06:00:00.000Z"));
      const lista = await consultar({ porVencer: "true" });
      expect(lista.datos.map((fila) => fila.id).sort()).toEqual([filas[1].id, filas[2].id].sort());
    } finally {
      vi.useRealTimers();
      vi.spyOn(entorno.modulos.fechas, "hoyManagua").mockReturnValue(HOY);
    }
  });
}

function probarConteos() {
  it("cuenta todos los estados sin depender del estado, porVencer, orden o página", async () => {
    const esperado = { BORRADOR: 1, ENVIADA: 5, APROBADA: 1, RECHAZADA: 1, VENCIDA: 1, AJUSTE_SOLICITADO: 1, todas: 10, porVencer: 2 };
    expect((await consultar()).conteos).toEqual(esperado);
    for (const estado of ESTADOS) {
      const lista = await consultar({ estado, porPagina: 1, pagina: 20, orden: { campo: "total", direccion: "asc" } });
      expect(lista.conteos).toEqual(esperado);
      expect(lista.total).toBe(esperado[estado]);
      expect(lista.datos).toEqual([]);
      expect((await consultar({ estado, porVencer: "true" })).conteos).toEqual(esperado);
    }
  });
  it("aplica búsqueda, cliente y archivo también a los conteos", async () => {
    const delCliente = await consultar({ cliente: entorno.referencias.cliente.id, q: marca.toUpperCase() });
    expect(delCliente.conteos).toEqual({ BORRADOR: 1, ENVIADA: 3, APROBADA: 0, RECHAZADA: 0,
      VENCIDA: 1, AJUSTE_SOLICITADO: 1, todas: 6, porVencer: 2 });
    expect((await consultar({ cliente: otroClienteId })).conteos).toMatchObject({ todas: 4, ENVIADA: 2, porVencer: 0 });
    expect((await consultar({ archivadas: "todas" })).conteos).toMatchObject({ todas: 11, ENVIADA: 6, porVencer: 3 });
    expect((await consultar({ archivadas: "true" })).conteos).toEqual({ BORRADOR: 0, ENVIADA: 1,
      APROBADA: 0, RECHAZADA: 0, VENCIDA: 0, AJUSTE_SOLICITADO: 0, todas: 1, porVencer: 1 });
    expect((await consultar({ q: filas[0].numero })).conteos).toMatchObject({ todas: 1, ENVIADA: 1, porVencer: 1 });
    expect((await consultar({ q: filas[0].cliente.nombre, cliente: filas[0].clienteId })).conteos)
      .toMatchObject({ todas: 7, ENVIADA: 4, porVencer: 3 });
  });
  it("devuelve ceros para estados ausentes y consultas sin coincidencias", async () => {
    const esperado = { BORRADOR: 0, ENVIADA: 0, APROBADA: 0, RECHAZADA: 0, VENCIDA: 0, AJUSTE_SOLICITADO: 0, todas: 0, porVencer: 0 };
    expect((await consultar({ cliente: randomUUID() })).conteos).toEqual(esperado);
    expect((await consultar({ q: nombreUnico("Sin coincidencias") })).conteos).toEqual(esperado);
  });
}

function probarApi() {
  it("responde 422 para orden inválido y expone conteos con orden válido", async () => {
    const opciones = { cookie: entorno.ventas.cookie, origen: null };
    const invalida = await invocar(entorno.modulos.lista.GET, peticion("GET", "/api/v1/cotizaciones?orden=estado:desc", opciones));
    expect(invalida.status).toBe(422);
    expect(invalida.error?.campos?.orden).toBeTruthy();
    const parametros = new URLSearchParams({ q: marca, porVencer: "true", orden: "vencimiento:asc" });
    const valida = await invocar(entorno.modulos.lista.GET, peticion("GET", `/api/v1/cotizaciones?${parametros}`, opciones));
    expect(valida.status).toBe(200);
    expect(valida.cuerpo).toMatchObject({ total: 2, conteos: { todas: 10, porVencer: 2 } });
    expect(esquemaConsultaCotizaciones.parse(Object.fromEntries(parametros)).orden)
      .toEqual({ campo: "vencimiento", direccion: "asc" });
  });
}

describeConBase("cotizaciones: orden seguro, por vencer y conteos", () => {
  prepararLista();
  probarOrden();
  probarPorVencer();
  probarConteos();
  probarApi();
});
