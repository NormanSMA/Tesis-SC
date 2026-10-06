import { leerJson, manejar, ok } from "@/lib/http";
import { crearCategoria, listarCategorias } from "@/modules/catalogo/categorias";
import { leerConsulta } from "@/modules/catalogo/cuerpo";
import { esquemaConsultaCategorias, esquemaCrearCategoria } from "@/modules/catalogo/schema";

export const GET = manejar({ permiso: "catalogo:ver" }, async ({ req }) =>
  ok(await listarCategorias(leerConsulta(new URL(req.url).searchParams, esquemaConsultaCategorias))));
export const POST = manejar({ permiso: "catalogo:gestionar" }, async ({ req, actor }) =>
  ok(await crearCategoria(await leerJson(req, esquemaCrearCategoria), actor), 201));
