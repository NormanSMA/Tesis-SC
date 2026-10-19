/** Debajo de este margen sobre el precio, la tarjeta del producto avisa "Margen bajo". */
export const MARGEN_BAJO_PCT = 20;

/** Margen sobre el precio de venta. Nulo si falta el costo (sin permiso o sin dato) o el precio no es positivo. */
export function margenPct(precio: string, costo: string | null | undefined): number | null {
  if (costo === null || costo === undefined || costo === "") return null;
  const venta = Number(precio);
  const gasto = Number(costo);
  if (!Number.isFinite(venta) || !Number.isFinite(gasto) || venta <= 0) return null;
  return ((venta - gasto) / venta) * 100;
}

export function esMargenBajo(margen: number | null): boolean {
  return margen !== null && margen < MARGEN_BAJO_PCT;
}
