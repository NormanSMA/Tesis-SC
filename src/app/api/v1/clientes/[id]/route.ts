import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaEditarCliente } from "@/modules/clientes/schema";
import { editarCliente, leerIdCliente, obtenerFicha } from "@/modules/clientes/service";

export const GET = manejar({ permiso: "cliente:ver" }, async ({ actor, params }) =>
  ok(await obtenerFicha(leerIdCliente(params.id), actor)),
);

export const PATCH = manejar({ permiso: "cliente:gestionar" }, async ({ req, actor, params }) => {
  const id = leerIdCliente(params.id);
  const entrada = await leerJson(req, esquemaEditarCliente);
  return ok(await editarCliente(id, entrada, actor));
});
