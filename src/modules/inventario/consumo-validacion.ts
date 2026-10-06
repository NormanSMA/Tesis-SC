// Validación exacta de las líneas con los materiales ya bloqueados. Pura: recibe lo leído bajo bloqueo.
import { comparar } from "@/core/decimal";
import { cantidad3, leerCantidad, type LineaNormalizada, type OperacionLibro } from "./consumo-calculo";
import { errorDeLineas, type ErrorLinea } from "./consumo-errores";

export type MaterialBloqueado = {
  id: string; codigo: string; nombre: string; unidad: string; existencia: string; activo: boolean;
};

export type DatosValidacion = {
  operacion: OperacionLibro;
  lineas: LineaNormalizada[];
  materiales: ReadonlyMap<string, MaterialBloqueado>;
  // Consumido neto por la orden y material, solo para la devolución.
  netos: ReadonlyMap<string, string>;
};

function etiqueta(material: MaterialBloqueado): string {
  return `${material.codigo} ${material.nombre}`;
}

function errorConsumo(linea: LineaNormalizada, material: MaterialBloqueado): ErrorLinea | null {
  if (!material.activo) {
    return { indice: linea.indice, tipo: "archivado", campo: `lineas.${linea.indice}.materialId`,
      mensaje: `El material ${etiqueta(material)} está archivado y no admite consumos.` };
  }
  if (comparar(leerCantidad(linea.cantidad), leerCantidad(material.existencia)) > 0) {
    const disponible = cantidad3(material.existencia);
    return { indice: linea.indice, tipo: "insuficiente", campo: `lineas.${linea.indice}.cantidad`,
      mensaje: `Existencia insuficiente de ${etiqueta(material)}: solicitado ${linea.cantidad}, disponible ${disponible}.`,
      limite: disponible };
  }
  return null;
}

function errorDevolucion(linea: LineaNormalizada, material: MaterialBloqueado, neto: string): ErrorLinea | null {
  // Devolver a un material archivado dejaría existencia en un material fuera de las listas: se reactiva primero.
  if (!material.activo) {
    return { indice: linea.indice, tipo: "archivado", campo: `lineas.${linea.indice}.materialId`,
      mensaje: `El material ${etiqueta(material)} está archivado. Reactívelo para registrar la devolución.` };
  }
  if (comparar(leerCantidad(linea.cantidad), leerCantidad(neto)) <= 0) return null;
  const maximo = cantidad3(neto);
  return { indice: linea.indice, tipo: "excede", campo: `lineas.${linea.indice}.cantidad`,
    mensaje: `La devolución de ${etiqueta(material)} supera lo consumido por la orden: solicitado ${linea.cantidad}, máximo devolvible ${maximo}.`,
    limite: maximo };
}

/** Reúne los errores de todas las líneas antes de decidir: la persona corrige todo en un solo intento. */
export function validarLineas(datos: DatosValidacion): ErrorLinea[] {
  const errores: ErrorLinea[] = [];
  for (const linea of datos.lineas) {
    const material = datos.materiales.get(linea.materialId);
    const error = !material
      ? { indice: linea.indice, tipo: "inexistente" as const, campo: `lineas.${linea.indice}.materialId`, mensaje: "El material no existe." }
      : datos.operacion === "consumo"
        ? errorConsumo(linea, material)
        : errorDevolucion(linea, material, datos.netos.get(linea.materialId) ?? "0");
    if (error) errores.push(error);
  }
  return errores.sort((a, b) => a.indice - b.indice);
}

export function exigirLineasValidas(datos: DatosValidacion): void {
  const error = errorDeLineas(validarLineas(datos));
  if (error) throw error;
}
