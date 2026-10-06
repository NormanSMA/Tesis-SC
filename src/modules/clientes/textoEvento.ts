import type { EventoTimeline } from "@/components/comunes/Timeline";

import { ETIQUETA_TIPO, type TipoCliente } from "./schema";
import type { EventoActividad } from "./tipos";

const ETIQUETA_CAMPO: Record<string, string> = {
  nombre: "Nombre",
  tipo: "Tipo",
  ruc: "RUC",
  contactoPrincipal: "Contacto principal",
  telefono: "Teléfono",
  correo: "Correo",
  direccion: "Dirección",
  notas: "Notas",
};

const TEXTO_ACCION: Record<string, string> = {
  CREAR: "creó el cliente",
  EDITAR: "editó el cliente",
  ARCHIVAR: "archivó el cliente",
  REACTIVAR: "reactivó el cliente",
};

const LARGO_MAXIMO_VALOR = 60;

function valorLegible(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "(vacío)";
  const texto = campo === "tipo" ? (ETIQUETA_TIPO[valor as TipoCliente] ?? String(valor)) : String(valor);
  const corto = texto.length > LARGO_MAXIMO_VALOR ? `${texto.slice(0, LARGO_MAXIMO_VALOR - 3)}…` : texto;
  return `«${corto}»`;
}

function describirCambio(campo: string, cambio: unknown): string {
  const { anterior, nuevo } = (cambio ?? {}) as Record<string, unknown>;
  const etiqueta = ETIQUETA_CAMPO[campo] ?? campo;
  return `${etiqueta}: ${valorLegible(campo, anterior)} → ${valorLegible(campo, nuevo)}`;
}

function detalleDeEdicion(detalle: Record<string, unknown>): string | undefined {
  const cambios = detalle.cambios;
  if (typeof cambios !== "object" || cambios === null) return undefined;
  const lineas = Object.entries(cambios).map(([campo, cambio]) => describirCambio(campo, cambio));
  return lineas.length > 0 ? lineas.join("; ") : undefined;
}

export function aEventoTimeline(evento: EventoActividad): EventoTimeline {
  return {
    id: evento.id,
    instante: evento.instante,
    actor: evento.actor,
    accion: TEXTO_ACCION[evento.accion] ?? evento.accion.toLowerCase(),
    detalle: evento.accion === "EDITAR" ? detalleDeEdicion(evento.detalle) : undefined,
  };
}
