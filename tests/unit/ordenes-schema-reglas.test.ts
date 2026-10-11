import { describe, expect, it } from "vitest";
import { esCotizacionDuplicada, leerIdOrden, ordenExistente } from "@/modules/ordenes/errores";
import { cambiosEdicion, estaAtrasada, exigirEditable, exigirTransicion, validarFechaEntrega, validarMotivoCancelacion } from "@/modules/ordenes/reglas";
import { ESTADOS, esquemaCancelarOrden, esquemaCambioEstado, esquemaConsultaOrdenes, esquemaCrearOrden, esquemaEditarOrden,
  objetoDeParametros } from "@/modules/ordenes/schema";
import { aEventoTimeline } from "@/modules/ordenes/textoEvento";

const id = "11111111-1111-4111-8111-111111111111";
const version = "2026-10-06T12:00:00.123Z";
const creacion = { cotizacionId: id, categoriaId: id, responsableId: id, fechaEntrega: "2026-10-06" };

describe("órdenes: esquemas zod", () => {
  it("acepta la conversión mínima y normaliza especificaciones", () => {
    expect(esquemaCrearOrden.parse(creacion)).toEqual(creacion);
    expect(esquemaCrearOrden.parse({ ...creacion, especificaciones: "  Texto  " }).especificaciones).toBe("Texto");
    expect(esquemaCrearOrden.parse({ ...creacion, especificaciones: " " }).especificaciones).toBeNull();
  });
  for (const campo of ["cotizacionId", "categoriaId", "fechaEntrega"] as const) {
    it(`la conversión exige ${campo}`, () => {
      const entrada: Record<string, unknown> = { ...creacion };
      delete entrada[campo];
      expect(esquemaCrearOrden.safeParse(entrada).success).toBe(false);
    });
  }
  it("crear y editar admiten responsable omitido o nulo y rechazan identificadores inválidos", () => {
    const { responsableId, ...sinResponsable } = creacion;
    expect(responsableId).toBe(id);
    expect(esquemaCrearOrden.parse(sinResponsable)).not.toHaveProperty("responsableId");
    expect(esquemaCrearOrden.parse({ ...sinResponsable, responsableId: null }).responsableId).toBeNull();
    expect(esquemaEditarOrden.parse({ version, responsableId: null }).responsableId).toBeNull();
    for (const responsableId of ["", "inválido"]) {
      expect(esquemaCrearOrden.safeParse({ ...sinResponsable, responsableId }).success).toBe(false);
      expect(esquemaEditarOrden.safeParse({ version, responsableId }).success).toBe(false);
    }
  });
  for (const fechaEntrega of ["2026-02-30", "2025-02-29", "06-10-2026", "2026-10-06T00:00:00Z"]) {
    it(`rechaza la fecha de calendario ${fechaEntrega}`, () => {
      expect(esquemaCrearOrden.safeParse({ ...creacion, fechaEntrega }).success).toBe(false);
    });
  }
  it("acepta año bisiesto y descarta campos monetarios y de estado", () => {
    const entrada = esquemaCrearOrden.parse({ ...creacion, fechaEntrega: "2028-02-29", total: "1", estado: "LISTA" });
    expect(entrada).not.toHaveProperty("total");
    expect(entrada).not.toHaveProperty("estado");
  });
  it("editar exige versión pero admite un PATCH sin cambios", () => {
    expect(esquemaEditarOrden.safeParse({ especificaciones: "Texto" }).success).toBe(false);
    expect(esquemaEditarOrden.parse({ version })).toEqual({ version });
    expect(esquemaEditarOrden.parse({ version, especificaciones: null }).especificaciones).toBeNull();
  });
  it("las transiciones exigen versión ISO con zona horaria", () => {
    for (const valor of [undefined, "", "vieja", "2026-10-06", "2026-10-06T12:00:00"]) {
      expect(esquemaCambioEstado.safeParse({ version: valor }).success).toBe(false);
    }
    expect(esquemaCambioEstado.parse({ version: "2026-10-06T06:00:00-06:00" }).version).toContain("-06:00");
  });
  it("cancelar exige cinco caracteres después de recortar espacios", () => {
    for (const motivo of [undefined, "", "    ", "  abcd  "]) expect(esquemaCancelarOrden.safeParse({ version, motivo }).success).toBe(false);
    expect(esquemaCancelarOrden.parse({ version, motivo: "  abcde  " }).motivo).toBe("abcde");
  });
  it("consulta aplica límites y filtros tipados", () => {
    expect(esquemaConsultaOrdenes.parse({ responsable: "sin-responsable" }).responsable).toBe("sin-responsable");
    expect(esquemaConsultaOrdenes.parse({})).toEqual({ pagina: 1, porPagina: 20, vencidas: "false", terminales: "false" });
    expect(esquemaConsultaOrdenes.parse({ pagina: "2", porPagina: "100", estado: "LISTA", responsable: id, cliente: id,
      terminales: "todas", vencidas: "true" }).pagina).toBe(2);
    for (const entrada of [{ pagina: "0" }, { porPagina: "101" }, { estado: "EN_CURSO" }, { vencidas: "sí" }, { responsable: "x" }]) {
      expect(esquemaConsultaOrdenes.safeParse(entrada).success).toBe(false);
    }
  });
  it("normaliza parámetros repetidos y vacíos", () => {
    expect(objetoDeParametros({ q: [" texto ", "otro"], estado: "", cliente: undefined })).toEqual({ q: "texto" });
    expect(objetoDeParametros(new URLSearchParams("q=+texto+&estado="))).toEqual({ q: "texto" });
  });
});

describe("órdenes: reglas puras", () => {
  for (const estado of ESTADOS) {
    it(`permite acciones del módulo solo desde estados válidos: ${estado}`, () => {
      const editables = ["PENDIENTE", "EN_PRODUCCION", "LISTA"].includes(estado);
      if (editables) expect(() => exigirEditable(estado)).not.toThrow();
      else expect(() => exigirEditable(estado)).toThrow();
      for (const accion of ["entregar", "cerrar", "cancelar"] as const) {
        const valida = accion === "entregar" ? estado === "LISTA" : accion === "cerrar" ? estado === "ENTREGADA" : editables;
        if (valida) expect(() => exigirTransicion(estado, accion)).not.toThrow();
        else expect(() => exigirTransicion(estado, accion)).toThrow();
      }
    });
  }
  it("marca atraso con fecha pasada y excluye estados terminales", () => {
    for (const estado of ESTADOS) {
      expect(estaAtrasada({ estado, fechaEntrega: "2026-10-05" }, "2026-10-06"))
        .toBe(["PENDIENTE", "EN_PRODUCCION", "LISTA"].includes(estado));
    }
    expect(estaAtrasada({ estado: "PENDIENTE", fechaEntrega: "2026-10-06" }, "2026-10-06")).toBe(false);
  });
  it("valida fecha pasada con 422 y permite hoy y fechas futuras", () => {
    expect(() => validarFechaEntrega("2026-10-05", "2026-10-06")).toThrow();
    expect(() => validarFechaEntrega("2026-10-06", "2026-10-06")).not.toThrow();
    expect(() => validarFechaEntrega("2026-10-07", "2026-10-06")).not.toThrow();
  });
  it("distingue campos omitidos, iguales, cambiados y vaciado de especificaciones", () => {
    const actual = { responsableId: id, fechaEntrega: "2000-01-01", especificaciones: "Texto" };
    expect(cambiosEdicion(actual, { version })).toEqual({});
    expect(cambiosEdicion(actual, { version, ...actual })).toEqual({});
    expect(cambiosEdicion(actual, { version, especificaciones: null })).toEqual({ especificaciones: null });
    expect(cambiosEdicion(actual, { version, responsableId: "otro", fechaEntrega: "2026-10-06" }))
      .toEqual({ responsableId: "otro", fechaEntrega: "2026-10-06" });
  });
  it("valida y recorta el motivo en el servicio", () => {
    expect(() => validarMotivoCancelacion("  abcd  ")).toThrow();
    expect(validarMotivoCancelacion("  abcde  ")).toBe("abcde");
  });
  it("distingue asignación desde nulo, desasignación y responsable nulo sin cambios", () => {
    const actual = { responsableId: null, fechaEntrega: "2026-10-06", especificaciones: null };
    expect(cambiosEdicion(actual, { version })).toEqual({});
    expect(cambiosEdicion(actual, { version, responsableId: null })).toEqual({});
    expect(cambiosEdicion(actual, { version, responsableId: id })).toEqual({ responsableId: id });
    expect(cambiosEdicion({ ...actual, responsableId: id }, { version, responsableId: null })).toEqual({ responsableId: null });
  });
  it("identifica el UNIQUE de cotización sin confundir otras restricciones", () => {
    expect(esCotizacionDuplicada({ code: "P2002", meta: { target: ["cotizacion_id"] } })).toBe(true);
    expect(esCotizacionDuplicada({ name: "DriverAdapterError", cause: { originalCode: "23505", constraint: { fields: ["cotizacion_id"] } } })).toBe(true);
    expect(esCotizacionDuplicada({ code: "P2002", meta: { target: ["numero"] } })).toBe(false);
    expect(esCotizacionDuplicada({ code: "SC004", message: "cotizacion_id" })).toBe(false);
    expect(esCotizacionDuplicada(null)).toBe(false);
  });
  it("identificador inválido devuelve 404 y orden existente incluye número", () => {
    expect(leerIdOrden(id)).toBe(id);
    expect(() => leerIdOrden("no-es-uuid")).toThrow();
    expect(ordenExistente({ id, numero: "OT-2026-0001" })).toMatchObject({ status: 409, codigo: "ORDEN_EXISTENTE",
      campos: { ordenId: id, numero: "OT-2026-0001" } });
  });
  it("línea de tiempo muestra actor, fecha, transición y motivo sin dinero oculto", () => {
    const evento = aEventoTimeline({ id, entidad: "ETAPA_ORDEN", entidadId: id, accion: "CAMBIAR_ESTADO", estadoAnterior: "PENDIENTE",
      estadoNuevo: "OMITIDA", actor: "Operaciones", creadoEn: version, detalle: { motivo: "Orden cancelada" } });
    expect(evento).toMatchObject({ actor: "Operaciones", instante: version, accion: "cambió el estado",
      detalle: "Pendiente → Omitida. Motivo: Orden cancelada" });
  });
  it("línea de tiempo identifica la asignación desde responsable nulo", () => {
    const evento = aEventoTimeline({ id, entidad: "ORDEN_TRABAJO", entidadId: id, accion: "ASIGNAR_RESPONSABLE",
      estadoAnterior: null, estadoNuevo: null, actor: "Operaciones", creadoEn: version,
      detalle: { responsableId: { anterior: null, nuevo: id } } });
    expect(evento.detalle).toBe(`Responsable: Sin responsable → ${id}`);
  });
});
