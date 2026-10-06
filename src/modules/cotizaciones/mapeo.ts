import type { EntradaLinea } from "@/core/costeo";
import type { EntradaLineaEditor } from "./schema";
import type { LineaDto } from "./tipos";

export function aLineaMotor(linea: EntradaLineaEditor): EntradaLinea {
  if (linea.tipo === "MATERIAL") return { tipo: linea.tipo, cantidad: linea.cantidad,
    costoUnitario: linea.costoUnitario ?? "", mermaPct: linea.mermaPct };
  if (linea.tipo === "MANO_OBRA") return { tipo: linea.tipo, horas: linea.horas, tarifa: linea.tarifa };
  return { tipo: linea.tipo, costo: linea.costo };
}

export function aEntradaLinea(linea: LineaDto): EntradaLineaEditor {
  const base = { lineaId: linea.id, descripcion: linea.descripcion, unidad: linea.unidad };
  if (linea.tipo === "MATERIAL") return { ...base, tipo: linea.tipo, materialId: linea.materialId,
    cantidad: linea.cantidad, costoUnitario: linea.costoUnitario, mermaPct: linea.mermaPct };
  if (linea.tipo === "MANO_OBRA") return { ...base, tipo: linea.tipo, horas: linea.cantidad, tarifa: linea.costoUnitario };
  return { ...base, tipo: linea.tipo, costo: linea.costoUnitario };
}
