import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { EditorCabecera } from "@/modules/cotizaciones/componentes/EditorCabecera";
import { EditorItems } from "@/modules/cotizaciones/componentes/EditorItems";
import { cargarCotizacion } from "@/modules/cotizaciones/paginas";
import { consultarSelectores } from "@/modules/cotizaciones/repo";

export const metadata: Metadata = { title: "Editar cotización" };

export default async function PaginaEditarCotizacion({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermisoPagina("cotizacion:gestionar");
  const cotizacion = await cargarCotizacion((await params).id);
  if (cotizacion.estado !== "BORRADOR" || cotizacion.archivada) redirect(`/cotizaciones/${cotizacion.id}`);
  const selectores = await consultarSelectores();
  return <>
    <PageHeader titulo={`Editar ${cotizacion.numero}`} descripcion={cotizacion.cliente.nombre} />
    <div className="max-w-5xl space-y-8" key={cotizacion.actualizadoEn}>
      <EditorCabecera cotizacion={cotizacion} />
      <EditorItems cotizacion={cotizacion} selectores={selectores} />
    </div>
  </>;
}
