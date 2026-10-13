export type TipoImportacion = "clientes" | "materiales";

export type ErrorFila = { fila: number; mensaje: string };
export type FilaCsv = { fila: number; datos: Record<string, string> };
export type AnalisisCsv = { filas: FilaCsv[]; errores: ErrorFila[]; total: number };
export type ResultadoFila = {
  fila: number;
  estado: "VALIDA" | "CREADA" | "DUPLICADA" | "ERROR";
  mensaje?: string;
};

export type ResultadoImportacion = {
  total: number;
  validas: FilaCsv[];
  errores: ErrorFila[];
  duplicados: ErrorFila[];
  creadas: number;
  omitidasDuplicadas: number;
  conError: number;
  filas: ResultadoFila[];
  confirmado: boolean;
};

export const COLUMNAS = {
  clientes: ["nombre", "tipo", "ruc", "contactoPrincipal", "telefono", "correo", "direccion", "notas"],
  materiales: ["codigo", "nombre", "unidad", "descripcion", "stockMinimo", "costoPromedio"],
} as const;

export const LIMITE_FILAS = 500;
export const LIMITE_CSV_BYTES = 1_000_000;
