// La siembra escribe en la salida estándar sin console.log: la regla de lint solo admite warn y error.
export function escribir(linea = ""): void {
  process.stdout.write(`${linea}\n`);
}

export function tabla(filas: string[][]): string[] {
  const anchos = filas[0].map((_, columna) => Math.max(...filas.map((fila) => fila[columna].length)));
  return filas.map((fila) => fila.map((celda, columna) => celda.padEnd(anchos[columna])).join("  ").trimEnd());
}
