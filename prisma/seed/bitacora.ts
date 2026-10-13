import type { Prisma } from "../../src/generated/prisma/client";
import type { ColaBitacora, EventoBitacora } from "./tipos";

export type EntradaEvento = Omit<EventoBitacora, "detalle"> & { detalle?: Prisma.InputJsonObject };

export function registrar(cola: ColaBitacora, evento: EntradaEvento): void {
  cola.eventos.push({ ...evento, detalle: evento.detalle ?? {} });
}

export function cotizacionPorEscenario(cola: ColaBitacora, clave: string): string {
  const evento = cola.eventos.find((e) =>
    e.entidad === "COTIZACION" && e.accion === "CREAR" && (e.detalle as { clave?: string } | undefined)?.clave === clave,
  );
  if (!evento) throw new Error(`${clave}: el escenario de origen debe sembrarse antes de su versión corregida`);
  return evento.entidadId;
}
