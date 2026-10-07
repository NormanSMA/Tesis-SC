import type { listarBitacora, obtenerTrazabilidad } from "./service";

export type ListaBitacora = Awaited<ReturnType<typeof listarBitacora>>;
export type EventoTrazabilidad = ListaBitacora["datos"][number];
export type TrazabilidadOrden = Awaited<ReturnType<typeof obtenerTrazabilidad>>;
