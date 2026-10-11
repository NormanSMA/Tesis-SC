import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { objetoDeParametros } from "@/modules/inventario/schema";
import { esquemaConsulta, esquemaNombre, type ConsultaReporte } from "./schema";

const REPORTES_CON_PERIODO = ["cotizaciones-por-estado", "carga-por-operario"];
function periodoPorDefecto(parametros: Record<string, unknown>, nombre: string, hoy: string) {
  const enviado = "desde" in parametros || "hasta" in parametros;
  if (enviado || !REPORTES_CON_PERIODO.includes(nombre)) return {};
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
}
export function leerFiltrosPagina(parametros: Record<string, string | string[] | undefined>, hoy = hoyManagua()) {
  const entrada = objetoDeParametros(parametros);
  const nombre = esquemaNombre.safeParse(entrada.nombre ?? "cotizaciones-por-estado");
  const periodo = periodoPorDefecto(parametros, nombre.success ? nombre.data : "", hoy);
  const consulta = esquemaConsulta.safeParse({ ...periodo, ...entrada, formato: "json" });
  const campos = consulta.success ? undefined : Object.fromEntries(consulta.error.issues.map((problema) => [problema.path.join("."), problema.message]));
  return { nombre: nombre.success ? nombre.data : "cotizaciones-por-estado" as const,
    consulta: consulta.success ? consulta.data : { ...esquemaConsulta.parse({}),
      desde: typeof entrada.desde === "string" ? entrada.desde : undefined,
      hasta: typeof entrada.hasta === "string" ? entrada.hasta : undefined } as ConsultaReporte,
    valido: nombre.success && consulta.success, campos };
}
export function enlaceExportacion(nombre: string, consulta: ConsultaReporte, formato: "csv" | "xlsx" = "csv") {
  const parametros = new URLSearchParams();
  for (const [campo, valor] of Object.entries(consulta)) if (valor !== undefined && valor !== "") parametros.set(campo, valor);
  parametros.set("formato", formato);
  return `/api/v1/reportes/${nombre}?${parametros}`;
}
