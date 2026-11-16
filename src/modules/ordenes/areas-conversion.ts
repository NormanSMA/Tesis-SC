const AREAS = [
  ["Diseño Gráfico", "Diseño y artes gráficas"],
  ["Grabado y Corte Láser", "Corte y láser"],
  ["Impresión Digital", "Impresión"],
  ["Bordado y Serigrafía"],
  ["Acabado", "Acabados", "Despacho", "Instalación"],
  ["Taller", "Carpintería y metalmecánica", "Electricidad y LED"],
] as const;

export const nombresAreasConversion = AREAS.flatMap((nombres) => [...nombres]);

export function nombresEquivalentesArea(nombre: string) {
  return AREAS.find((nombres) => nombres.some((opcion) => opcion === nombre)) ?? [nombre];
}

export function nombreOficialArea(nombre: string) {
  return nombresEquivalentesArea(nombre)[0];
}

export function ordenarAreasConversion(areas: { id: string; nombre: string }[]) {
  return AREAS.flatMap(([nombre, anterior]) => {
    const area = areas.find((fila) => fila.nombre === nombre) ?? areas.find((fila) => fila.nombre === anterior);
    return area ? [{ id: area.id, nombre }] : [];
  });
}
