import { manejar } from "@/lib/http";
import { leerConsulta } from "@/modules/inventario/consulta";
import { esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import { leerIdMaterial, listarMovimientosMaterial } from "@/modules/inventario/service";

export const GET = manejar({ permiso: "inventario:ver" }, async ({ req, params, actor }) =>
  Response.json(await listarMovimientosMaterial(leerIdMaterial(params.id), leerConsulta(req, esquemaConsultaMovimientos), actor)));
