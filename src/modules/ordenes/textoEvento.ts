import type { EventoTimeline } from "@/components/comunes/Timeline";
import { ESTADOS } from "@/components/comunes/estados";
import type { EventoOrden } from "./tipos";

const ACCIONES: Record<string, string> = { CONVERTIR_EN_ORDEN: "convirtió la cotización en orden",
  CREAR: "creó una etapa", EDITAR: "editó la orden", ASIGNAR_RESPONSABLE: "asignó el responsable", CAMBIAR_ESTADO: "cambió el estado",
  CONSUMIR_MATERIAL: "registró un consumo de material", DEVOLVER_MATERIAL: "registró una devolución de material" };
const CAMPOS: Record<string, string> = { responsableId: "Responsable", fechaEntrega: "Fecha de entrega", especificaciones: "Especificaciones" };

function detalleEvento(evento: EventoOrden): string | undefined {
  const detalle = evento.detalle && typeof evento.detalle === "object" && !Array.isArray(evento.detalle) ? evento.detalle : {};
  const partes: string[] = [];
  if (evento.estadoNuevo) {
    const maquina = evento.entidad === "ETAPA_ORDEN" ? ESTADOS.etapa : ESTADOS.orden;
    const anterior = evento.estadoAnterior ? maquina[evento.estadoAnterior]?.etiqueta ?? evento.estadoAnterior : "Creación";
    partes.push(`${anterior} → ${maquina[evento.estadoNuevo]?.etiqueta ?? evento.estadoNuevo}`);
  }
  if (typeof detalle.nombre === "string") partes.push(detalle.nombre);
  if (typeof detalle.motivo === "string") partes.push(`Motivo: ${detalle.motivo}`);
  if (typeof detalle.cantidad === "string") partes.push(`Cantidad: ${detalle.cantidad}`);
  for (const [campo, etiqueta] of Object.entries(CAMPOS)) {
    const cambio = detalle[campo];
    if (cambio && typeof cambio === "object" && !Array.isArray(cambio)) {
      partes.push(`${etiqueta}: ${cambio.anterior ?? "(vacío)"} → ${cambio.nuevo ?? "(vacío)"}`);
    }
  }
  return partes.length ? partes.join(". ") : undefined;
}

export function aEventoTimeline(evento: EventoOrden): EventoTimeline {
  return { id: evento.id, instante: evento.creadoEn, actor: evento.actor,
    accion: ACCIONES[evento.accion] ?? evento.accion, detalle: detalleEvento(evento) };
}
