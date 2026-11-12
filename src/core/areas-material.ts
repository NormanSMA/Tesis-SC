import type { AreaMaterial } from "@/generated/prisma/enums";

export const AREAS_MATERIAL = ["CORTE_LASER", "IMPRESION_DIGITAL", "ACABADO", "TALLER"] as const;

const NOMBRES: Record<AreaMaterial, string> = {
  CORTE_LASER: "Grabado y Corte Láser",
  IMPRESION_DIGITAL: "Impresión Digital",
  ACABADO: "Acabado",
  TALLER: "Taller",
};

export function nombreAreaMaterial(area?: AreaMaterial | null) {
  return area ? NOMBRES[area] : "Sin clasificar";
}
