export type ValorReporte = string | number | null;
export type FilaReporte = Record<string, ValorReporte>;
export type ReporteDto = {
  filas: FilaReporte[];
  totales: FilaReporte;
  generadoEn: string;
};
export type ColumnaReporte = { campo: string; encabezado: string; tipo: "texto" | "numero" | "decimal" };
