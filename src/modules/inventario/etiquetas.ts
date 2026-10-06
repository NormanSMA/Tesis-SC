// Textos visibles de los valores enumerados, con tildes. Un valor desconocido se muestra tal cual.
export const ETIQUETA_UNIDAD: Record<string, string> = {
  UNIDAD: "Unidad", METRO: "Metro", M2: "m²", YARDA: "Yarda", PIE: "Pie", LITRO: "Litro", GALON: "Galón",
  KILOGRAMO: "Kilogramo", LIBRA: "Libra", PLIEGO: "Pliego", ROLLO: "Rollo",
};

export const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  ENTRADA: "Entrada", CONSUMO: "Consumo", DEVOLUCION: "Devolución", AJUSTE: "Ajuste",
};

export const ETIQUETA_ESTADO_ORDEN: Record<string, string> = {
  PENDIENTE: "Pendiente", EN_PRODUCCION: "En producción", LISTA: "Lista", ENTREGADA: "Entregada",
  CERRADA: "Cerrada", CANCELADA: "Cancelada",
};

export function etiquetar(mapa: Record<string, string>, valor: string): string {
  return mapa[valor] ?? valor;
}
