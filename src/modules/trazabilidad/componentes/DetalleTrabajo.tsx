"use client";

import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Timeline } from "@/components/comunes/Timeline";
import { formatearCantidad, formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import type { TrazabilidadOrden } from "../tipos";

type Etapa = TrazabilidadOrden["cadena"]["etapas"][number];
type Material = TrazabilidadOrden["materiales"][number];
const claseTabla = "min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2";
const columnasEtapas: ColumnaTabla<Etapa>[] = [
  { id: "nombre", encabezado: "Etapa y área", principal: true, celda: (fila) => <>{fila.secuencia}. {fila.nombre}<p>{fila.area.nombre}</p></> },
  { id: "estado", encabezado: "Estado y responsable", celda: (fila) => <>{fila.estado}<p>{fila.responsable?.nombre ?? "Sin responsable"}</p></> },
  { id: "plan", encabezado: "Fechas planificadas", celda: (fila) => <><p>Inicio: {formatearFecha(fila.fechaInicioPlan) || "Sin planificar"}</p><p>Fin: {formatearFecha(fila.fechaFinPlan) || "Sin planificar"}</p></> },
  { id: "real", encabezado: "Fechas reales", celda: (fila) => <><p>Inicio: {formatearFechaHora(fila.fechaInicioReal) || "Sin registrar"}</p><p>Fin: {formatearFechaHora(fila.fechaFinReal) || "Sin registrar"}</p></> },
];
function columnasMateriales(dinero: boolean): ColumnaTabla<Material>[] {
  return [{ id: "material", encabezado: "Material", principal: true, celda: (fila) => <>{fila.material.nombre}<p className="text-xs">{fila.material.unidad}</p></> },
    ...(["estimado", "consumido", "devuelto", "neto"] as const).map((campo) => ({ id: campo,
      encabezado: { estimado: "Estimado", consumido: "Consumido", devuelto: "Devuelto", neto: "Neto" }[campo],
      alinear: "derecha" as const, celda: (fila: Material) => formatearCantidad(fila[campo], 3) })),
    ...(dinero ? [{ id: "costo", encabezado: "Costo real (C$)", alinear: "derecha" as const,
      celda: (fila: Material) => formatearCantidad(fila.costoReal, 7) }] : [])];
}
export function DetalleTrabajo({ trazabilidad }: { trazabilidad: TrazabilidadOrden }) {
  const eventos = trazabilidad.eventos.map((evento) => ({ id: evento.id, instante: evento.creadoEn,
    actor: evento.usuario.nombre, accion: `${evento.accion}: ${evento.entidad.toLowerCase()}`,
    detalle: [evento.registro.nombre, evento.estadoNuevo ? `${evento.estadoAnterior ?? "Creación"} → ${evento.estadoNuevo}` : "", evento.resumen].filter(Boolean).join(". ") }));
  return <div className="min-w-0 space-y-6">
    <section aria-labelledby="titulo-etapas"><h2 id="titulo-etapas" className="mb-3 text-xl font-semibold">Etapas</h2>
      <DataTable titulo="Etapas del trabajo" filas={trazabilidad.cadena.etapas} columnas={columnasEtapas} idFila={(fila) => fila.id} className={claseTabla} /></section>
    <section aria-labelledby="titulo-materiales"><h2 id="titulo-materiales" className="mb-3 text-xl font-semibold">Materiales</h2>
      <DataTable titulo="Materiales del trabajo" filas={trazabilidad.materiales} columnas={columnasMateriales("costoRealTotal" in trazabilidad)}
        idFila={(fila) => fila.material.id} className={claseTabla}
        vacio={<EmptyState titulo="Sin materiales" descripcion="Este trabajo no tiene materiales estimados ni movimientos." />} />
      {"costoRealTotal" in trazabilidad ? <div className="mt-3 space-y-1"><p className="font-semibold">Costo real total: {formatearMoneda(trazabilidad.costoRealTotal)}</p>
        <p className="text-sm text-muted-foreground">Valor exacto: C$ {trazabilidad.costoRealTotal}. Incluye consumos menos devoluciones.</p></div> : null}
    </section>
    <section aria-labelledby="titulo-responsables"><h2 id="titulo-responsables" className="mb-3 text-xl font-semibold">Responsables que intervinieron</h2>
      <ul className="grid gap-3 sm:grid-cols-2">{trazabilidad.responsables.map((persona) => <li key={persona.id} className="min-w-0 rounded-lg border bg-card p-4">
        <p className="font-medium">{persona.nombre}</p><p className="break-words text-sm text-muted-foreground">{persona.roles.join(". ")}</p></li>)}</ul></section>
    <section aria-labelledby="titulo-eventos" className="min-w-0 break-words [overflow-wrap:anywhere]"><h2 id="titulo-eventos" className="mb-4 text-xl font-semibold">Línea de tiempo</h2>
      <Timeline titulo="Eventos del trabajo" eventos={eventos} /></section>
  </div>;
}
