import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";

import { MarcaIcono } from "@/components/comunes/CabeceraFicha";

import { obtenerSesion } from "@/lib/auth/sesion";
import { FormularioCambiarClave } from "@/modules/auth/componentes/FormularioCambiarClave";

export default async function PaginaCambiarClave() {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  return (
    <section className="mx-auto max-w-lg space-y-5 pt-4 sm:pt-10" aria-labelledby="titulo-cambiar-clave">
      <div className="flex items-center gap-4">
        <MarcaIcono destacada><KeyRound /></MarcaIcono>
        <div className="space-y-1">
          <h1 id="titulo-cambiar-clave" className="text-2xl font-semibold tracking-tight">Cambiar clave</h1>
          <p className="text-sm text-slate-500">Cambie su clave temporal para continuar.</p>
        </div>
      </div>
      <FormularioCambiarClave perfil={usuario.perfil} />
    </section>
  );
}
