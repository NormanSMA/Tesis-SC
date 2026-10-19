import type { Orden } from "@/lib/listas/orden";

export const CAMPOS_ORDEN_MATERIAL = ["nombre", "creadoEn", "existencia"] as const;
export type CampoOrdenMaterial = (typeof CAMPOS_ORDEN_MATERIAL)[number];
export const CAMPOS_ORDEN_MOVIMIENTO = ["creadoEn"] as const;
export type CampoOrdenMovimiento = (typeof CAMPOS_ORDEN_MOVIMIENTO)[number];

export const ORDEN_MATERIAL_DEFECTO: Orden<CampoOrdenMaterial> = { campo: "nombre", direccion: "asc" };
export const ORDEN_MOVIMIENTO_DEFECTO: Orden<CampoOrdenMovimiento> = { campo: "creadoEn", direccion: "desc" };

/** Opciones del menú "Ordenar" (valor `campo:direccion`). La primera es la de por defecto. */
export const OPCIONES_ORDEN_MATERIAL = [
  { valor: "nombre:asc", etiqueta: "Nombre A-Z" },
  { valor: "nombre:desc", etiqueta: "Nombre Z-A" },
  { valor: "creadoEn:desc", etiqueta: "Más recientes" },
  { valor: "creadoEn:asc", etiqueta: "Más antiguos" },
  { valor: "existencia:asc", etiqueta: "Menor existencia" },
];
export const OPCIONES_ORDEN_MOVIMIENTO = [
  { valor: "creadoEn:desc", etiqueta: "Más recientes" },
  { valor: "creadoEn:asc", etiqueta: "Más antiguos" },
];
