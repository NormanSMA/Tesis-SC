import { describe, expect, it } from "vitest";

import { aCotizacionDeCliente, aEventoActividad } from "@/modules/clientes/dto";
import { aEventoTimeline } from "@/modules/clientes/textoEvento";
import type { EventoActividad } from "@/modules/clientes/tipos";

function evento(accion: string, detalle: Record<string, unknown> = {}): EventoActividad {
  return {
    id: "e1",
    accion,
    instante: "2026-10-06T13:00:00.000Z",
    actor: "Valentina Castro",
    estadoAnterior: null,
    estadoNuevo: null,
    detalle,
  };
}

describe("aEventoTimeline", () => {
  it("redacta cada acción en pasado, con el actor aparte", () => {
    expect(aEventoTimeline(evento("CREAR")).accion).toBe("creó el cliente");
    expect(aEventoTimeline(evento("EDITAR")).accion).toBe("editó el cliente");
    expect(aEventoTimeline(evento("ARCHIVAR")).accion).toBe("archivó el cliente");
    expect(aEventoTimeline(evento("REACTIVAR")).accion).toBe("reactivó el cliente");
    expect(aEventoTimeline(evento("CREAR")).actor).toBe("Valentina Castro");
  });

  it("describe cada campo editado con su valor anterior y el nuevo", () => {
    const resultado = aEventoTimeline(
      evento("EDITAR", {
        cambios: {
          telefono: { anterior: "8888", nuevo: "7777" },
          tipo: { anterior: "PERSONA", nuevo: "EMPRESA" },
          notas: { anterior: null, nuevo: "Cliente frecuente" },
        },
      }),
    );
    expect(resultado.detalle).toBe(
      "Teléfono: «8888» → «7777»; Tipo: «Persona» → «Empresa»; Notas: (vacío) → «Cliente frecuente»",
    );
  });

  it("acorta los valores largos", () => {
    const largo = "x".repeat(200);
    const detalle = aEventoTimeline(evento("EDITAR", { cambios: { notas: { anterior: null, nuevo: largo } } })).detalle;
    expect(detalle).toContain("…»");
    expect((detalle ?? "").length).toBeLessThan(100);
  });

  it("no inventa detalle cuando falta o tiene otra forma", () => {
    expect(aEventoTimeline(evento("EDITAR")).detalle).toBeUndefined();
    expect(aEventoTimeline(evento("EDITAR", { cambios: "texto" })).detalle).toBeUndefined();
    expect(aEventoTimeline(evento("CREAR", { nombre: "X" })).detalle).toBeUndefined();
  });

  it("muestra el nombre de la acción si es desconocida", () => {
    expect(aEventoTimeline(evento("OTRA")).accion).toBe("otra");
  });
});

describe("mapeos del historial", () => {
  const total = { toFixed: (decimales: number) => (1234.5).toFixed(decimales) };

  it("la cotización enviada usa fechaEmision tal cual, sin corrimiento de día", () => {
    const fila = aCotizacionDeCliente({
      id: "c",
      numero: "COT-2026-0001",
      asunto: null, moneda: "NIO",
      estado: "ENVIADA",
      total,
      fechaEmision: new Date("2026-10-01T00:00:00.000Z"),
      creadoEn: new Date("2026-09-30T20:00:00.000Z"),
    });
    expect(fila).toMatchObject({ fecha: "2026-10-01", total: "1234.50", asunto: null });
  });

  it("el borrador usa la fecha de creación en hora de Managua", () => {
    const fila = aCotizacionDeCliente({
      id: "c",
      numero: "COT-2026-0002",
      asunto: "Rótulo", moneda: "NIO",
      estado: "BORRADOR",
      total,
      fechaEmision: null,
      creadoEn: new Date("2026-10-06T03:00:00.000Z"),
    });
    expect(fila.fecha).toBe("2026-10-05");
  });

  it("un borrador con fechaEmision informada usa la fecha de creación", () => {
    const fila = aCotizacionDeCliente({
      id: "c",
      numero: "COT-2026-0003",
      asunto: null, moneda: "NIO",
      estado: "BORRADOR",
      total,
      fechaEmision: new Date("2026-09-01T00:00:00.000Z"),
      creadoEn: new Date("2026-10-06T15:00:00.000Z"),
    });
    expect(fila.fecha).toBe("2026-10-06");
  });

  it("un detalle que no es objeto se entrega como objeto vacío", () => {
    const base = { id: "e", accion: "CREAR", creadoEn: new Date(), estadoAnterior: null, estadoNuevo: null, usuario: { nombre: "A" } };
    expect(aEventoActividad({ ...base, detalle: null }).detalle).toEqual({});
    expect(aEventoActividad({ ...base, detalle: { a: 1 } }).detalle).toEqual({ a: 1 });
  });
});
