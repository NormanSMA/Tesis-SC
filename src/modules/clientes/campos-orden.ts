// Lista blanca de campos ordenables. Sin dependencias: la usan schema.ts y tipos.ts sin crear un ciclo.
export const CAMPOS_ORDEN_CLIENTE = ["nombre", "codigo", "creadoEn"] as const;
export type CampoOrdenCliente = (typeof CAMPOS_ORDEN_CLIENTE)[number];
