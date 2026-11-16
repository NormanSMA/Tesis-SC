import type { Metadata } from "next";
import { cache } from "react";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { MaterialesOrden } from "@/modules/inventario/componentes/MaterialesOrden";
import { ConsumoEstimadoOrden } from "@/modules/ordenes/componentes/ConsumoEstimadoOrden";
import { DatosCliente, DatosOrden } from "@/modules/ordenes/componentes/DatosOrden";
import { EncabezadoOrden } from "@/modules/ordenes/componentes/EncabezadoOrden";
import { EtapasOrden } from "@/modules/ordenes/componentes/EtapasOrden";
import { FichaOrden } from "@/modules/ordenes/componentes/FichaOrden";
import { monedaDe } from "@/modules/cotizaciones/moneda";
import { ItemsOrden } from "@/modules/ordenes/componentes/ItemsOrden";
import { LineaTiempoOrden } from "@/modules/ordenes/componentes/LineaTiempoOrden";
import { cargarOrden } from "@/modules/ordenes/paginas";
import { etapasEjecutables, soloEtapasPropias } from "@/modules/produccion/acceso";
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
  const verInventario = can(actor, "inventario:ver");
  const permisos = { gestionar: can(actor, "orden:gestionar") || can(actor, "produccion:planificar"), entregar: can(actor, "orden:entregar"),
    cerrar: can(actor, "orden:cerrar"), cancelar: can(actor, "orden:cancelar") };
  const permisosEtapas = { planificar: can(actor, "produccion:planificar"), ejecutar: can(actor, "produccion:ejecutar"),
    avanzar: can(actor, "orden:avanzar") };
  const opciones = can(actor, "produccion:ver") && (permisosEtapas.planificar || permisosEtapas.avanzar)
    ? await opcionesProduccion(actor) : { areas: [], responsables: [] };
  const ejecutables = etapasEjecutables(orden.etapas.map((etapa) => ({ ...etapa, responsableId: etapa.responsable?.id ?? null })), actor);
  return <div className="min-w-0" key={orden.actualizadoEn}>
    <EncabezadoOrden orden={orden} permisos={permisos} permisosEtapas={permisosEtapas} verTrazabilidad={!soloEtapasPropias(actor)} />
    <div className="min-w-0 space-y-6">
      <EtapasOrden etapas={orden.etapas} orden={orden} permisos={permisosEtapas} ejecutables={ejecutables} materiales={orden.materialesTrabajo}
        areas={opciones.areas.filter((area) => area.activo)} responsables={opciones.responsables} />
      <FichaOrden
        especificaciones={<><DatosOrden orden={orden} /><ItemsOrden items={orden.items} moneda={monedaDe(orden.cotizacion?.moneda)} /></>}
        cliente={orden.cotizacion ? <DatosCliente orden={orden} verCliente={can(actor, "cliente:ver")} /> : undefined}
        consumo={verInventario ? <ConsumoEstimadoOrden orden={orden} /> : undefined}
        materiales={verInventario ? <MaterialesOrden ordenId={orden.id} consumir={can(actor, "inventario:consumir")} /> : undefined}
        historial={soloEtapasPropias(actor) ? undefined : <LineaTiempoOrden eventos={orden.eventos} />} />
    </div>
  </div>;
}
