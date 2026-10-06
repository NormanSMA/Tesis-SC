import type { Metadata } from "next";
import { PageHeader } from "@/components/comunes/PageHeader";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AccionesOrden } from "@/modules/ordenes/componentes/AccionesOrden";
import { ConsumoEstimadoOrden } from "@/modules/ordenes/componentes/ConsumoEstimadoOrden";
import { DatosOrden } from "@/modules/ordenes/componentes/DatosOrden";
import { EtapasOrden } from "@/modules/ordenes/componentes/EtapasOrden";
import { ItemsOrden } from "@/modules/ordenes/componentes/ItemsOrden";
import { LineaTiempoOrden } from "@/modules/ordenes/componentes/LineaTiempoOrden";
import { cargarOrden } from "@/modules/ordenes/paginas";

export const metadata: Metadata = { title: "Detalle de orden" };

export default async function PaginaDetalleOrden({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("orden:ver");
  const orden = await cargarOrden((await params).id, actor);
  const permisos = { gestionar: can(actor, "orden:gestionar"), entregar: can(actor, "orden:entregar"),
    cerrar: can(actor, "orden:cerrar"), cancelar: can(actor, "orden:cancelar") };
  return <>
    <PageHeader titulo={orden.numero} descripcion={orden.cliente.nombre} acciones={<EstadoBadge tipo="orden" estado={orden.estado} />} />
    <div className="min-w-0 space-y-6" key={orden.actualizadoEn}>
      <AccionesOrden orden={orden} permisos={permisos} />
      <DatosOrden orden={orden} verCliente={can(actor, "cliente:ver")} verCotizacion={can(actor, "cotizacion:ver")} />
      <ItemsOrden items={orden.items} /><EtapasOrden etapas={orden.etapas} />
      <ConsumoEstimadoOrden orden={orden} /><LineaTiempoOrden eventos={orden.eventos} />
    </div>
  </>;
}
