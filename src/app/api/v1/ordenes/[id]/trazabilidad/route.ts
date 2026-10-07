import { manejar, ok } from "@/lib/http";
import { leerId } from "@/modules/trazabilidad/schema";
import { obtenerTrazabilidad } from "@/modules/trazabilidad/service";

export const GET = manejar({ permiso: "orden:ver" }, async ({ params, actor }) =>
  ok(await obtenerTrazabilidad(leerId(params.id), actor)));
