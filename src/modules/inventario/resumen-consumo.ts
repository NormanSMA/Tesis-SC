type LineaConsumo = {
  clave: string;
  materialId: string;
  codigo: string;
  nombre: string;
  cantidad: string;
  unidad: string;
};

export type ResumenConsumo = Omit<LineaConsumo, "materialId">;

export function resumirConsumo(lineas: readonly LineaConsumo[]): ResumenConsumo[] {
  return lineas.filter((linea) => linea.materialId.trim() && linea.cantidad.trim())
    .map(({ clave, codigo, nombre, cantidad, unidad }) => ({ clave, codigo, nombre, cantidad, unidad }));
}
