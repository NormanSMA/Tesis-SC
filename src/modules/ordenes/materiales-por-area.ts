import { AREAS_MATERIAL, nombreAreaMaterial } from "@/core/areas-material";
import type { AreaMaterial } from "@/generated/prisma/enums";

export function agruparMaterialesPorArea<T extends { areaProduccion: AreaMaterial | null }>(materiales: T[]) {
  return [...AREAS_MATERIAL, null].flatMap((area) => {
    const filas = materiales.filter(({ areaProduccion }) => areaProduccion === area);
    return filas.length ? [{ area, titulo: nombreAreaMaterial(area), filas }] : [];
  });
}
