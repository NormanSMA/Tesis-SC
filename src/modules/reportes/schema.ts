import { z } from "zod";

export const NOMBRES_REPORTES = ["cotizaciones-por-estado", "existencias", "carga-por-operario", "ordenes-por-etapa"] as const;
export type NombreReporte = typeof NOMBRES_REPORTES[number];
export const esquemaNombre = z.enum(NOMBRES_REPORTES);
const fecha = z.iso.date({ error: "Ingrese una fecha válida con formato AAAA-MM-DD." })
  .refine((valor) => !valor.startsWith("0000"), "Ingrese un año mayor que cero.").optional();

export const esquemaPeriodo = z.object({ desde: fecha, hasta: fecha }).superRefine((periodo, contexto) => {
  if (!periodo.desde || !periodo.hasta) return;
  if (periodo.desde > periodo.hasta) {
    contexto.addIssue({ code: "custom", path: ["hasta"], message: "Hasta debe ser igual o posterior a desde." });
    return;
  }
  const limite = new Date(`${periodo.desde}T00:00:00Z`);
  if (Number.isNaN(limite.getTime())) return;
  const mes = limite.getUTCMonth();
  limite.setUTCFullYear(limite.getUTCFullYear() + 5);
  if (limite.getUTCMonth() !== mes) limite.setUTCDate(0);
  if (limite.getUTCFullYear() > 9999) return;
  if (periodo.hasta > limite.toISOString().slice(0, 10)) {
    contexto.addIssue({ code: "custom", path: ["hasta"], message: "El periodo no puede superar cinco años." });
  }
});

export const esquemaConsulta = esquemaPeriodo.safeExtend({
  formato: z.enum(["json", "csv", "xlsx"], { error: "Seleccione JSON, CSV o Excel." }).default("json"),
  texto: z.string().trim().max(200, "Admite hasta 200 caracteres.").optional(),
  soloAlertas: z.enum(["true", "false"], { error: "Seleccione un filtro de alertas válido." }).default("false"),
  area: z.uuid({ error: "Seleccione un área válida." }).transform((valor) => valor.toLowerCase()).optional(),
});
export type ConsultaReporte = z.output<typeof esquemaConsulta>;
