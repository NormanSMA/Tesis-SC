import { expect, it } from "vitest";
import { ACCION_TEXTO, ENTIDAD_TEXTO, textoEstado, textoValor } from "@/modules/trazabilidad/etiquetas";
import { ACCIONES, ENTIDADES } from "@/modules/trazabilidad/schema";

it.each(ACCIONES)("traduce la acción %s", (accion) => {
  expect(ACCION_TEXTO[accion]).toBeTruthy(); expect(ACCION_TEXTO[accion]).not.toBe(accion);
});
it.each(ENTIDADES)("traduce la entidad %s", (entidad) => {
  expect(ENTIDAD_TEXTO[entidad]).toBeTruthy(); expect(ENTIDAD_TEXTO[entidad]).not.toBe(entidad);
});
it.each([
  ["BORRADOR", "Borrador"], ["ENVIADA", "Enviada"], ["APROBADA", "Aprobada"], ["RECHAZADA", "Rechazada"],
  ["VENCIDA", "Vencida"], ["PENDIENTE", "Pendiente"], ["EN_PRODUCCION", "En producción"], ["LISTA", "Lista"],
  ["ENTREGADA", "Entregada"], ["CERRADA", "Cerrada"], ["CANCELADA", "Cancelada"], ["EN_CURSO", "En curso"],
  ["COMPLETADA", "Completada"], ["OMITIDA", "Omitida"], ["ACTIVO", "Activo"], ["ARCHIVADO", "Archivado"],
])("traduce el estado %s", (estado, texto) => { expect(textoEstado(estado)).toBe(texto); });
it("no muestra estados desconocidos ni estados ausentes", () => {
  expect(textoEstado("ENUM_DESCONOCIDO")).toBe("Estado no disponible"); expect(textoEstado(null)).toBeNull();
});
it("traduce tipos, perfiles y unidades", () => {
  expect(textoValor("ADMIN")).toBe("Administración"); expect(textoValor("M2")).toBe("m²");
  expect(textoValor("EMPRESA")).toBe("Empresa");
});
