import type { TotalesCotizacion, UnidadCobro, TipoLineaCosto } from "@/core/costeo";
import type { ESTADOS } from "./schema";

export type EstadoCotizacion = (typeof ESTADOS)[number];
export type LineaDto = {
  id: string; secuencia: number; tipo: TipoLineaCosto; descripcion: string; materialId: string | null;
  unidad: string; cantidad: string; costoUnitario: string; mermaPct: string; importe: string;
};
export type ItemDto = {
  id: string; secuencia: number; tipo: "CATALOGO" | "PERSONALIZADO"; productoId: string | null;
  categoriaId: string; descripcion: string; unidadCobro: UnidadCobro; cantidad: string;
  ancho: string | null; alto: string | null; precioUnitario: string; costoTotal: string | null;
  margenPct: string | null; importe: string; lineas: LineaDto[]; productoActivo: boolean | null;
};
export type ClienteCotizacion = {
  id: string; nombre: string; ruc: string | null; contactoPrincipal: string | null;
  telefono: string | null; correo: string | null; direccion: string | null; activo: boolean;
};
export type CotizacionDto = TotalesCotizacion & {
  id: string; numero: string; clienteId: string; cliente: ClienteCotizacion; estado: EstadoCotizacion;
  asunto: string | null; condiciones: string | null; cotizacionOrigenId: string | null; moneda: string; tipoCambio: string;
  vigenciaDias: number; fechaEmision: string | null; fechaVencimiento: string | null;
  fechaRespuesta: string | null; motivoRechazo: string | null; archivada: boolean;
  version: number; motivoAjuste: string | null; referenciaAprobacion: string | null;
  usuarioAprobacionId: string | null; usuarioAprobacion: { id: string; nombre: string } | null;
  creadoEn: string; actualizadoEn: string; items: ItemDto[]; avisos: string[];
};
export type CotizacionFila = Omit<CotizacionDto, "items" | "avisos">;
export type ListaCotizaciones = { datos: CotizacionFila[]; total: number; pagina: number; porPagina: number };
export type ProductoSelector = {
  id: string; codigo: string; nombre: string; categoriaId: string; categoria: string;
  unidadCobro: UnidadCobro; precioBase: string;
};
export type MaterialSelector = { id: string; codigo: string; nombre: string; unidad: string; costoPromedio: string };
export type SelectoresEditor = {
  productos: ProductoSelector[]; materiales: MaterialSelector[]; categorias: { id: string; nombre: string }[];
};
