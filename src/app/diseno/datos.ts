import type { EventoTimeline } from "@/components/comunes/Timeline";

export type Muestra = { nombre: string; variable: string; hex: string; uso: string };

export const COLORES_BASE: Muestra[] = [
  { nombre: "Acento", variable: "--primary", hex: "#0F766E", uso: "Acciones primarias, enlace activo, foco" },
  { nombre: "Acento hover", variable: "--primary-hover", hex: "#115E59", uso: "Estado hover del acento" },
  { nombre: "Fondo de página", variable: "--background", hex: "#F8FAFC", uso: "Fondo general" },
  { nombre: "Superficie", variable: "--card", hex: "#FFFFFF", uso: "Tarjetas, tablas, menús" },
  { nombre: "Borde", variable: "--border", hex: "#E2E8F0", uso: "Separadores y contornos decorativos" },
  { nombre: "Borde de control", variable: "--input", hex: "#64748B", uso: "Contorno de campos (4.76:1)" },
  { nombre: "Texto", variable: "--foreground", hex: "#0F172A", uso: "Texto principal" },
  { nombre: "Texto secundario", variable: "--muted-foreground", hex: "#475569", uso: "Ayudas y metadatos" },
];

export const COLORES_ESTADO: Muestra[] = [
  { nombre: "Éxito", variable: "--success", hex: "#15803D", uso: "Aprobada, entregada, completada" },
  { nombre: "Advertencia", variable: "--warning", hex: "#B45309", uso: "Vencida, bajo mínimo" },
  { nombre: "Peligro", variable: "--danger", hex: "#B91C1C", uso: "Rechazada, cancelada, agotado, errores" },
  { nombre: "Información", variable: "--info", hex: "#1D4ED8", uso: "Enviada, en producción, en curso" },
];

export const ESCALA_TIPOGRAFICA = [
  { clase: "text-xs", tamano: "12 px", uso: "Metadatos, etiquetas de badge" },
  { clase: "text-sm", tamano: "14 px", uso: "Cuerpo de tablas y menús" },
  { clase: "text-base", tamano: "16 px", uso: "Formularios y texto general" },
  { clase: "text-xl", tamano: "20 px", uso: "Títulos de sección" },
  { clase: "text-2xl", tamano: "24 px", uso: "Título de página" },
  { clase: "text-3xl", tamano: "30 px", uso: "Valores de indicadores" },
];

export type FilaCotizacion = {
  id: string;
  numero: string;
  cliente: string;
  emision: string;
  vence: string;
  estado: string;
  total: string;
};

export const COTIZACIONES: FilaCotizacion[] = [
  { id: "1", numero: "COT-2026-0041", cliente: "Distribuidora Pacífico, S. A.", emision: "2026-10-01", vence: "2026-10-31", estado: "ENVIADA", total: "48250.5" },
  { id: "2", numero: "COT-2026-0040", cliente: "Clínica Dental Sonrisa", emision: "2026-09-29", vence: "2026-10-29", estado: "APROBADA", total: "12480" },
  { id: "3", numero: "COT-2026-0039", cliente: "Ferretería El Constructor", emision: "2026-09-24", vence: "2026-10-24", estado: "BORRADOR", total: "3590.75" },
  { id: "4", numero: "COT-2026-0038", cliente: "Colegio Nuevo Horizonte", emision: "2026-09-12", vence: "2026-10-12", estado: "RECHAZADA", total: "27900" },
  { id: "5", numero: "COT-2026-0037", cliente: "Café Volcán Masaya", emision: "2026-08-30", vence: "2026-09-29", estado: "VENCIDA", total: "9815.2" },
];

export const EVENTOS_BITACORA: EventoTimeline[] = [
  { id: "e1", instante: "2026-10-05T20:42:00Z", actor: "Ana Pérez", accion: "cambió la orden OT-2026-0018 a En producción.", detalle: "Primera etapa iniciada en el área de Impresión." },
  { id: "e2", instante: "2026-10-05T15:10:00Z", actor: "Luis Mejía", accion: "registró un consumo de material.", detalle: "Vinil adhesivo, 14.500 m2." },
  { id: "e3", instante: "2026-10-04T21:05:00Z", actor: "Carmen Rivas", accion: "aprobó la cotización COT-2026-0040." },
];
