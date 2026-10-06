import { manejar } from "@/lib/http";
import { leerConsulta } from "@/modules/inventario/consulta";
import { esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import { listarMovimientos } from "@/modules/inventario/service";

export const GET = manejar({ permiso: "inventario:ver" }, async ({ req, actor }) =>
  Response.json(await listarMovimientos(leerConsulta(req, esquemaConsultaMovimientos), actor)));
