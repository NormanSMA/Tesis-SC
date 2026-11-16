import { can, exigir } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";
import { manejar, ok } from "@/lib/http";
import { buscarClientesSelector } from "@/modules/cotizaciones/repo";

export const GET = manejar({}, async ({ req, actor }) => {
  if (!can(actor, "cotizacion:gestionar")) exigir(actor, "cotizacion:ver");
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length > 200) {
    throw new AppError({ codigo: "VALIDACION", mensaje: "La búsqueda admite hasta 200 caracteres.", status: 422 });
  }
  return ok(await buscarClientesSelector(q));
});
