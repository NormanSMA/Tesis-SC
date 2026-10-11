import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FilaConfiguracion } from "@/modules/admin/componentes/FilaConfiguracion";
import { listarConfiguracion } from "@/modules/admin/configuracion-service";

export const metadata: Metadata = { title: "Configuración" };

export default async function Pagina() {
  const actor = await exigirPermisoPagina("configuracion:gestionar");
  const parametros = await listarConfiguracion(actor);
  return (
    <div className="min-w-0">
      <PageHeader titulo="Configuración" descripcion="Guarde cada parámetro por separado. Los cambios no alteran las cotizaciones existentes." />
      <div className="max-w-3xl space-y-5">
        {parametros.map((parametro) => <FilaConfiguracion key={parametro.clave} inicial={parametro} />)}
        {!parametros.length ? <p>No hay parámetros configurados.</p> : null}
      </div>
    </div>
  );
}
