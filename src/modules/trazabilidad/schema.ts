import { z } from "zod";
import { AppError } from "@/lib/errores";
import { esquemaOrden } from "@/lib/listas/orden";
import { objetoDeParametros } from "@/modules/ordenes/schema";

export const ENTIDADES = ["CLIENTE", "CATEGORIA", "AREA", "PRODUCTO", "MATERIAL", "COTIZACION", "ORDEN_TRABAJO",
  "ETAPA_ORDEN", "MOVIMIENTO_INVENTARIO", "USUARIO", "PERFIL_PERMISO", "CONFIGURACION"] as const;
export const ACCIONES = ["CREAR", "EDITAR", "CAMBIAR_ESTADO", "ASIGNAR_RESPONSABLE", "CONVERTIR_EN_ORDEN",
  "REGISTRAR_ENTRADA", "AJUSTAR_INVENTARIO", "CONSUMIR_MATERIAL", "DEVOLVER_MATERIAL", "ARCHIVAR", "REACTIVAR",
  "OTORGAR_PERMISO", "REVOCAR_PERMISO", "INICIAR_SESION", "INICIO_SESION_FALLIDO", "BLOQUEAR_CUENTA",
  "CERRAR_SESION", "CAMBIAR_CLAVE"] as const;
/** Lista blanca del parámetro ordenar=campo:direccion (`orden` ya filtra por número de orden). */
export const CAMPOS_ORDEN_BITACORA = ["creadoEn"] as const;
export const esquemaId = z.uuid({ error: "Seleccione un identificador válido." });
export const esquemaConsultaBitacora = z.object({
  entidad: z.enum(ENTIDADES).optional(), accion: z.enum(ACCIONES).optional(), usuario: esquemaId.optional(),
  orden: z.string().trim().min(1).max(20).optional(), cotizacion: z.string().trim().min(1).max(20).optional(),
  desde: z.iso.date().optional(), hasta: z.iso.date().optional(), texto: z.string().trim().max(200).optional(),
  ordenar: esquemaOrden(CAMPOS_ORDEN_BITACORA).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
}).refine((consulta) => !consulta.desde || !consulta.hasta || consulta.desde <= consulta.hasta,
  { path: ["hasta"], message: "La fecha final debe ser igual o posterior a la inicial." });
export type ConsultaBitacora = z.output<typeof esquemaConsultaBitacora>;

export function leerConsulta(parametros: URLSearchParams | Record<string, string | string[] | undefined>) {
  const lectura = esquemaConsultaBitacora.safeParse(objetoDeParametros(parametros));
  if (lectura.success) return lectura.data;
  throw new AppError({ codigo: "VALIDACION", mensaje: "Hay parámetros con errores.", status: 422,
    campos: Object.fromEntries(lectura.error.issues.map((problema) => [problema.path.join("."), problema.message])) });
}

export function leerId(valor: unknown): string {
  const lectura = esquemaId.safeParse(valor);
  if (lectura.success) return lectura.data;
  throw new AppError({ codigo: "VALIDACION", mensaje: "El identificador de orden es inválido.", status: 422 });
}

export function limitesManagua(consulta: Pick<ConsultaBitacora, "desde" | "hasta">) {
  const inicio = consulta.desde ? new Date(`${consulta.desde}T00:00:00-06:00`) : undefined;
  const fin = consulta.hasta ? new Date(`${consulta.hasta}T00:00:00-06:00`) : undefined;
  if (fin) fin.setUTCDate(fin.getUTCDate() + 1);
  return { gte: inicio, lt: fin };
}
