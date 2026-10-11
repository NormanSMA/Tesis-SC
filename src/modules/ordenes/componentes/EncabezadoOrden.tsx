import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EDITABLES } from "../reglas";
import type { OrdenDto } from "../tipos";
import { AccionesOrden, type PermisosProduccionOrden } from "./AccionesOrden";

type Permisos = { gestionar: boolean; entregar: boolean; cerrar: boolean; cancelar: boolean };

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-sm text-muted-foreground">{etiqueta}</dt>
    <dd className="mt-1 flex flex-wrap items-center gap-2 break-words [overflow-wrap:anywhere]">{children}</dd></div>;
}

/** Resumen de la ficha: entrega, responsable y siguiente paso. El estado va en el título de la página. */
export function EncabezadoOrden({ orden, permisos, permisosEtapas }: {
  orden: OrdenDto; permisos: Permisos; permisosEtapas: PermisosProduccionOrden;
}) {
  const puedeAsignar = permisos.gestionar && EDITABLES.includes(orden.estado);
  return <Card role="region" aria-label="Resumen de la orden" className="min-w-0 gap-5 px-5">
    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Dato etiqueta="Fecha de entrega"><Fecha valor={orden.fechaEntrega} />
        {orden.atrasada ? <span className="flex items-center gap-1 font-semibold text-danger">
          <TriangleAlert aria-hidden="true" className="size-4" />Atrasada</span> : null}</Dato>
      <Dato etiqueta="Responsable">{orden.responsable?.nombre ?? "Sin responsable"}
        {!orden.responsable && puedeAsignar ? <Button asChild variant="outline" size="sm" className="h-10">
          <Link href={`/ordenes/${orden.id}/editar`}>Asignar</Link></Button> : null}</Dato>
    </dl>
    <AccionesOrden orden={orden} permisos={permisos} permisosEtapas={permisosEtapas} />
  </Card>;
}
