import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FilaConfiguracion } from "@/modules/admin/componentes/FilaConfiguracion";
import { listarConfiguracion } from "@/modules/admin/configuracion-service";

export const metadata: Metadata = { title: "Configuración" };

const CLAVES_TECNICAS = ["siembra_version"];

export default async function Pagina() {
  const actor = await exigirPermisoPagina("configuracion:gestionar");
  const visibles = (await listarConfiguracion(actor)).filter(({ clave }) => !CLAVES_TECNICAS.includes(clave));
  return (
    <div className="min-w-0">
      <PageHeader titulo="Configuración" descripcion="Guarde cada parámetro por separado. Los cambios no alteran las cotizaciones existentes." />
      <div className="max-w-5xl space-y-3">
        {visibles.map((parametro) => <FilaConfiguracion key={parametro.clave} inicial={parametro} />)}
        {!visibles.length ? <p>No hay parámetros configurados.</p> : null}
      </div>
    </div>
  );
}
