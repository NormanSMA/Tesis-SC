import { describe, expect, it } from "vitest";
import type { EstadoEtapa, EstadoOrden } from "@/generated/prisma/enums";
import { accionesDisponibles, type PermisosEtapas } from "@/modules/produccion/componentes/accionesDisponibles";

const estados: EstadoEtapa[] = ["PENDIENTE", "EN_CURSO", "COMPLETADA", "OMITIDA"];
const planificacion = [["asignar", "fechas", "omitir"], ["asignar", "fechas"], [], ["asignar", "restaurar"]];
const ejecucion = [["iniciar"], ["completar"], [], []];
const permisos: PermisosEtapas[] = Array.from({ length: 8 }, (_, mascara) => ({
  planificar: Boolean(mascara & 1), ejecutar: Boolean(mascara & 2), avanzar: Boolean(mascara & 4),
}));
const casos = estados.flatMap((estadoEtapa) => permisos.flatMap((permiso) => [false, true].flatMap((soloEjecucion) =>
  (["PENDIENTE", "EN_PRODUCCION"] as const).map((estadoOrden) => ({ estadoEtapa, estadoOrden, permisos: permiso, soloEjecucion })))));

describe("acciones de etapa: permisos y planificación", () => {
  it.each(casos)("$estadoEtapa en $estadoOrden con $permisos y solo ejecución $soloEjecucion", (entrada) => {
    const indice = estados.indexOf(entrada.estadoEtapa);
    const esperadas = new Set<string>();
    if (entrada.permisos.planificar && !entrada.soloEjecucion) {
      for (const accion of planificacion[indice]) esperadas.add(accion);
    }
    if (entrada.permisos.ejecutar) {
      for (const accion of ejecucion[indice]) esperadas.add(accion);
    }
    if (entrada.estadoOrden === "PENDIENTE" && !entrada.permisos.avanzar) esperadas.delete("iniciar");
    const acciones = accionesDisponibles(Object.freeze({ ...entrada, permisos: Object.freeze(entrada.permisos) }));
    expect(acciones).not.toBeNull();
    expect(Object.entries(acciones!).filter(([, visible]) => visible).map(([accion]) => accion).sort())
      .toEqual([...esperadas].sort());
  });
});

describe("acciones de etapa: órdenes que no admiten cambios", () => {
  const terminales: EstadoOrden[] = ["LISTA", "ENTREGADA", "CERRADA", "CANCELADA"];
  it.each(terminales)("oculta el componente en %s", (estadoOrden) => {
    for (const estadoEtapa of estados) {
      expect(accionesDisponibles({ estadoEtapa, estadoOrden,
        permisos: { planificar: true, ejecutar: true, avanzar: true } })).toBeNull();
    }
  });
});
