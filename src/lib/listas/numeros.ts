const COMPACTO = new Intl.NumberFormat("es-NI", { notation: "compact", maximumFractionDigits: 1 });

/** Umbral desde el que un número se muestra compacto (1,2 M). El valor completo va en title y aria-label. */
export const UMBRAL_COMPACTO = 1_000_000;

export function formatearCompacto(valor: number): string {
  return COMPACTO.format(valor);
}

/** Recorta una serie a las mayores n-1 y agrupa el resto en "Otros" cuando supera el máximo. */
export function agruparOtros<T extends { valor: number }>(
  serie: T[],
  maximo: number,
  crearOtros: (valor: number) => T,
): T[] {
  if (serie.length <= maximo) return serie;
  const ordenada = [...serie].sort((a, b) => b.valor - a.valor);
  const mayores = ordenada.slice(0, maximo - 1);
  const resto = ordenada.slice(maximo - 1).reduce((suma, fila) => suma + fila.valor, 0);
  return [...mayores, crearOtros(resto)];
}

/** Porcentaje acotado a [0, 100] para dibujar barras y anillos; el texto puede mostrar el real. */
export function porcentajeVisible(valor: number, total: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(Math.max((valor / total) * 100, 0), 100);
}
