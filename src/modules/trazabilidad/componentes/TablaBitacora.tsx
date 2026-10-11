"use client";

import Link from "next/link";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { formatearFechaHora } from "@/lib/formato";
import { textoCambioEstado } from "../etiquetas";
import type { ConsultaBitacora } from "../schema";
import type { EventoTrazabilidad, ListaBitacora } from "../tipos";

export function EstadoEvento({ evento }: { evento: EventoTrazabilidad }) {
  const cambio = textoCambioEstado(evento.estadoAnterior, evento.estadoNuevo);
  return cambio ? <p className="mt-1 text-sm">{cambio}</p> : null;
}
const columnas: ColumnaTabla<EventoTrazabilidad>[] = [
  { id: "fecha", encabezado: "Fecha y usuario", principal: true, celda: (fila) => <>
    <time dateTime={fila.creadoEn}>{formatearFechaHora(fila.creadoEn)}</time><p className="mt-1 font-medium">{fila.usuario.nombre}</p></> },
  { id: "accion", encabezado: "Acción y estado", celda: (fila) => <>{fila.accion}<EstadoEvento evento={fila} /></> },
  { id: "registro", encabezado: "Entidad y registro", celda: (fila) => <><p>{fila.entidad}</p>
    {fila.registro.href ? <Link href={fila.registro.href} className="font-medium text-primary underline">{fila.registro.nombre}</Link> : fila.registro.nombre}</> },
  { id: "detalle", encabezado: "Detalle", celda: (fila) => fila.resumen || "Sin detalle adicional" },
];
export function TablaBitacora({ lista, consulta }: { lista: ListaBitacora; consulta: ConsultaBitacora }) {
  const hrefPagina = (pagina: number) => {
    const parametros = new URLSearchParams(Object.entries(consulta).filter(([, valor]) => valor !== undefined)
      .map(([campo, valor]) => [campo, String(valor)]));
    parametros.set("pagina", String(pagina));
    return `/trazabilidad?${parametros}`;
  };
  return <DataTable apilarEnMovil titulo="Bitácora global" filas={lista.datos} columnas={columnas} idFila={(fila) => fila.id}
    vacio={<EmptyState ilustracion="uv-dtf" titulo="Sin eventos" descripcion="No hay eventos con estos filtros." />}
    paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina, hrefPagina }}
    className="min-w-0 md:[&_table]:min-w-[40rem] [&_table]:table-fixed[&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_td]:px-2 [&_th]:px-2" />;
}
