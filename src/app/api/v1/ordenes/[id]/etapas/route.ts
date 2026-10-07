import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaAgregarEtapa } from "@/modules/produccion/schema";
import { obtenerEtapasOrden, agregarEtapa, leerId } from "@/modules/produccion/service";

export const GET = manejar({ permiso: "produccion:ver" }, async ({ params, actor }) =>
  ok(await obtenerEtapasOrden(leerId(params.id), actor)),
);

export const POST = manejar({ permiso: "produccion:planificar" }, async ({ params, req, actor }) =>
  ok(await agregarEtapa(leerId(params.id), await leerJson(req, esquemaAgregarEtapa), actor), 201),
);

