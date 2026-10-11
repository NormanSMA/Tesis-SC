import { redirect } from "next/navigation";

import { obtenerSesion } from "@/lib/auth/sesion";
import { FormularioCambiarClave } from "@/modules/auth/componentes/FormularioCambiarClave";

export default async function PaginaCambiarClave() {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  return (
    <section className="mx-auto max-w-lg space-y-5" aria-labelledby="titulo-cambiar-clave">
      <div className="space-y-2">
        <h1 id="titulo-cambiar-clave" className="text-2xl font-semibold">Cambiar clave</h1>
        <p className="text-sm text-muted-foreground">Cambie su clave temporal para continuar.</p>
      </div>
      <FormularioCambiarClave perfil={usuario.perfil} />
    </section>
  );
}
