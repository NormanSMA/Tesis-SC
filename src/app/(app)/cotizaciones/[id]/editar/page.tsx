import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Calculator } from "lucide-react";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { CuerpoFormulario, SeccionFormulario } from "@/components/comunes/SeccionFormulario";
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
    <CabeceraFicha titulo={`Editar ${cotizacion.numero}`} marca={<MarcaIcono><Calculator /></MarcaIcono>}
      volver={{ href: `/cotizaciones/${cotizacion.id}`, etiqueta: "Volver a la cotización" }}
      meta={<><span>{cotizacion.cliente.nombre}</span><EstadoBadge tipo="cotizacion" estado={cotizacion.estado} /></>} />
    <CuerpoFormulario key={cotizacion.actualizadoEn}>
      <SeccionFormulario titulo="Datos de cotización" descripcion="Asunto, condiciones, descuento y vigencia.">
        <EditorCabecera cotizacion={cotizacion} />
      </SeccionFormulario>
      <EditorItems cotizacion={cotizacion} selectores={selectores} />
    </CuerpoFormulario>
  </>;
}
