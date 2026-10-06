import { leerJson, manejar, ok } from "@/lib/http";
import { leerClave } from "@/modules/inventario/idempotencia";
import { esquemaEntrada } from "@/modules/inventario/schema";
import { registrarEntrada } from "@/modules/inventario/service";

export const POST = manejar({ permiso: "inventario:entrada" }, async ({ req, actor }) => {
  const clave = leerClave(req.headers.get("Idempotency-Key"));
  const datos = await registrarEntrada(await leerJson(req, esquemaEntrada), actor, clave);
  return ok(datos, datos.repetida ? 200 : 201);
});
