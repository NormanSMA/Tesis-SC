import type { Metadata } from "next";
import { cache } from "react";
import { PageHeader } from "@/components/comunes/PageHeader";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { MaterialesOrden } from "@/modules/inventario/componentes/MaterialesOrden";
import { ConsumoEstimadoOrden } from "@/modules/ordenes/componentes/ConsumoEstimadoOrden";
import { DatosCliente, DatosOrden } from "@/modules/ordenes/componentes/DatosOrden";
import { EncabezadoOrden } from "@/modules/ordenes/componentes/EncabezadoOrden";
import { EtapasOrden } from "@/modules/ordenes/componentes/EtapasOrden";
import { FichaOrden } from "@/modules/ordenes/componentes/FichaOrden";
import { ItemsOrden } from "@/modules/ordenes/componentes/ItemsOrden";
import { LineaTiempoOrden } from "@/modules/ordenes/componentes/LineaTiempoOrden";
import { cargarOrden } from "@/modules/ordenes/paginas";
import { opcionesProduccion } from "@/modules/produccion/service";

const cargarPagina = cache(async (id: string) => {
  const actor = await exigirPermisoPagina("orden:ver");
  return { actor, orden: await cargarOrden(id, actor) };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { orden } = await cargarPagina((await params).id);
  return { title: `Orden ${orden.numero}` };
}

export default async function PaginaDetalleOrden({ params }: { params: Promise<{ id: string }> }) {
  const { actor, orden } = await cargarPagina((await params).id);
  const permisos = { gestionar: can(actor, "orden:gestionar") || can(actor, "produccion:planificar"), entregar: can(actor, "orden:entregar"),
    cerrar: can(actor, "orden:cerrar"), cancelar: can(actor, "orden:cancelar") };
  const permisosEtapas = { planificar: can(actor, "produccion:planificar"), ejecutar: can(actor, "produccion:ejecutar"),
    avanzar: can(actor, "orden:avanzar") };
  const opciones = can(actor, "produccion:ver") && (permisosEtapas.planificar || permisosEtapas.avanzar)
    ? await opcionesProduccion(actor) : { areas: [], responsables: [] };
  return <>
    <PageHeader titulo={orden.numero} descripcion={orden.cliente.nombre} acciones={<EstadoBadge tipo="orden" estado={orden.estado} />} />
    <div className="min-w-0 space-y-6" key={orden.actualizadoEn}>
      <EncabezadoOrden orden={orden} permisos={permisos} permisosEtapas={permisosEtapas} />
      <EtapasOrden etapas={orden.etapas} orden={orden} permisos={permisosEtapas}
        areas={opciones.areas.filter((area) => area.activo)} responsables={opciones.responsables} />
      <FichaOrden
        especificaciones={<><DatosOrden orden={orden} /><ItemsOrden items={orden.items} /></>}
        cliente={<DatosCliente orden={orden} verCliente={can(actor, "cliente:ver")} verCotizacion={can(actor, "cotizacion:ver")} />}
        consumo={<ConsumoEstimadoOrden orden={orden} />}
        materiales={can(actor, "inventario:ver") ? <MaterialesOrden ordenId={orden.id} consumir={can(actor, "inventario:consumir")} /> : undefined}
        historial={<LineaTiempoOrden eventos={orden.eventos} />} />
    </div>
  </>;
}
