export const CAMPOS_ORDEN_MATERIAL = ["nombre", "creadoEn", "existencia"] as const;
export type CampoOrdenMaterial = (typeof CAMPOS_ORDEN_MATERIAL)[number];
export const CAMPOS_ORDEN_MOVIMIENTO = ["creadoEn"] as const;
export type CampoOrdenMovimiento = (typeof CAMPOS_ORDEN_MOVIMIENTO)[number];
