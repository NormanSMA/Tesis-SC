import { z } from "zod";

import { fueraDeRango, hoyManagua, rangoConsulta } from "@/core/fechas";

/** Fecha de filtro (desde/hasta): entre el año 2000 y un año después de hoy en Managua. */
export const esquemaFechaConsulta = z.iso.date({ error: "Ingrese una fecha válida con formato AAAA-MM-DD." })
  .refine((fecha) => !fueraDeRango(fecha, rangoConsulta(hoyManagua())),
    "Use una fecha entre el año 2000 y un año después de hoy.");

/** Atributos min y max del control de fecha de un filtro. */
export function limitesFiltroFecha() {
  const { minimo, maximo } = rangoConsulta(hoyManagua());
  return { min: minimo, max: maximo };
}

/**
 * Al teclear el año, el navegador emite valores intermedios (0002, 0020, 0202).
 * El filtro navega solo con una fecha vacía o dentro del rango.
 */
export function fechaFiltroNavegable(valor: string): boolean {
  return !valor || !fueraDeRango(valor, rangoConsulta(hoyManagua()));
}
