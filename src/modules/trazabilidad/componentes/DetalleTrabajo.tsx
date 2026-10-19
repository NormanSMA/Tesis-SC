"use client";

import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { Timeline } from "@/components/comunes/Timeline";
import { formatearCantidadPorUnidad, formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { textoCambioEstado } from "../etiquetas";
import type { TrazabilidadOrden } from "../tipos";

type Etapa = TrazabilidadOrden["cadena"]["etapas"][number];
type Material = TrazabilidadOrden["materiales"][number];
const claseTabla = "min-w-0 rounded-none border-0 shadow-none [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2";
const columnasEtapas: ColumnaTabla<Etapa>[] = [
  { id: "nombre", encabezado: "Etapa y área", principal: true, celda: (fila) => <>{fila.secuencia}. {fila.nombre}<p>{fila.area.nombre}</p></> },
  { id: "estado", encabezado: "Estado y responsable", celda: (fila) => <><EstadoBadge tipo="etapa" estado={fila.estadoCodigo} /><p className="mt-1">{fila.responsable?.nombre ?? "Sin responsable"}</p></> },
  { id: "plan", encabezado: "Fechas planificadas", celda: (fila) => <><p>Inicio: {formatearFecha(fila.fechaInicioPlan) || "Sin planificar"}</p><p>Fin: {formatearFecha(fila.fechaFinPlan) || "Sin planificar"}</p></> },
  { id: "real", encabezado: "Fechas reales", celda: (fila) => <><p>Inicio: {formatearFechaHora(fila.fechaInicioReal) || "Sin registrar"}</p><p>Fin: {formatearFechaHora(fila.fechaFinReal) || "Sin registrar"}</p></> },
];
function columnasMateriales(dinero: boolean): ColumnaTabla<Material>[] {
  return [{ id: "material", encabezado: "Material", principal: true, celda: (fila) => <>{fila.material.nombre}<p className="text-xs">{fila.material.unidad}</p></> },
    ...(["estimado", "consumido", "devuelto", "neto"] as const).map((campo) => ({ id: campo,
      encabezado: { estimado: "Estimado", consumido: "Consumido", devuelto: "Devuelto", neto: "Neto" }[campo],
      alinear: "derecha" as const, celda: (fila: Material) => formatearCantidadPorUnidad(fila[campo], fila.material.unidad) })),
    ...(dinero ? [{ id: "costo", encabezado: "Costo real", alinear: "derecha" as const,
      celda: (fila: Material) => formatearMoneda(fila.costoReal) }] : [])];
}
export function DetalleTrabajo({ trazabilidad }: { trazabilidad: TrazabilidadOrden }) {
  const eventos = trazabilidad.eventos.map((evento) => ({ id: evento.id, instante: evento.creadoEn,
    actor: evento.usuario.nombre, accion: `${evento.accion}: ${evento.entidad.toLowerCase()}`,
    detalle: [evento.registro.nombre, textoCambioEstado(evento.estadoAnterior, evento.estadoNuevo), evento.resumen].filter(Boolean).join(". ") }));
  return <div className="min-w-0 space-y-6">
    <TarjetaSeccion titulo="Etapas" sinRelleno>
        <DataTable titulo="Etapas del trabajo" filas={trazabilidad.cadena.etapas} columnas={columnasEtapas} idFila={(fila) => fila.id}
          apilarEnMovil className={claseTabla} /></TarjetaSeccion>
    <TarjetaSeccion titulo="Materiales" sinRelleno>
        <DataTable titulo="Materiales del trabajo" filas={trazabilidad.materiales} columnas={columnasMateriales("costoRealTotal" in trazabilidad)}
          idFila={(fila) => fila.material.id} apilarEnMovil className={claseTabla}
          vacio={<EmptyState ilustracion="uv-dtf" titulo="Sin materiales" descripcion="Este trabajo no tiene materiales estimados ni movimientos." className="rounded-none border-0" />} />
        {"costoRealTotal" in trazabilidad ? <div className="space-y-1 border-t border-slate-100 p-5"><p className="font-semibold">Costo real total: {formatearMoneda(trazabilidad.costoRealTotal)}</p>
          <p className="text-sm text-muted-foreground">Incluye consumos menos devoluciones.</p></div> : null}
      </TarjetaSeccion>
    <TarjetaSeccion titulo="Responsables que intervinieron">
        <ul className="grid gap-3 sm:grid-cols-2">{trazabilidad.responsables.map((persona) => <li key={persona.id} className="min-w-0 rounded-lg border border-border/80 bg-slate-50 p-4">
          <p className="font-medium">{persona.nombre}</p><p className="break-words text-sm text-muted-foreground">{persona.roles.join(". ")}</p></li>)}</ul>
      </TarjetaSeccion>
    <TarjetaSeccion titulo="Línea de tiempo" className="break-words [overflow-wrap:anywhere]">
        <Timeline titulo="Eventos del trabajo" eventos={eventos} /></TarjetaSeccion>
  </div>;
}
