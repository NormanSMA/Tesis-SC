import { leerJson, manejar, ok } from "@/lib/http";
import { leerClave } from "@/modules/inventario/idempotencia";
import { esquemaAjuste } from "@/modules/inventario/schema";
import { registrarAjuste } from "@/modules/inventario/service";

export const POST = manejar({ permiso: "inventario:ajustar" }, async ({ req, actor }) => {
  const clave = leerClave(req.headers.get("Idempotency-Key"));
  const datos = await registrarAjuste(await leerJson(req, esquemaAjuste), actor, clave);
  return ok(datos, datos.repetida ? 200 : 201);
});
