import { CERO, comparar, formatear, leerDecimal, restar } from "@/core/decimal";

export function alertaMaterial(material: { activo: boolean; existencia: string; stockMinimo: string }) {
  const existencia = leerDecimal(material.existencia)!;
  const minimo = leerDecimal(material.stockMinimo)!;
  if (!material.activo || comparar(minimo, CERO) <= 0 || comparar(existencia, minimo) > 0) return null;
  return comparar(existencia, CERO) === 0 ? "Sin existencia" : "Stock bajo";
}
export function cantidadAjuste(entrada: { direccion: "AUMENTAR" | "DISMINUIR"; cantidad: string }) {
  const valor = leerDecimal(entrada.cantidad)!;
  return formatear(entrada.direccion === "DISMINUIR" ? restar(CERO, valor) : valor, 3);
}
export function pendienteEstimado(estimado: string, neto: string) {
  const pendiente = restar(leerDecimal(estimado)!, leerDecimal(neto)!);
  return formatear(comparar(pendiente, CERO) > 0 ? pendiente : CERO, 3);
}
export function limitesFecha(consulta: { desde?: string; hasta?: string }) {
  const desde = consulta.desde ? new Date(`${consulta.desde}T00:00:00-06:00`) : undefined;
  const hasta = consulta.hasta ? new Date(`${consulta.hasta}T00:00:00-06:00`) : undefined;
  if (hasta) hasta.setUTCDate(hasta.getUTCDate() + 1);
  return { gte: desde, lt: hasta };
}
