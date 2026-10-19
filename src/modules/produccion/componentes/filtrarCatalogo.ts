import type { ConteosCatalogo } from "./FiltrosCatalogo";

type Parametros = Record<string, string | string[] | undefined>;

const sinAcentos = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const texto = (valor: string | string[] | undefined) => (typeof valor === "string" ? valor.trim().slice(0, 200) : "");

/** Aplica búsqueda (q) y estado (activas, archivadas) de la URL a un catálogo pequeño. Los conteos ignoran ambos filtros. */
export function filtrarCatalogo<T extends { activo: boolean }>(
  elementos: T[], parametros: Parametros, textoDe: (elemento: T) => string,
): { filtradas: T[]; conteos: ConteosCatalogo } {
  const busqueda = sinAcentos(texto(parametros.q));
  const estado = texto(parametros.estado);
  const filtradas = elementos.filter((elemento) => {
    if (estado === "activas" && !elemento.activo) return false;
    if (estado === "archivadas" && elemento.activo) return false;
    return sinAcentos(textoDe(elemento)).includes(busqueda);
  });
  const activas = elementos.filter((elemento) => elemento.activo).length;
  return { filtradas, conteos: { todas: elementos.length, activas, archivadas: elementos.length - activas } };
}
