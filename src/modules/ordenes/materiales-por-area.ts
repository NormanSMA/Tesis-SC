import { AREAS_MATERIAL, nombreAreaMaterial } from "@/core/areas-material";
import { nombresEquivalentesArea } from "./areas-conversion";
import type { AreaMaterial } from "@/generated/prisma/enums";

export function agruparMaterialesPorArea<T extends { areaProduccion: AreaMaterial | null }>(materiales: T[]) {
  return [...AREAS_MATERIAL, null].flatMap((area) => {
    const filas = materiales.filter(({ areaProduccion }) => areaProduccion === area);
    return filas.length ? [{ area, titulo: nombreAreaMaterial(area), filas }] : [];
  });
}

type EtapaConArea = { id: string; area: { nombre: string } };
type MaterialTrabajo = { nombre: string; areaProduccion: AreaMaterial | null };

/**
 * Reparte los materiales del trabajo entre las etapas de su área (por nombre oficial o equivalente).
 * Si dos etapas comparten área, ambas los muestran. Los que no tienen área, o cuya área no tiene etapa, quedan aparte.
 */
export function materialesPorEtapa(etapas: EtapaConArea[], materiales: MaterialTrabajo[]) {
  const porEtapa = new Map<string, string[]>();
  const asignados = new Set<MaterialTrabajo>();
  for (const etapa of etapas) {
    const nombres: readonly string[] = nombresEquivalentesArea(etapa.area.nombre);
    const propios = materiales.filter((material) => material.areaProduccion
      && nombres.includes(nombreAreaMaterial(material.areaProduccion)));
    propios.forEach((material) => asignados.add(material));
    porEtapa.set(etapa.id, propios.map(({ nombre }) => nombre));
  }
  return { porEtapa, sinEtapa: materiales.filter((material) => !asignados.has(material)).map(({ nombre }) => nombre) };
}
