import Link from "next/link";
import { FileText, Hammer } from "lucide-react";

import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Timeline } from "@/components/comunes/Timeline";
import { Fecha, Money } from "@/components/comunes/ValorFormateado";

import { aEventoTimeline } from "../textoEvento";
import type { CotizacionDeCliente, EventoActividad, SeccionLimitada, TrabajoDeCliente } from "../tipos";
import { SeccionFicha, textoMostrando } from "./SeccionFicha";

const enlaceNumero = "font-medium text-primary underline-offset-4 hover:underline";

const COLUMNAS_COTIZACIONES: ColumnaTabla<CotizacionDeCliente>[] = [
  {
    id: "numero",
    encabezado: "Número",
    principal: true,
    celda: (cotizacion) => (
      <Link href={`/cotizaciones/${cotizacion.id}`} className={enlaceNumero}>
        {cotizacion.numero}
      </Link>
    ),
  },
  {
    id: "asunto",
    encabezado: "Asunto",
    celda: (cotizacion) => (
      <span title={cotizacion.asunto ?? undefined} className="block max-w-40 truncate lg:max-w-none">
        {cotizacion.asunto ?? "—"}
      </span>
    ),
  },
  {
    id: "estado",
    encabezado: "Estado",
    celda: (cotizacion) => <EstadoBadge tipo="cotizacion" estado={cotizacion.estado} />,
  },
  {
    id: "total",
    encabezado: "Total",
    alinear: "derecha",
    celda: (cotizacion) => <Money valor={cotizacion.total} />,
  },
  { id: "fecha", encabezado: "Fecha", celda: (cotizacion) => <Fecha valor={cotizacion.fecha} /> },
];

const COLUMNAS_TRABAJOS: ColumnaTabla<TrabajoDeCliente>[] = [
  {
    id: "numero",
    encabezado: "Número",
    principal: true,
    celda: (trabajo) => (
      <Link href={`/ordenes/${trabajo.id}`} className={enlaceNumero}>
        {trabajo.numero}
      </Link>
    ),
  },
  { id: "estado", encabezado: "Estado", celda: (trabajo) => <EstadoBadge tipo="orden" estado={trabajo.estado} /> },
  { id: "entrega", encabezado: "Entrega", celda: (trabajo) => <Fecha valor={trabajo.fechaEntrega} /> },
];

export function CotizacionesCliente({ seccion }: { seccion: SeccionLimitada<CotizacionDeCliente> }) {
  return (
    <SeccionFicha
      id="cotizaciones-cliente"
      titulo="Cotizaciones"
      nota={textoMostrando(seccion.items.length, seccion.total)}
    >
      <DataTable
        titulo="Cotizaciones del cliente"
        columnas={COLUMNAS_COTIZACIONES}
        filas={seccion.items}
        idFila={(cotizacion) => cotizacion.id}
        vacio={<EmptyState icono={FileText} titulo="Sin cotizaciones" descripcion="Este cliente aún no tiene cotizaciones." />}
      />
    </SeccionFicha>
  );
}

export function TrabajosCliente({ seccion }: { seccion: SeccionLimitada<TrabajoDeCliente> }) {
  return (
    <SeccionFicha id="trabajos-cliente" titulo="Trabajos" nota={textoMostrando(seccion.items.length, seccion.total)}>
      <DataTable
        titulo="Trabajos del cliente"
        columnas={COLUMNAS_TRABAJOS}
        filas={seccion.items}
        idFila={(trabajo) => trabajo.id}
        vacio={<EmptyState icono={Hammer} titulo="Sin trabajos" descripcion="Este cliente aún no tiene órdenes de trabajo." />}
      />
    </SeccionFicha>
  );
}

export function ActividadCliente({ eventos }: { eventos: EventoActividad[] }) {
  return (
    <SeccionFicha id="actividad-cliente" titulo="Actividad">
      {eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay actividad registrada para este cliente.</p>
      ) : (
        <div className="rounded-lg border bg-card p-5 pl-8">
          <Timeline titulo="Actividad del cliente" eventos={eventos.map(aEventoTimeline)} />
        </div>
      )}
    </SeccionFicha>
  );
}
