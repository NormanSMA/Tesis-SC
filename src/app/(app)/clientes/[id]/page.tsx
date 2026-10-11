import { Archive, FilePlus2, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AccionesEstado } from "@/modules/clientes/componentes/AccionesEstado";
import { DatosCliente } from "@/modules/clientes/componentes/DatosCliente";
import { EncabezadoFicha } from "@/modules/clientes/componentes/EncabezadoFicha";
import { EstadoCliente } from "@/modules/clientes/componentes/EstadoCliente";
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

type PropiedadesAcciones = { ficha: FichaCliente; puedeCotizar: boolean };

// El siguiente paso es el único botón con énfasis: cotizar si está activo y se puede; si no, editar; si está archivado, reactivar.
function AccionesFicha({ ficha, puedeCotizar }: PropiedadesAcciones) {
  const cotizar = ficha.activo && puedeCotizar;
  return (
    <>
      {cotizar ? (
        <Button asChild>
          <Link href="/cotizaciones/nueva">
            <FilePlus2 aria-hidden="true" />
            Nueva cotización
          </Link>
        </Button>
      ) : null}
      {ficha.activo ? (
        <Button asChild variant={cotizar ? "outline" : "default"}>
          <Link href={`/clientes/${ficha.id}/editar`}>
            <Pencil aria-hidden="true" />
            Editar
          </Link>
        </Button>
      ) : null}
      <AccionesEstado
        id={ficha.id}
        nombre={ficha.nombre}
        activo={ficha.activo}
        version={ficha.actualizadoEn}
        principal={!ficha.activo}
      />
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

function detalleDe(ficha: FichaCliente): string {
  return ficha.ruc ? `${ETIQUETA_TIPO[ficha.tipo]} · RUC ${ficha.ruc}` : ETIQUETA_TIPO[ficha.tipo];
}

const LISTA_PESTANAS = "h-auto w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto";
const PESTANA = "h-10 min-h-10 flex-none px-4";

export default async function PaginaFichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("cliente:ver");
  const ficha = await cargarFicha((await params).id, actor);
  const puedeGestionar = can(actor, "cliente:gestionar");
  return (
    <>
      <EncabezadoFicha
        titulo={ficha.nombre}
        codigo={ficha.codigoCliente}
        estado={<EstadoCliente activo={ficha.activo} />}
        detalle={detalleDe(ficha)}
        acciones={
          puedeGestionar ? <AccionesFicha ficha={ficha} puedeCotizar={can(actor, "cotizacion:gestionar")} /> : null
        }
      />
      {ficha.activo ? null : <AvisoArchivado puedeGestionar={puedeGestionar} />}
      <Tabs defaultValue="resumen">
        <TabsList variant="line" className={LISTA_PESTANAS} aria-label="Secciones de la ficha">
          <TabsTrigger value="resumen" className={PESTANA}>Resumen</TabsTrigger>
          {ficha.cotizaciones ? <TabsTrigger value="cotizaciones" className={PESTANA}>Cotizaciones</TabsTrigger> : null}
          {ficha.trabajos ? <TabsTrigger value="trabajos" className={PESTANA}>Trabajos</TabsTrigger> : null}
          <TabsTrigger value="actividad" className={PESTANA}>Actividad</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <DatosCliente cliente={ficha} className={ficha.resumen ? "lg:col-span-2" : "lg:col-span-3"} />
            {ficha.resumen ? <ResumenCliente resumen={ficha.resumen} /> : null}
          </div>
        </TabsContent>
        {ficha.cotizaciones ? (
          <TabsContent value="cotizaciones" className="pt-4">
            <CotizacionesCliente seccion={ficha.cotizaciones} />
          </TabsContent>
        ) : null}
        {ficha.trabajos ? (
          <TabsContent value="trabajos" className="pt-4">
            <TrabajosCliente seccion={ficha.trabajos} />
          </TabsContent>
        ) : null}
        <TabsContent value="actividad" className="pt-4">
          <ActividadCliente eventos={ficha.actividad} />
        </TabsContent>
      </Tabs>
    </>
  );
}
