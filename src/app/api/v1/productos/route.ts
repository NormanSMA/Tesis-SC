import { leerJson, manejar, ok } from "@/lib/http";
import { leerConsulta } from "@/modules/catalogo/cuerpo";
import { esquemaConsultaProductos, esquemaCrearProducto } from "@/modules/catalogo/schema";
import { crearProducto, listarProductos } from "@/modules/catalogo/service";

export const GET = manejar({ permiso: "catalogo:ver" }, async ({ req }) =>
  Response.json(await listarProductos(leerConsulta(new URL(req.url).searchParams, esquemaConsultaProductos))));
export const POST = manejar({ permiso: "catalogo:gestionar" }, async ({ req, actor }) =>
  ok(await crearProducto(await leerJson(req, esquemaCrearProducto), actor), 201));
