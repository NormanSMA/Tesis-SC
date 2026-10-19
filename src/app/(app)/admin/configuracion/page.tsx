import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FilaConfiguracion, type ParametroDto } from "@/modules/admin/componentes/FilaConfiguracion";
import { listarConfiguracion } from "@/modules/admin/configuracion-service";

export const metadata: Metadata = { title: "Configuración" };

const CLAVES_TECNICAS = ["siembra_version"];

const TEMAS = [
  { id: "empresa", titulo: "Empresa", descripcion: "Datos de la empresa, moneda y zona horaria." },
  { id: "cotizador", titulo: "Cotizador", descripcion: "Impuestos, vigencia y condiciones de las cotizaciones." },
  { id: "numeracion", titulo: "Numeración", descripcion: "Formato de los números de documentos." },
  { id: "otros", titulo: "Otros parámetros", descripcion: "Parámetros generales del sistema." },
] as const;

function temaDe(clave: string): (typeof TEMAS)[number]["id"] {
  if (/^(iva|cotizacion)_/.test(clave)) return "cotizador";
  if (/^(numeracion|numero|prefijo|secuencia)/.test(clave)) return "numeracion";
  if (/^(empresa_|moneda|tipo_cambio|zona_horaria)/.test(clave)) return "empresa";
  return "otros";
}

export default async function Pagina() {
  const actor = await exigirPermisoPagina("configuracion:gestionar");
  const visibles: ParametroDto[] = (await listarConfiguracion(actor)).filter(({ clave }) => !CLAVES_TECNICAS.includes(clave));
  const temas = TEMAS.map((tema) => ({ ...tema, filas: visibles.filter(({ clave }) => temaDe(clave) === tema.id) })).filter((tema) => tema.filas.length);
  return (
    <div className="min-w-0">
      <PageHeader titulo="Configuración" tituloVisible={false} descripcion="Guarde cada parámetro por separado. Los cambios no alteran las cotizaciones existentes." />
      <div className="max-w-5xl space-y-4">
        {temas.map((tema) => (
          <section key={tema.id} aria-labelledby={`tema-${tema.id}`} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
            <header className="border-b border-slate-100 px-5 py-3">
              <h2 id={`tema-${tema.id}`} className="text-[15px] font-medium text-slate-800">{tema.titulo}</h2>
              <p className="text-sm text-slate-500">{tema.descripcion}</p>
            </header>
            <div className="divide-y divide-slate-100">
              {tema.filas.map((parametro) => <FilaConfiguracion key={parametro.clave} inicial={parametro} />)}
            </div>
          </section>
        ))}
        {!visibles.length ? <p>No hay parámetros configurados.</p> : null}
      </div>
    </div>
  );
}
