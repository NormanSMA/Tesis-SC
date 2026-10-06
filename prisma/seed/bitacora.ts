import type { Prisma } from "../../src/generated/prisma/client";
import type { ColaBitacora, EventoBitacora } from "./tipos";

export type EntradaEvento = Omit<EventoBitacora, "detalle"> & { detalle?: Prisma.InputJsonObject };

export function registrar(cola: ColaBitacora, evento: EntradaEvento): void {
  cola.eventos.push({ ...evento, detalle: evento.detalle ?? {} });
}
