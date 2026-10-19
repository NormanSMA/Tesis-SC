import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, ClipboardList, ListChecks, TriangleAlert, UserRound, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { AnilloProgreso } from "@/components/comunes/AnilloProgreso";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { IconoServicio } from "@/components/comunes/IconoServicio";
import { BandejaMetricas, TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import { servicioDeCategoria } from "@/lib/servicios";
import { EDITABLES } from "../reglas";
import type { OrdenDto } from "../tipos";
import { AccionesOrden, type PermisosProduccionOrden } from "./AccionesOrden";

type Permisos = { gestionar: boolean; entregar: boolean; cerrar: boolean; cancelar: boolean };

/** Tarjeta de texto con el marco de TarjetaMetrica, para datos que no son numéricos. */
function CeldaResumen({ etiqueta, icono: Icono, children }: { etiqueta: string; icono: LucideIcon; children: ReactNode }) {
  return <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-card text-slate-600">
        <Icono aria-hidden="true" className="size-4" /></span>
      <span className="min-w-0 flex-1 text-[15px] leading-snug font-medium text-slate-800">{etiqueta}</span>
    </div>
    <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 text-lg font-medium break-words [overflow-wrap:anywhere]">{children}</div>
  </div>;
}

/** Cabecera de la ficha (identidad, estado, siguiente paso) y resumen de avance, entrega y responsable. */
export function EncabezadoOrden({ orden, permisos, permisosEtapas }: {
  orden: OrdenDto; permisos: Permisos; permisosEtapas: PermisosProduccionOrden;
}) {
  const puedeAsignar = permisos.gestionar && EDITABLES.includes(orden.estado);
  const total = orden.etapas.length;
  const cerradas = orden.etapas.filter((etapa) => etapa.estado === "COMPLETADA" || etapa.estado === "OMITIDA").length;
  const porcentaje = total > 0 ? Math.round((cerradas / total) * 100) : 0;
  return <>
    <CabeceraFicha titulo={orden.numero} marca={<MarcaIcono destacada><ClipboardList /></MarcaIcono>}
      volver={{ href: "/ordenes", etiqueta: "Órdenes de trabajo" }}
      meta={<>
        <span className="min-w-0 break-words">{orden.cliente.nombre} ({orden.cliente.codigoCliente})</span>
        <EstadoBadge tipo="orden" estado={orden.estado} />
        <span>Entrega: <Fecha valor={orden.fechaEntrega} className="font-medium text-foreground" /></span>
      </>}
      acciones={<AccionesOrden orden={orden} permisos={permisos} permisosEtapas={permisosEtapas} />} />
    <BandejaMetricas className="mb-6">
      <TarjetaMetrica etiqueta="Avance de etapas" numero={porcentaje} texto={`${porcentaje} %`} formato="porcentaje" icono={ListChecks}
        pie={`${cerradas} de ${total} cerradas`}
        adorno={<AnilloProgreso valor={cerradas} total={total} etiqueta="Etapas cerradas" radio={20} grosor={5} />} />
      <CeldaResumen etiqueta="Fecha de entrega" icono={CalendarClock}>
        <Fecha valor={orden.fechaEntrega} />
        {orden.atrasada ? <span className="flex items-center gap-1 text-sm font-semibold text-danger">
          <TriangleAlert aria-hidden="true" className="size-4" />Atrasada</span> : null}
      </CeldaResumen>
      <CeldaResumen etiqueta="Responsable" icono={UserRound}>
        {orden.responsable?.nombre ?? "Sin responsable"}
        {!orden.responsable && puedeAsignar ? <Button asChild variant="outline" size="sm" className="h-10">
          <Link href={`/ordenes/${orden.id}/editar`}>Asignar</Link></Button> : null}
      </CeldaResumen>
      <CeldaResumen etiqueta="Servicio" icono={Wrench}>
        {servicioDeCategoria(orden.categoria.nombre) ? <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <IconoServicio categoria={orden.categoria.nombre} tamano={32} decorativo /></span> : null}
        <span className="min-w-0">{orden.categoria.nombre}</span>
      </CeldaResumen>
    </BandejaMetricas>
  </>;
}
