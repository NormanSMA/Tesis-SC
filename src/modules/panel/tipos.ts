import type { PerfilCodigo } from "@/core/permisos";

export type PerfilPanel = Exclude<PerfilCodigo, "ADMIN">;
export type Tendencia = { direccion: "sube" | "baja" | "igual"; texto: string };
/** Como se formatea y anima el valor numerico de un indicador. */
export type FormatoIndicador = "entero" | "moneda" | "porcentaje";
/** Comparacion con el periodo anterior. porcentaje es null cuando el anterior vale 0. */
export type ComparacionIndicador = { porcentaje: number | null; texto: string };
export type IndicadorPanel = {
  id: string; etiqueta: string; valor: string; contexto: string; destino: string;
  tendencia?: Tendencia; alerta?: boolean;
  /** Valor crudo para el conteo animado; null cuando no hay dato. */
  numero: number | null; formato: FormatoIndicador;
  comparacion?: ComparacionIndicador;
  /** Meta en la misma unidad que numero (ej. 70 para tasa de aprobacion). */
  meta?: number;
  /** Verdadero cuando bajar es bueno (atrasadas, sin responsable): invierte el color de la tendencia. */
  mejorSiBaja?: boolean;
};
export type UrgenciaFeed =
  | "SIN_RESPUESTA" | "POR_VENCER" | "AJUSTE_SOLICITADO" | "ORDEN_ATRASADA"
  | "SIN_RESPONSABLE" | "BAJO_MINIMO" | "ETAPA_ATRASADA" | "ETAPA_DETENIDA";
/** Fila del feed operativo. monto es null si el actor no tiene cotizacion:ver. */
export type FilaOperativaDto = {
  id: string; tipo: "cotizacion" | "orden" | "material" | "etapa";
  codigo: string; titulo: string; detalle: string;
  urgencia: UrgenciaFeed; gravedad: "alta" | "media";
  monto: string | null; moneda: "NIO" | "USD" | null;
  /** Fecha ISO de referencia: envio, vencimiento, entrega o inicio. */
  referencia: string;
  /** Dias de espera o atraso respecto de generadoEn; 0 o mas. */
  dias: number;
  destino: string;
};
/** Compatibilidad: el feed ahora usa FilaOperativaDto. */
export type AtencionPanel = FilaOperativaDto;
export type GraficoPanel = {
  titulo: string; subtitulo: string; tipo: "barras";
  datos: { clave?: string; etiqueta: string; valor: number; texto?: string; destacado?: boolean }[];
  nota?: { texto: string; destino: string };
};
export type PanelDto = {
  perfil: PerfilPanel; perfilesDisponibles: { codigo: PerfilPanel; nombre: string }[];
  generadoEn: string; titulo: string; pregunta: string; indicadores: IndicadorPanel[];
  grafico: GraficoPanel | null; atencion: FilaOperativaDto[]; atencionTotal: number;
};
export type ContenidoPanel = Pick<PanelDto, "titulo" | "pregunta" | "indicadores" | "grafico" | "atencion" | "atencionTotal">;
export type SerieConteo = { etiqueta: string; valor: number };
export type OrdenAtencion = { id: string; numero: string; dias: number; sinResponsable: boolean };
export type OperacionPanel = {
  pendientes: number; sinResponsable: number; enProduccion: number; atrasadas: number;
  entregas: number; accion: number; porEstado: SerieConteo[]; filas: OrdenAtencion[];
};
export type MaterialAtencion = { id: string; nombre: string; existencia: string; minimo: string; unidad: string };
export type InventarioPanel = { bajoMinimo: number; valor: string; filas: MaterialAtencion[] };
export type MesComercial = { mes: string; monto: string; aprobadas: number; respondidas: number };
export type ComercialPanel = {
  meses: MesComercial[]; enviadas: number; porVencer: number; atencionTotal: number;
  filas: { id: string; numero: string; estado: string; vencimiento: string | null }[];
  porEstado: SerieConteo[];
};
export type ProduccionPanel = {
  enCurso: number; pendientes: number; atrasadas: number; completadasHoy: number;
  atencionTotal: number; porDia: SerieConteo[];
  filas: { id: string; ordenId: string; nombre: string; numero: string; dias: number }[];
};
export type MovimientosPanel = { consumosHoy: number; movimientosSemana: number; semanas: SerieConteo[] };
