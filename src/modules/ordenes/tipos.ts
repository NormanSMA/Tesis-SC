import type { AdvertenciaEstimado } from "@/core/consumo-estimado";
import type { EstadoEtapa, EstadoOrden, TipoCliente, TipoItem, TipoLineaCosto, UnidadCobro } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type ReferenciaOrden = { id: string; nombre: string };
export type ClienteOrden = ReferenciaOrden & { codigoCliente: string; tipo: TipoCliente; telefono: string | null; correo: string | null;
  ruc?: string | null; direccion?: string | null };
export type OrdenFila = {
  id: string; numero: string; estado: EstadoOrden; categoria: ReferenciaOrden; responsable: ReferenciaOrden | null;
  cliente: ClienteOrden; cotizacion: { id: string; numero: string; asunto: string | null };
  fechaEntrega: string; atrasada: boolean; actualizadoEn: string; creadoEn: string;
  /** Avance de etapas para la barra de progreso: completadas sobre total sin contar omitidas. Opcional en la ficha. */
  avance?: { completadas: number; total: number };
};
/** Lista blanca del parámetro orden=campo:direccion (R7). */
export const CAMPOS_ORDEN_ORDENES = ["numero", "cliente", "fechaEntrega", "creadoEn"] as const;
export type CampoOrdenOrdenes = (typeof CAMPOS_ORDEN_ORDENES)[number];
/**
 * Conteos para las pastillas: mismos filtros q y cliente, sin estado, vencidas, responsable ni terminales.
 * activas = no CERRADA ni CANCELADA; atrasadas y sinResponsable se cuentan solo entre activas.
 */
export type ConteosOrdenes = Record<EstadoOrden, number> & { activas: number; atrasadas: number; sinResponsable: number };
export type ListaOrdenes = { datos: OrdenFila[]; total: number; pagina: number; porPagina: number; conteos: ConteosOrdenes };
export type LineaOrden = {
  id: string; secuencia: number; tipo: TipoLineaCosto; descripcion: string; unidad: string; cantidad: string;
  material: (ReferenciaOrden & { unidad: string }) | null; mermaPct: string; costoUnitario?: string; importe?: string;
};
export type ItemOrden = {
  id: string; secuencia: number; tipo: TipoItem; descripcion: string; categoria: ReferenciaOrden;
  unidadCobro: UnidadCobro; cantidad: string; ancho: string | null; alto: string | null; lineas: LineaOrden[];
  precioUnitario?: string; importe?: string; costoTotal?: string | null; margenPct?: string | null;
};
export type EtapaOrdenDto = {
  id: string; secuencia: number; nombre: string; estado: EstadoEtapa; area: ReferenciaOrden; responsable: ReferenciaOrden | null;
  fechaInicioPlan: string | null; fechaFinPlan: string | null; fechaInicioReal: string | null; fechaFinReal: string | null;
  observaciones: string | null; actualizadoEn: string;
};
export type EventoOrden = {
  id: string; entidad: string; entidadId: string; accion: string; estadoAnterior: string | null; estadoNuevo: string | null;
  actor: string; creadoEn: string; detalle: Prisma.JsonValue;
};
export type DineroCotizacion = {
  moneda: string; tipoCambio: string; subtotal: string; descuento: string; tasaImpuesto: string; impuesto: string; total: string; margenPct: string | null;
};
export type OrdenDto = OrdenFila & {
  especificaciones: string | null; fechaInicioReal: string | null; fechaEntregaReal: string | null;
  fechaCierre: string | null; motivoCancelacion: string | null;
  cotizacion: OrdenFila["cotizacion"] & Partial<DineroCotizacion>;
  items: ItemOrden[]; etapas: EtapaOrdenDto[];
  consumosEstimados: { id: string; material: ReferenciaOrden & { unidad: string }; cantidad: string; origen: string }[];
  eventos: EventoOrden[]; advertencias: AdvertenciaEstimado[];
};
export type OpcionesOrden = { responsables: ReferenciaOrden[]; categorias: (ReferenciaOrden & { etapas: number })[] };
export type PropuestaOrden = { cotizacionId: string; numero: string; cliente: string;
  categoriaId: string; especificaciones: string; orden: { id: string; numero: string } | null };
