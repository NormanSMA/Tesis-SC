import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaVersion } from "@/modules/inventario/schema";
import { cambiarActivoMaterial, leerIdMaterial } from "@/modules/inventario/service";

export const POST = manejar({ permiso: "material:gestionar" }, async ({ req, params, actor }) =>
  ok(await cambiarActivoMaterial({ id: leerIdMaterial(params.id), ...(await leerJson(req, esquemaVersion)), activo: false }, actor)));
