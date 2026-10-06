import { leerJson, manejar, ok } from "@/lib/http";
import { leerConsulta } from "@/modules/inventario/consulta";
import { esquemaConsultaMateriales, esquemaCrearMaterial } from "@/modules/inventario/schema";
import { crearMaterial, listarMateriales } from "@/modules/inventario/service";

export const GET = manejar({ permiso: "inventario:ver" }, async ({ req, actor }) =>
  Response.json(await listarMateriales(leerConsulta(req, esquemaConsultaMateriales), actor)));
export const POST = manejar({ permiso: "material:gestionar" }, async ({ req, actor }) =>
  ok(await crearMaterial(await leerJson(req, esquemaCrearMaterial), actor), 201));
