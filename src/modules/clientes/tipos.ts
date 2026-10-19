import type { TipoCliente } from "./schema";

export type ClienteDto = {
  id: string;
  codigoCliente: string;
  nombre: string;
  tipo: TipoCliente;
  ruc: string | null;
  contactoPrincipal: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  notas: string | null;
  activo: boolean;
  logoVersion: string | null;
  creadoEn: string;
  /** Instante ISO 8601 UTC. Es la versión que debe enviar el PATCH. */
  actualizadoEn: string;
};

export type ClienteFila = Pick<
  ClienteDto,
  "id" | "codigoCliente" | "nombre" | "tipo" | "ruc" | "contactoPrincipal" | "telefono" | "correo" | "activo" | "logoVersion"
> & {
  /** Solo viaja si el actor tiene cotizacion:ver. */
  cotizaciones?: number;
};

/** Lista blanca del parámetro orden=campo:direccion (R7). */
export { CAMPOS_ORDEN_CLIENTE, type CampoOrdenCliente } from "./campos-orden";
/** Conteos para las pastillas de tipo: mismos filtros (q, activo) sin el filtro de tipo. */
export type ConteosClientes = { todos: number; EMPRESA: number; PERSONA: number };

export type ListaClientes = {
  datos: ClienteFila[];
  total: number;
  pagina: number;
  porPagina: number;
  conteos: ConteosClientes;
};

export type CotizacionDeCliente = {
  id: string;
  numero: string;
  asunto: string | null;
  estado: string;
  total: string;
  moneda: string;
  /** AAAA-MM-DD: fechaEmision, o la fecha de creación mientras es BORRADOR. */
  fecha: string;
};

export type TrabajoDeCliente = {
  id: string;
  numero: string;
  estado: string;
  /** AAAA-MM-DD. */
  fechaEntrega: string;
};

export type SeccionLimitada<T> = {
  /** Total de registros del historial, aunque solo se devuelvan los más recientes. */
  total: number;
  items: T[];
};

export type ResumenCotizaciones = {
  cotizaciones: number;
  porEstado: Record<string, number>;
  /** Suma de los totales de las cotizaciones APROBADAS, como decimal en cadena. */
  totalAprobado: string;
};

export type EventoActividad = {
  id: string;
  accion: string;
  instante: string;
  actor: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  detalle: Record<string, unknown>;
};

export type FichaCliente = ClienteDto & {
  resumen?: ResumenCotizaciones;
  cotizaciones?: SeccionLimitada<CotizacionDeCliente>;
  trabajos?: SeccionLimitada<TrabajoDeCliente>;
  actividad: EventoActividad[];
};

export type CambioCampo = { anterior: string | null; nuevo: string | null };
