import { describe, expect, it } from "vitest";
import { esquemaCrearCotizacion, esquemaEditarCotizacion, esquemaCambioEstado, esquemaResponder,
  esquemaReemplazarItems, esquemaConsultaCotizaciones, objetoDeParametros } from "@/modules/cotizaciones/schema";
import { hoyManagua, sumarDias } from "@/modules/cotizaciones/fechas";

const ID = "00000000-0000-4000-8000-000000000001";
const VERSION = "2026-10-06T00:00:00.123Z";
const catalogo = { tipo: "CATALOGO", productoId: ID, cantidad: "2.5" };
const personalizado = { tipo: "PERSONALIZADO", categoriaId: ID, descripcion: "Trabajo", unidadCobro: "UNIDAD",
  cantidad: "2", margenPct: "35", lineas: [{ tipo: "TERCERO", descripcion: "Servicio", unidad: "servicio", costo: "10" }] };

describe("cotizaciones: esquemas", () => {
  it("crear exige cliente UUID y asunto no vacío hasta 200 caracteres", () => {
    expect(esquemaCrearCotizacion.parse({ clienteId: ID, asunto: "  Rotulación  " })).toEqual({ clienteId: ID, asunto: "Rotulación" });
    for (const entrada of [{ clienteId: "otro", asunto: "A" }, { clienteId: ID, asunto: " " }, { clienteId: ID, asunto: "a".repeat(201) }]) {
      expect(esquemaCrearCotizacion.safeParse(entrada).success).toBe(false);
    }
  });

  it("limita condiciones a 2000, motivo a 500 y descripciones a 200 con error de campo", () => {
    const mensaje = (resultado: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
      resultado.error?.issues.map((p) => `${p.path.join(".")}|${p.message}`);
    for (const condiciones of ["c".repeat(2000), null]) {
      expect(esquemaCrearCotizacion.safeParse({ clienteId: ID, asunto: "A", condiciones }).success).toBe(true);
      expect(esquemaEditarCotizacion.safeParse({ version: VERSION, condiciones }).success).toBe(true);
    }
    expect(mensaje(esquemaCrearCotizacion.safeParse({ clienteId: ID, asunto: "A", condiciones: "c".repeat(2001) })))
      .toEqual(["condiciones|Admite hasta 2000 caracteres."]);
    expect(mensaje(esquemaEditarCotizacion.safeParse({ version: VERSION, condiciones: "c".repeat(2001) })))
      .toEqual(["condiciones|Admite hasta 2000 caracteres."]);
    const rechazo = { version: VERSION, resultado: "RECHAZADA" as const };
    expect(esquemaResponder.safeParse({ ...rechazo, motivo: "m".repeat(500) }).success).toBe(true);
    expect(mensaje(esquemaResponder.safeParse({ ...rechazo, motivo: "m".repeat(501) })))
      .toEqual(["motivo|Admite hasta 500 caracteres."]);
    const linea = { tipo: "TERCERO", descripcion: "d".repeat(200), unidad: "u", costo: "1" };
    const resultadoItem = (item: object) => esquemaReemplazarItems.safeParse({ version: VERSION, items: [item] });
    expect(resultadoItem({ ...personalizado, descripcion: "d".repeat(200), lineas: [linea] }).success).toBe(true);
    expect(mensaje(resultadoItem({ ...personalizado, descripcion: "d".repeat(201) })))
      .toEqual(["items.0.descripcion|Admite hasta 200 caracteres."]);
    expect(mensaje(resultadoItem({ ...personalizado, lineas: [{ ...linea, descripcion: "d".repeat(201) }] })))
      .toEqual(["items.0.lineas.0.descripcion|Admite hasta 200 caracteres."]);
  });

  it("crear no exige versión e ignora montos del cliente", () => {
    expect(esquemaCrearCotizacion.parse({ clienteId: ID, asunto: "A", total: "999", tasaImpuesto: "0" }))
      .toEqual({ clienteId: ID, asunto: "A" });
  });

  it("editar, responder y reemplazar exigen versión ISO", () => {
    for (const esquema of [esquemaEditarCotizacion, esquemaCambioEstado, esquemaResponder, esquemaReemplazarItems]) {
      expect(esquema.safeParse({ items: [], resultado: "APROBADA" }).success).toBe(false);
      expect(esquema.safeParse({ version: "ayer", items: [], resultado: "APROBADA" }).success).toBe(false);
    }
  });

  it("editar conserva campos omitidos y limita vigencia", () => {
    expect(esquemaEditarCotizacion.parse({ version: VERSION, asunto: "B" })).toEqual({ version: VERSION, asunto: "B" });
    for (const vigenciaDias of [0, 1.5, 36501, "15"]) expect(esquemaEditarCotizacion.safeParse({ version: VERSION, vigenciaDias }).success).toBe(false);
  });

  it("rechazar exige motivo y acepta aprobación o vencimiento", () => {
    expect(esquemaResponder.safeParse({ version: VERSION, resultado: "RECHAZADA", motivo: " " }).success).toBe(false);
    expect(esquemaResponder.parse({ version: VERSION, resultado: "RECHAZADA", motivo: " Precio " }).motivo).toBe("Precio");
    expect(esquemaResponder.safeParse({ version: VERSION, resultado: "VENCIDA" }).success).toBe(true);
    expect(esquemaResponder.safeParse({ version: VERSION, resultado: "APROBADA", referenciaAprobacion: "Correo del cliente" }).success).toBe(true);
  });

  it("aprobar exige referencia de 3 a 200 caracteres y elimina espacios exteriores", () => {
    for (const referenciaAprobacion of [undefined, "  ", "ab", "a".repeat(201)]) {
      expect(esquemaResponder.safeParse({ version: VERSION, resultado: "APROBADA", referenciaAprobacion }).success).toBe(false);
    }
    for (const referenciaAprobacion of ["abc", "a".repeat(200)]) {
      expect(esquemaResponder.parse({ version: VERSION, resultado: "APROBADA", referenciaAprobacion: ` ${referenciaAprobacion} ` })
        .referenciaAprobacion).toBe(referenciaAprobacion);
    }
  });

  it("solicitar ajustes exige motivo de 3 a 500 caracteres y permite filtrar el estado", () => {
    for (const motivoAjuste of [undefined, "  ", "ab", "a".repeat(501)]) {
      expect(esquemaResponder.safeParse({ version: VERSION, resultado: "AJUSTE_SOLICITADO", motivoAjuste }).success).toBe(false);
    }
    for (const motivoAjuste of ["abc", "a".repeat(500)]) {
      expect(esquemaResponder.parse({ version: VERSION, resultado: "AJUSTE_SOLICITADO", motivoAjuste: ` ${motivoAjuste} ` })
        .motivoAjuste).toBe(motivoAjuste);
    }
    expect(esquemaConsultaCotizaciones.parse({ estado: "AJUSTE_SOLICITADO" }).estado).toBe("AJUSTE_SOLICITADO");
  });

  it("items aceptan catálogo y personalizado e ignoran sus montos enviados", () => {
    const entrada = esquemaReemplazarItems.parse({ version: VERSION, items: [{ ...catalogo, importe: "999" }, personalizado] });
    expect(entrada.items).toEqual([catalogo, personalizado]);
  });

  it("rechaza identidades repetidas y acepta conjunto vacío", () => {
    expect(esquemaReemplazarItems.safeParse({ version: VERSION, items: [{ ...catalogo, itemId: ID }, { ...catalogo, itemId: ID }] }).success).toBe(false);
    expect(esquemaReemplazarItems.parse({ version: VERSION, items: [] }).items).toEqual([]);
  });

  it("líneas permiten MATERIAL opcional, MANO_OBRA y TERCERO con cadenas", () => {
    const lineas = [
      { tipo: "MATERIAL", descripcion: "Vinil", unidad: "m2", cantidad: "2", mermaPct: "5", materialId: ID },
      { tipo: "MANO_OBRA", descripcion: "Diseño", unidad: "h", horas: "3", tarifa: "100" },
      { tipo: "TERCERO", descripcion: "Traslado", unidad: "servicio", costo: "200" },
    ];
    expect(esquemaReemplazarItems.safeParse({ version: VERSION, items: [{ ...personalizado, lineas }] }).success).toBe(true);
    expect(esquemaReemplazarItems.safeParse({ version: VERSION, items: [{ ...catalogo, cantidad: 2 }] }).success).toBe(false);
  });

  it("consulta limita paginación y valida filtros", () => {
    expect(esquemaConsultaCotizaciones.parse({})).toEqual({ archivadas: "false", pagina: 1, porPagina: 20 });
    for (const entrada of [{ pagina: "-1" }, { pagina: "100001" }, { porPagina: "101" }, { estado: "OTRO" }, { archivadas: "sí" }]) {
      expect(esquemaConsultaCotizaciones.safeParse(entrada).success).toBe(false);
    }
    expect(esquemaConsultaCotizaciones.parse({ cliente: ID, archivadas: "todas", pagina: "2" }).pagina).toBe(2);
  });

  it("parámetros vacíos no introducen filtros", () => {
    expect(objetoDeParametros(new URLSearchParams("q=%20&estado=&pagina=2"))).toEqual({ pagina: "2" });
    expect(objetoDeParametros({ q: [" Prueba ", "otro"], estado: undefined })).toEqual({ q: "Prueba" });
  });
});

describe("cotizaciones: fechas de Managua", () => {
  it("antes de las seis UTC corresponde al día anterior", () => {
    expect(hoyManagua(new Date("2026-10-07T05:59:59.999Z"))).toBe("2026-10-06");
    expect(hoyManagua(new Date("2026-10-07T06:00:00.000Z"))).toBe("2026-10-07");
  });
  it("suma vigencia como fechas de calendario incluyendo cambio de año", () => {
    expect(sumarDias("2026-12-25", 15).toISOString()).toBe("2027-01-09T00:00:00.000Z");
  });
});
