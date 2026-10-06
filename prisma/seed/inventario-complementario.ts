// Movimientos que los JSON de datos no traen y que completan el libro con los cuatro tipos:
// dos ajustes por conteo físico (los registra gerencia, P-02) y la devolución de un sobrante de papel.
// Los materiales elegidos tienen existencia holgada: no cambian las alertas de stock.
export const AJUSTES_COMPLEMENTARIOS = [
  { material: "TAZ-BLA-01", cantidad: -4, diasAtras: 20, motivo: "Conteo físico: tazas quebradas en bodega." },
  { material: "ACR-TRA-01", cantidad: 1, diasAtras: 12, motivo: "Conteo físico: pliego hallado en el estante de retazos." },
];

export const DEVOLUCIONES_COMPLEMENTARIAS = [
  { escenario: "cot-aprobada-002", material: "PAP-COU-01", cantidad: 0.25, diasAtras: 3, hora: 15 },
];
