import { manejar, ok } from "@/lib/http";
import { leerVersionCambioEstado } from "@/modules/clientes/cuerpo";
import { archivarCliente, leerIdCliente } from "@/modules/clientes/service";

export const POST = manejar({ permiso: "cliente:gestionar" }, async ({ req, actor, params }) => {
  const id = leerIdCliente(params.id);
  return ok(await archivarCliente(id, await leerVersionCambioEstado(req), actor));
});
