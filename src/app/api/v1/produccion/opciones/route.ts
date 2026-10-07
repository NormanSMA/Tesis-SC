import { manejar, ok } from "@/lib/http";
import { opcionesProduccion } from "@/modules/produccion/service";

export const GET = manejar({ permiso: "produccion:ver" }, async ({ actor }) =>
  ok(await opcionesProduccion(actor)),
);

