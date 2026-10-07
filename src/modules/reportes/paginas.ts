import { objetoDeParametros } from "@/modules/inventario/schema";
import { esquemaConsulta, esquemaNombre, type ConsultaReporte } from "./schema";

export function leerFiltrosPagina(parametros: Record<string, string | string[] | undefined>) {
  const entrada = objetoDeParametros(parametros);
  const nombre = esquemaNombre.safeParse(entrada.nombre ?? "cotizaciones-por-estado");
  const consulta = esquemaConsulta.safeParse({ ...entrada, formato: "json" });
  const campos = consulta.success ? undefined : Object.fromEntries(consulta.error.issues.map((problema) => [problema.path.join("."), problema.message]));
  return { nombre: nombre.success ? nombre.data : "cotizaciones-por-estado" as const,
    consulta: consulta.success ? consulta.data : { ...esquemaConsulta.parse({}),
      desde: typeof entrada.desde === "string" ? entrada.desde : undefined,
      hasta: typeof entrada.hasta === "string" ? entrada.hasta : undefined } as ConsultaReporte,
    valido: nombre.success && consulta.success, campos };
}
export function enlaceExportacion(nombre: string, consulta: ConsultaReporte) {
  const parametros = new URLSearchParams();
  for (const [campo, valor] of Object.entries(consulta)) if (valor !== undefined && valor !== "") parametros.set(campo, valor);
  parametros.set("formato", "csv");
  return `/api/v1/reportes/${nombre}?${parametros}`;
}
