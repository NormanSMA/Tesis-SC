import type { EstadoEtapa, EstadoOrden } from "@/generated/prisma/enums";

export type PermisosEtapas = { planificar: boolean; ejecutar: boolean; avanzar: boolean };

export function accionesDisponibles({ estadoEtapa, estadoOrden, permisos, soloEjecucion = false }: {
  estadoEtapa: EstadoEtapa; estadoOrden: EstadoOrden; permisos: PermisosEtapas; soloEjecucion?: boolean;
}) {
  if (!["PENDIENTE", "EN_PRODUCCION"].includes(estadoOrden)) return null;
  const planificar = permisos.planificar && !soloEjecucion;
  return {
    asignar: planificar && estadoEtapa !== "COMPLETADA",
    fechas: planificar && ["PENDIENTE", "EN_CURSO"].includes(estadoEtapa),
    iniciar: permisos.ejecutar && estadoEtapa === "PENDIENTE" && (estadoOrden !== "PENDIENTE" || permisos.avanzar),
    completar: permisos.ejecutar && estadoEtapa === "EN_CURSO",
    omitir: planificar && estadoEtapa === "PENDIENTE",
    restaurar: planificar && estadoEtapa === "OMITIDA",
  };
}
