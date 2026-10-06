import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaCambioEstado } from "@/modules/ordenes/schema";
import { entregarOrden, leerIdOrden } from "@/modules/ordenes/service";

export const POST = manejar({ permiso: "orden:entregar" }, async ({ req, actor, params }) =>
  ok(await entregarOrden(leerIdOrden(params.id), (await leerJson(req, esquemaCambioEstado)).version, actor)),
);
