import type { AdvertenciaEstimado } from "@/core/consumo-estimado";
import type { EstadoEtapa, EstadoOrden, TipoCliente, TipoItem, TipoLineaCosto, UnidadCobro } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type ReferenciaOrden = { id: string; nombre: string };
export type ClienteOrden = ReferenciaOrden & { tipo: TipoCliente; telefono: string | null; correo: string | null;
  ruc?: string | null; direccion?: string | null };
export type OrdenFila = {
  id: string; numero: string; estado: EstadoOrden; categoria: ReferenciaOrden; responsable: ReferenciaOrden;
  cliente: ClienteOrden; cotizacion: { id: string; numero: string; asunto: string | null };
  fechaEntrega: string; atrasada: boolean; actualizadoEn: string; creadoEn: string;
};
export type ListaOrdenes = { datos: OrdenFila[]; total: number; pagina: number; porPagina: number };
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
  observaciones: string | null;
};
export type EventoOrden = {
  id: string; entidad: string; entidadId: string; accion: string; estadoAnterior: string | null; estadoNuevo: string | null;
  actor: string; creadoEn: string; detalle: Prisma.JsonValue;
};
export type DineroCotizacion = {
  moneda: string; subtotal: string; descuento: string; tasaImpuesto: string; impuesto: string; total: string; margenPct: string | null;
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
