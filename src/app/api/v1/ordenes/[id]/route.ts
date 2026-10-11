import { can, exigir } from "@/core/autorizacion";
import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaEditarOrden } from "@/modules/ordenes/schema";
import { editarOrden, leerIdOrden, obtenerOrden } from "@/modules/ordenes/service";

export const GET = manejar({ permiso: "orden:ver" }, async ({ params, actor }) =>
  ok(await obtenerOrden(leerIdOrden(params.id), actor)),
);
export const PATCH = manejar({}, async ({ req, actor, params }) => {
  if (!can(actor, "orden:gestionar")) exigir(actor, "produccion:planificar");
  return ok(await editarOrden(leerIdOrden(params.id), await leerJson(req, esquemaEditarOrden), actor));
});
