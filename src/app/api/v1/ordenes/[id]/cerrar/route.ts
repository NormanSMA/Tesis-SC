import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaCambioEstado } from "@/modules/ordenes/schema";
import { cerrarOrden, leerIdOrden } from "@/modules/ordenes/service";

export const POST = manejar({ permiso: "orden:cerrar" }, async ({ req, actor, params }) =>
  ok(await cerrarOrden(leerIdOrden(params.id), (await leerJson(req, esquemaCambioEstado)).version, actor)),
);
