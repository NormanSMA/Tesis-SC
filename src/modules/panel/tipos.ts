import type { PerfilCodigo } from "@/core/permisos";

export type PerfilPanel = Exclude<PerfilCodigo, "ADMIN">;
export type Tendencia = { direccion: "sube" | "baja" | "igual"; texto: string };
export type IndicadorPanel = {
  id: string; etiqueta: string; valor: string; contexto: string; destino: string;
  tendencia?: Tendencia; alerta?: boolean;
};
export type AtencionPanel = {
  id: string; titulo: string; detalle: string; gravedad: "alta" | "media"; destino: string;
};
export type GraficoPanel = {
  titulo: string; subtitulo: string; tipo: "barras";
  datos: { etiqueta: string; valor: number; texto?: string; destacado?: boolean }[];
  nota?: { texto: string; destino: string };
};
export type PanelDto = {
  perfil: PerfilPanel; perfilesDisponibles: { codigo: PerfilPanel; nombre: string }[];
  generadoEn: string; titulo: string; pregunta: string; indicadores: IndicadorPanel[];
  grafico: GraficoPanel | null; atencion: AtencionPanel[]; atencionTotal: number;
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
