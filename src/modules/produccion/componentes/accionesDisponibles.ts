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
    // "Hecho" sustituye a Iniciar y Completar: una etapa pendiente se completa en un solo paso.
    hecho: permisos.ejecutar && (estadoEtapa === "EN_CURSO"
      || (estadoEtapa === "PENDIENTE" && (estadoOrden !== "PENDIENTE" || permisos.avanzar))),
    omitir: planificar && estadoEtapa === "PENDIENTE",
    restaurar: planificar && estadoEtapa === "OMITIDA",
  };
}
