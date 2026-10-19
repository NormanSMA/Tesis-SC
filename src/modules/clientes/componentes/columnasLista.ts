import { COLUMNAS_OPCIONALES, leerColumnas, type ColumnaOpcional } from "../columnas";

/** Sin elección guardada, la lista muestra todos los datos: contacto y correo son parte del diseño base. */
export const COLUMNAS_LISTA_POR_DEFECTO: readonly ColumnaOpcional[] = COLUMNAS_OPCIONALES;

export function columnasDeLista(cookie: string | undefined): ColumnaOpcional[] {
  return cookie === undefined ? [...COLUMNAS_LISTA_POR_DEFECTO] : leerColumnas(cookie);
}
