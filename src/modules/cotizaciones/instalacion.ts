import { CERO, formatear, leerDecimal, multiplicar, sumar } from "@/core/decimal";
import { convertirDesdeCordobas } from "@/core/moneda";
import type { TotalesCotizacion } from "@/core/costeo";
import type { EntradaCrearCotizacion } from "./schema";
import type { Cotizacion } from "@/generated/prisma/client";

type OpcionesInstalacion = { actual?: Cotizacion; tipoCambio: string; tarifaNio: string };

export function costoInstalacion(manoObra: string, km: string | null, tarifa: string | null) {
  const mano = leerDecimal(manoObra || "0") ?? CERO;
  const distancia = km ? leerDecimal(km) : null;
  const tarifaDecimal = tarifa ? leerDecimal(tarifa) : null;
  return formatear(sumar(mano, distancia && tarifaDecimal ? multiplicar(distancia, tarifaDecimal) : CERO), 2);
}

export function datosInstalacion(entrada: EntradaCrearCotizacion["instalacion"], opciones: OpcionesInstalacion) {
  const { actual, tipoCambio, tarifaNio } = opciones;
  if (entrada === undefined && actual) {
    return { instalacionKm: actual.instalacionKm?.toFixed(3) ?? null,
      instalacionTarifa: actual.instalacionTarifa?.toFixed(2) ?? null, instalacionDestino: actual.instalacionDestino,
      instalacionManoObra: actual.instalacionManoObra.toFixed(2), instalacionTotal: actual.instalacionTotal.toFixed(2) };
  }
  const instalacionKm = entrada?.km ?? null;
  const instalacionTarifa = instalacionKm ? actual?.instalacionTarifa?.toFixed(2) ?? convertirDesdeCordobas(tarifaNio, tipoCambio, 2) : null;
  const instalacionManoObra = entrada?.manoObra ?? "0";
  return { instalacionKm, instalacionTarifa, instalacionDestino: instalacionKm ? entrada?.destino ?? null : null,
    instalacionManoObra, instalacionTotal: costoInstalacion(instalacionManoObra, instalacionKm, instalacionTarifa) };
}

export function conInstalacion(totales: TotalesCotizacion, instalacion: string) {
  return { ...totales, total: formatear(sumar(leerDecimal(totales.total)!, leerDecimal(instalacion)!), 2) };
}
