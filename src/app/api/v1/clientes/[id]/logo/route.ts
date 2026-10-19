import { manejar, ok } from "@/lib/http";
import { leerContenidoLogo, obtenerLogo, quitarLogo, subirLogo } from "@/modules/clientes/logo";
import { leerIdCliente } from "@/modules/clientes/service";

export const GET = manejar({ permiso: "cliente:ver" }, async ({ params }) => {
  const logo = await obtenerLogo(leerIdCliente(params.id));
  return new Response(new Uint8Array(logo.contenido), {
    headers: {
      "Content-Type": logo.tipo,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});

export const PUT = manejar({ permiso: "cliente:gestionar" }, async ({ req, actor, params }) => {
  const id = leerIdCliente(params.id);
  return ok(await subirLogo(id, await leerContenidoLogo(req), actor));
});

export const DELETE = manejar({ permiso: "cliente:gestionar" }, async ({ actor, params }) => {
  await quitarLogo(leerIdCliente(params.id), actor);
  return new Response(null, { status: 204 });
});
