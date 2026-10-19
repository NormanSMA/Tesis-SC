// Lista blanca de campos ordenables. Sin dependencias: la usan schema.ts y tipos.ts sin crear un ciclo.
export const CAMPOS_ORDEN_COTIZACION = ["creadoEn", "numero", "cliente", "total", "vencimiento"] as const;
export type CampoOrdenCotizacion = (typeof CAMPOS_ORDEN_COTIZACION)[number];
