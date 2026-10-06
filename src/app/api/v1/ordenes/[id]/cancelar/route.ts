import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaCancelarOrden } from "@/modules/ordenes/schema";
import { cancelarOrden, leerIdOrden } from "@/modules/ordenes/service";

export const POST = manejar({ permiso: "orden:cancelar" }, async ({ req, actor, params }) =>
  ok(await cancelarOrden(leerIdOrden(params.id), await leerJson(req, esquemaCancelarOrden), actor)),
);
