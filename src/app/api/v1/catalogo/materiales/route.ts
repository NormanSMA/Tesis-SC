import { manejar, ok } from "@/lib/http";
import { listarMateriales } from "@/modules/catalogo/categorias";
import { leerConsulta } from "@/modules/catalogo/cuerpo";
import { esquemaConsultaMateriales } from "@/modules/catalogo/schema";

export const GET = manejar({ permiso: "inventario:ver" }, async ({ req }) =>
  ok(await listarMateriales(leerConsulta(new URL(req.url).searchParams, esquemaConsultaMateriales))));
