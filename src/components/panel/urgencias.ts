import { CircleAlert, Clock, PackageMinus, Pause, Timer, TriangleAlert, UserRoundX, MessageSquareMore, type LucideIcon } from "lucide-react";

import type { UrgenciaFeed } from "@/modules/panel/tipos";

type DefinicionUrgencia = {
  etiqueta: string;
  tono: "advertencia" | "peligro" | "info";
  icono: LucideIcon;
};

export const URGENCIAS: Record<UrgenciaFeed, DefinicionUrgencia> = {
  SIN_RESPUESTA: { etiqueta: "Sin respuesta", tono: "advertencia", icono: MessageSquareMore },
  POR_VENCER: { etiqueta: "Por vencer", tono: "advertencia", icono: Timer },
  AJUSTE_SOLICITADO: { etiqueta: "Ajuste solicitado", tono: "info", icono: CircleAlert },
  ORDEN_ATRASADA: { etiqueta: "Atrasada", tono: "peligro", icono: TriangleAlert },
  SIN_RESPONSABLE: { etiqueta: "Sin responsable", tono: "advertencia", icono: UserRoundX },
  BAJO_MINIMO: { etiqueta: "Bajo mínimo", tono: "peligro", icono: PackageMinus },
  ETAPA_ATRASADA: { etiqueta: "Etapa atrasada", tono: "peligro", icono: Clock },
  ETAPA_DETENIDA: { etiqueta: "Etapa detenida", tono: "advertencia", icono: Pause },
};
