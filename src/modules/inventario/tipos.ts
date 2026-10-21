import type { Orden } from "@/lib/listas/orden";
import type { CampoOrdenMaterial, CampoOrdenMovimiento } from "./campos-orden";

export {
  CAMPOS_ORDEN_MATERIAL, CAMPOS_ORDEN_MOVIMIENTO, type CampoOrdenMaterial, type CampoOrdenMovimiento,
} from "./campos-orden";

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
