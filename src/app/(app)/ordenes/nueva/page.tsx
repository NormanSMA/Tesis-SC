import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AppError } from "@/lib/errores";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { FormularioOrden } from "@/modules/ordenes/componentes/FormularioOrden";
import { cargarPropuesta } from "@/modules/ordenes/paginas";
import { opcionesOrden } from "@/modules/ordenes/service";
import type { PropuestaOrden } from "@/modules/ordenes/tipos";

export const metadata: Metadata = { title: "Convertir cotización en orden" };

export default async function PaginaNuevaOrden({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await exigirPermisoPagina("orden:crear");
  const parametros = await searchParams;
  if (!parametros.cotizacionId) return <><PageHeader titulo="Convertir cotización en orden" />
    <p>Seleccione una cotización aprobada desde <Link href="/cotizaciones" className="text-primary underline">Cotizaciones</Link>.</p></>;
  const resultado = await cargarPropuesta(parametros.cotizacionId, actor).then(
    (propuesta) => ({ propuesta, error: null }),
    (error: unknown): { propuesta: PropuestaOrden | null; error: string } => {
      if (!(error instanceof AppError) || error.status !== 409) throw error;
      return { propuesta: null, error: error.mensaje };
    },
  );
  if (!resultado.propuesta) return <><PageHeader titulo="Convertir cotización en orden" />
    <Alert role="alert"><AlertTitle>No se puede convertir</AlertTitle><AlertDescription>{resultado.error}</AlertDescription></Alert></>;
  const propuesta = resultado.propuesta;
  if (propuesta.orden) redirect(`/ordenes/${propuesta.orden.id}`);
  const opciones = await opcionesOrden(actor);
  return <><PageHeader titulo="Convertir cotización en orden" descripcion={`${propuesta.numero} · ${propuesta.cliente}`} />
    <FormularioOrden propuesta={propuesta} opciones={opciones} hoy={hoyManagua()} /></>;
}
