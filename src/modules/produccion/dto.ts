import type { Area } from "@/generated/prisma/client";
import type { EtapaOrdenDto } from "@/modules/ordenes/tipos";
import type { EtapaGuardada, PlantillaGuardada } from "./repo";
import type { AreaDto, PlantillaDto } from "./tipos";

export function aEtapaDto(etapa: EtapaGuardada): EtapaOrdenDto {
  return { id: etapa.id, secuencia: etapa.secuencia, nombre: etapa.nombre, estado: etapa.estado, area: etapa.area,
    responsable: etapa.responsable, observaciones: etapa.observaciones, actualizadoEn: etapa.actualizadoEn.toISOString(),
    fechaInicioPlan: etapa.fechaInicioPlan?.toISOString().slice(0, 10) ?? null,
    fechaFinPlan: etapa.fechaFinPlan?.toISOString().slice(0, 10) ?? null,
    fechaInicioReal: etapa.fechaInicioReal?.toISOString() ?? null, fechaFinReal: etapa.fechaFinReal?.toISOString() ?? null };
}
export function aAreaDto(area: Area): AreaDto {
  return { id: area.id, nombre: area.nombre, activo: area.activo, actualizadoEn: area.actualizadoEn.toISOString() };
}
export function aPlantillaDto(plantilla: PlantillaGuardada): PlantillaDto {
  return { id: plantilla.id, categoriaId: plantilla.categoriaId, area: plantilla.area, secuencia: plantilla.secuencia,
    nombre: plantilla.nombre, activo: plantilla.activo, actualizadoEn: plantilla.actualizadoEn.toISOString() };
}
