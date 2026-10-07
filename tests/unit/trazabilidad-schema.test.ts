import { expect, it } from "vitest";
import { esquemaConsultaBitacora, leerConsulta, leerId, limitesManagua } from "@/modules/trazabilidad/schema";

it("aplica paginación predeterminada y limpia texto", () => {
  expect(esquemaConsultaBitacora.parse({ texto: "  trabajo  " })).toEqual({ texto: "trabajo", pagina: 1, porPagina: 20 });
});
it.each([
  { pagina: "0" }, { pagina: "1.5" }, { porPagina: "101" }, { porPagina: "0" }, { entidad: "OTRA" }, { accion: "BORRAR" },
  { usuario: "invalido" }, { desde: "2026-02-30" }, { hasta: "ayer" }, { desde: "2026-10-10", hasta: "2026-10-09" },
  { texto: "a".repeat(201) }, { orden: "a".repeat(21) },
])("rechaza filtros inválidos %j", (consulta) => { expect(esquemaConsultaBitacora.safeParse(consulta).success).toBe(false); });
it("acepta todos los filtros y fechas iguales", () => {
  expect(esquemaConsultaBitacora.safeParse({ entidad: "COTIZACION", accion: "EDITAR", usuario: "00000000-0000-4000-8000-000000000001",
    orden: "OT-2026-0001", cotizacion: "COT-2026-0001", desde: "2026-10-06", hasta: "2026-10-06", pagina: "2", porPagina: "5" }).success).toBe(true);
});
it("incluye todo el día de Managua mediante límite final exclusivo", () => {
  const limites = limitesManagua({ desde: "2026-10-06", hasta: "2026-10-06" });
  expect(limites.gte?.toISOString()).toBe("2026-10-06T06:00:00.000Z");
  expect(limites.lt?.toISOString()).toBe("2026-10-07T06:00:00.000Z");
});
it("normaliza parámetros vacíos y responde 422 ante errores", () => {
  expect(leerConsulta(new URLSearchParams("entidad=&pagina=2")).pagina).toBe(2);
  expect(() => leerConsulta(new URLSearchParams("desde=2026-02-30"))).toThrow("Hay parámetros con errores");
  expect(() => leerId("no-uuid")).toThrow("identificador");
});
