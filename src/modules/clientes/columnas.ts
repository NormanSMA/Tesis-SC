/** Columnas opcionales de la lista de clientes. «Nombre» siempre se muestra. */
export const COOKIE_COLUMNAS_CLIENTES = "tracore-columnas-clientes";

export const COLUMNAS_OPCIONALES = [
  "codigoCliente",
  "ruc",
  "tipo",
  "contactoPrincipal",
  "telefono",
  "correo",
  "cotizaciones",
] as const;

export type ColumnaOpcional = (typeof COLUMNAS_OPCIONALES)[number];

export const ETIQUETA_COLUMNA: Readonly<Record<ColumnaOpcional, string>> = {
  codigoCliente: "Código",
  ruc: "RUC",
  tipo: "Tipo",
  contactoPrincipal: "Contacto",
  telefono: "Teléfono",
  correo: "Correo",
  cotizaciones: "Cotizaciones",
};

export const COLUMNAS_POR_DEFECTO: readonly ColumnaOpcional[] = ["codigoCliente", "tipo", "cotizaciones"];

const VALIDAS = new Set<string>(COLUMNAS_OPCIONALES);

/** Lee la cookie: sin valor usa las columnas por defecto; ignora nombres desconocidos y conserva el orden fijo. */
export function leerColumnas(valor: string | undefined): ColumnaOpcional[] {
  if (valor === undefined) return [...COLUMNAS_POR_DEFECTO];
  const elegidas = new Set(valor.split(",").filter((nombre) => VALIDAS.has(nombre)));
  return COLUMNAS_OPCIONALES.filter((nombre) => elegidas.has(nombre));
}

export function serializarColumnas(columnas: readonly ColumnaOpcional[]): string {
  return COLUMNAS_OPCIONALES.filter((nombre) => columnas.includes(nombre)).join(",");
}

/** Sin permiso de ver cotizaciones, la columna de cotizaciones no se ofrece ni se muestra. */
export function columnasPermitidas(columnas: readonly ColumnaOpcional[], conCotizaciones: boolean): ColumnaOpcional[] {
  return columnas.filter((nombre) => nombre !== "cotizaciones" || conCotizaciones);
}

/** Guarda la elección en una cookie de un año. Solo se llama desde el navegador. */
export function guardarColumnas(columnas: readonly ColumnaOpcional[]): void {
  document.cookie = `${COOKIE_COLUMNAS_CLIENTES}=${serializarColumnas(columnas)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
