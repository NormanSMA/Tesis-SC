export type TipoNotificacion = "ETAPA_DISPONIBLE" | "ETAPA_ATRASADA" | "ORDEN_NUEVA" | "ORDEN_ATRASADA"
  | "ORDEN_LISTA" | "STOCK_BAJO" | "COTIZACION_APROBADA";

export type Notificacion = {
  /** Cambia cuando el aviso vuelve a ser relevante; el navegador lo usa para no repetir el sonido. */
  id: string; tipo: TipoNotificacion; titulo: string; detalle: string; destino: string;
  /** Instante ISO desde el que el aviso es relevante. */
  fecha: string; alerta: boolean;
};

export type CentroNotificaciones = { datos: Notificacion[]; noLeidas: number; leidasHasta: string | null };
