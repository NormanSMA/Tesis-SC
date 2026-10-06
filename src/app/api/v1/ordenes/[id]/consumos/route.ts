import { exigir } from "@/core/autorizacion";
import { leerJson, manejar, ok } from "@/lib/http";
import { registrarConsumo } from "@/modules/inventario/consumo";
import { esquemaMovimientosOrden } from "@/modules/inventario/contrato-orden";
import { leerClave } from "@/modules/inventario/idempotencia";
import { obtenerResumenOrden } from "@/modules/inventario/resumen-orden";
import { leerIdOrden } from "@/modules/ordenes/errores";

export const GET = manejar({ permiso: "orden:ver" }, async ({ actor, params }) => {
  exigir(actor, "inventario:ver");
  return ok(await obtenerResumenOrden(leerIdOrden(params.id), actor));
});

export const POST = manejar({ permiso: "inventario:consumir" }, async ({ req, actor, params }) => {
  const ordenId = leerIdOrden(params.id);
  const clave = leerClave(req.headers.get("idempotency-key"));
  const entrada = await leerJson(req, esquemaMovimientosOrden);
  const respuesta = await registrarConsumo({ ordenId, entrada, clave, actor });
  return ok(respuesta, respuesta.repetida ? 200 : 201);
});
