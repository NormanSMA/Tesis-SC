import { Archive, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/comunes/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AccionesEstado } from "@/modules/clientes/componentes/AccionesEstado";
import { DatosCliente } from "@/modules/clientes/componentes/DatosCliente";
import {
  ActividadCliente,
  CotizacionesCliente,
  TrabajosCliente,
} from "@/modules/clientes/componentes/HistorialCliente";
import { ResumenCliente } from "@/modules/clientes/componentes/ResumenCliente";
import { cargarFicha } from "@/modules/clientes/paginas";
import { ETIQUETA_TIPO } from "@/modules/clientes/schema";
import type { FichaCliente } from "@/modules/clientes/tipos";

export const metadata: Metadata = { title: "Ficha de cliente" };

function AccionesFicha({ ficha }: { ficha: FichaCliente }) {
  return (
    <>
      {ficha.activo ? (
        <Button asChild variant="outline">
          <Link href={`/clientes/${ficha.id}/editar`}>
            <Pencil aria-hidden="true" />
            Editar
          </Link>
        </Button>
      ) : null}
      <AccionesEstado id={ficha.id} nombre={ficha.nombre} activo={ficha.activo} version={ficha.actualizadoEn} />
    </>
  );
}

function AvisoArchivado({ puedeGestionar }: { puedeGestionar: boolean }) {
  return (
    <Alert role="status" className="mb-6">
      <Archive aria-hidden="true" />
      <AlertTitle>Cliente archivado</AlertTitle>
      <AlertDescription>
        Conserva su historial, pero no se puede editar ni elegir en cotizaciones nuevas.
        {puedeGestionar ? " Reactívelo para volver a trabajar con él." : ""}
      </AlertDescription>
    </Alert>
  );
}

function descripcionDe(ficha: FichaCliente): string {
  return ficha.ruc ? `${ETIQUETA_TIPO[ficha.tipo]} · RUC ${ficha.ruc}` : ETIQUETA_TIPO[ficha.tipo];
}

export default async function PaginaFichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("cliente:ver");
  const ficha = await cargarFicha((await params).id, actor);
  const puedeGestionar = can(actor, "cliente:gestionar");
  return (
    <>
      <PageHeader
        titulo={ficha.nombre}
        descripcion={`${ficha.codigoCliente} · ${descripcionDe(ficha)}`}
        acciones={puedeGestionar ? <AccionesFicha ficha={ficha} /> : null}
      />
      {ficha.activo ? null : <AvisoArchivado puedeGestionar={puedeGestionar} />}
      <div className="space-y-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <DatosCliente cliente={ficha} className={ficha.resumen ? "lg:col-span-2" : "lg:col-span-3"} />
          {ficha.resumen ? <ResumenCliente resumen={ficha.resumen} /> : null}
        </div>
        {ficha.cotizaciones ? <CotizacionesCliente seccion={ficha.cotizaciones} /> : null}
        {ficha.trabajos ? <TrabajosCliente seccion={ficha.trabajos} /> : null}
        <ActividadCliente eventos={ficha.actividad} />
      </div>
    </>
  );
}
