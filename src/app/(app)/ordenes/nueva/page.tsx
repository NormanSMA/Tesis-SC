import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AppError } from "@/lib/errores";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { FormularioOrden } from "@/modules/ordenes/componentes/FormularioOrden";
import { cargarPropuesta } from "@/modules/ordenes/paginas";
import { opcionesOrden } from "@/modules/ordenes/service";
import type { PropuestaOrden } from "@/modules/ordenes/tipos";

const TITULO = "Convertir cotización en orden";
const VOLVER = { href: "/ordenes", etiqueta: "Órdenes de trabajo" };
const MARCA = <MarcaIcono><ClipboardList /></MarcaIcono>;

export const metadata: Metadata = { title: TITULO };

export default async function PaginaNuevaOrden({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await exigirPermisoPagina("orden:crear");
  const parametros = await searchParams;
  if (!parametros.cotizacionId) return <><CabeceraFicha titulo={TITULO} marca={MARCA} volver={VOLVER} />
    <EmptyState icono={ClipboardList} titulo="Seleccione una cotización aprobada"
      descripcion="Convierta una cotización aprobada en orden desde la lista de Cotizaciones."
      accion={<Button asChild><Link href="/cotizaciones">Ir a Cotizaciones</Link></Button>} /></>;
  const resultado = await cargarPropuesta(parametros.cotizacionId, actor).then(
    (propuesta) => ({ propuesta, error: null }),
    (error: unknown): { propuesta: PropuestaOrden | null; error: string } => {
      if (!(error instanceof AppError) || error.status !== 409) throw error;
      return { propuesta: null, error: error.mensaje };
    },
  );
  if (!resultado.propuesta) return <><CabeceraFicha titulo={TITULO} marca={MARCA} volver={VOLVER} />
    <Alert role="alert"><AlertTitle>No se puede convertir</AlertTitle><AlertDescription>{resultado.error}</AlertDescription></Alert></>;
  const propuesta = resultado.propuesta;
  if (propuesta.orden) redirect(`/ordenes/${propuesta.orden.id}`);
  const opciones = await opcionesOrden(actor);
  return <><CabeceraFicha titulo={TITULO} marca={MARCA} volver={VOLVER}
    meta={<span>{propuesta.numero} · {propuesta.cliente}</span>} />
    <FormularioOrden propuesta={propuesta} opciones={opciones} hoy={hoyManagua()} /></>;
}
