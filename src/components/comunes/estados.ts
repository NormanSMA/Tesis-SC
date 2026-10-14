import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CirclePlay,
  CircleX,
  Clock,
  FilePen,
  Lock,
  MessageSquareWarning,
  OctagonX,
  PackageCheck,
  Send,
  TimerOff,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { BrazoRobot } from "@/components/layout/IconoBrazoRobot";

export type TipoEstado = "cotizacion" | "orden" | "etapa" | "stock";

export type TonoEstado =
  | "neutro"
  | "neutroFuerte"
  | "acento"
  | "info"
  | "exito"
  | "advertencia"
  | "peligro";

export type DefinicionEstado = { etiqueta: string; tono: TonoEstado; icono: LucideIcon };

// Cada estado lleva ícono y texto: el color nunca es el único portador del significado (WCAG 1.4.1).
export const ESTADOS: Record<TipoEstado, Record<string, DefinicionEstado>> = {
  cotizacion: {
    BORRADOR: { etiqueta: "Borrador", tono: "neutro", icono: FilePen },
    ENVIADA: { etiqueta: "Enviada", tono: "info", icono: Send },
    AJUSTE_SOLICITADO: { etiqueta: "Ajustes solicitados", tono: "advertencia", icono: MessageSquareWarning },
    APROBADA: { etiqueta: "Aprobada", tono: "exito", icono: CircleCheck },
    RECHAZADA: { etiqueta: "Rechazada", tono: "peligro", icono: CircleX },
    VENCIDA: { etiqueta: "Vencida", tono: "advertencia", icono: TimerOff },
  },
  orden: {
    PENDIENTE: { etiqueta: "Pendiente", tono: "neutro", icono: Clock },
    EN_PRODUCCION: { etiqueta: "En producción", tono: "info", icono: BrazoRobot },
    LISTA: { etiqueta: "Lista", tono: "acento", icono: PackageCheck },
    ENTREGADA: { etiqueta: "Entregada", tono: "exito", icono: Truck },
    CERRADA: { etiqueta: "Cerrada", tono: "neutroFuerte", icono: Lock },
    CANCELADA: { etiqueta: "Cancelada", tono: "peligro", icono: Ban },
  },
  etapa: {
    PENDIENTE: { etiqueta: "Pendiente", tono: "neutro", icono: CircleDashed },
    EN_CURSO: { etiqueta: "En curso", tono: "info", icono: CirclePlay },
    COMPLETADA: { etiqueta: "Completada", tono: "exito", icono: CircleCheck },
    OMITIDA: { etiqueta: "Omitida", tono: "neutro", icono: CircleMinus },
  },
  stock: {
    DISPONIBLE: { etiqueta: "Disponible", tono: "exito", icono: CircleCheck },
    BAJO_MINIMO: { etiqueta: "Bajo mínimo", tono: "advertencia", icono: TriangleAlert },
    AGOTADO: { etiqueta: "Agotado", tono: "peligro", icono: OctagonX },
  },
};
