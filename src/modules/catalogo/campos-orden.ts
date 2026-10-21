export const CAMPOS_ORDEN_PRODUCTO = ["nombre", "precio", "creadoEn"] as const;
export type CampoOrdenProducto = (typeof CAMPOS_ORDEN_PRODUCTO)[number];
