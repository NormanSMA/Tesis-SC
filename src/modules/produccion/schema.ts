import { z } from "zod";

const id = z.uuid({ error: "Seleccione un registro válido." }).transform((valor) => valor.toLowerCase());
const nombre = z.string().trim().min(1, "Indique el nombre.").max(80, "Admite hasta 80 caracteres.");
const fecha = z.iso.date({ error: "Ingrese una fecha válida con formato AAAA-MM-DD." }).nullable();
export const version = z.iso.datetime({ offset: true, error: "Falta la versión. Recargue los datos." });
const motivo = z.string().trim().min(5, "Indique un motivo de al menos 5 caracteres.").max(10000);
export const esquemaVersion = z.object({ version });
export const esquemaAgregarEtapa = z.object({ areaId: id, nombre });
export const esquemaEditarEtapa = z.object({ version, responsableId: id.nullable().optional(),
  fechaInicioPlan: fecha.optional(), fechaFinPlan: fecha.optional() }).refine(
  (entrada) => !entrada.fechaInicioPlan || !entrada.fechaFinPlan || entrada.fechaFinPlan >= entrada.fechaInicioPlan,
  { path: ["fechaFinPlan"], message: "El fin no puede ser anterior al inicio." },
);
export const esquemaOmitirEtapa = z.object({ version, motivo });
export const esquemaRetrabajo = esquemaAgregarEtapa.extend({ version, motivo });
export const esquemaCrearArea = z.object({ nombre });
export const esquemaEditarArea = esquemaCrearArea.extend({ version });
const secuencia = z.number().int().min(1).max(1000000);
export const esquemaCrearPlantilla = z.object({ areaId: id, nombre, secuencia: secuencia.optional() });
export const esquemaEditarPlantilla = z.object({ version, areaId: id.optional(), nombre: nombre.optional(), secuencia: secuencia.optional() });
export const esquemaTablero = z.object({ area: id.optional(), responsable: id.optional(),
  estado: z.enum(["PENDIENTE", "EN_CURSO"]).optional(), q: z.string().trim().max(200).optional() });
export type EntradaAgregarEtapa = z.output<typeof esquemaAgregarEtapa>;
export type EntradaEditarEtapa = z.output<typeof esquemaEditarEtapa>;
export type EntradaVersion = z.output<typeof esquemaVersion>;
export type EntradaOmitirEtapa = z.output<typeof esquemaOmitirEtapa>;
export type EntradaRetrabajo = z.output<typeof esquemaRetrabajo>;
export type EntradaCrearArea = z.output<typeof esquemaCrearArea>;
export type EntradaEditarArea = z.output<typeof esquemaEditarArea>;
export type EntradaCrearPlantilla = z.output<typeof esquemaCrearPlantilla>;
export type EntradaEditarPlantilla = z.output<typeof esquemaEditarPlantilla>;
export type ConsultaTablero = z.output<typeof esquemaTablero>;
