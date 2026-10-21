export const CAMPOS_ORDEN_ORDENES = ["numero", "cliente", "fechaEntrega", "creadoEn"] as const;
export type CampoOrdenOrdenes = (typeof CAMPOS_ORDEN_ORDENES)[number];
