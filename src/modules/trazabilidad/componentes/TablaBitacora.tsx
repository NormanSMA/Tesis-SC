"use client";

import Link from "next/link";
import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { formatearFechaHora } from "@/lib/formato";
import { textoOrden } from "@/lib/listas/orden";
import { textoCambioEstado } from "../etiquetas";
import type { ConsultaBitacora } from "../schema";
import type { EventoTrazabilidad, ListaBitacora } from "../tipos";

export function EstadoEvento({ evento }: { evento: EventoTrazabilidad }) {
  const cambio = textoCambioEstado(evento.estadoAnterior, evento.estadoNuevo);
  return cambio ? <p className="mt-1 text-sm">{cambio}</p> : null;
}
const columnas: ColumnaTabla<EventoTrazabilidad>[] = [
  { id: "fecha", encabezado: "Fecha y usuario", principal: true, celda: (fila) => <div className="flex items-start gap-3">
    <AvatarIniciales nombre={fila.usuario.nombre} className="max-md:hidden" />
    <div className="min-w-0"><time dateTime={fila.creadoEn}>{formatearFechaHora(fila.creadoEn)}</time><p className="mt-1 font-medium">{fila.usuario.nombre}</p></div></div> },
  { id: "accion", encabezado: "Acción y estado", celda: (fila) => <>{fila.accion}<EstadoEvento evento={fila} /></> },
  { id: "registro", encabezado: "Entidad y registro", celda: (fila) => <><p>{fila.entidad}</p>
    {fila.registro.href ? <Link href={fila.registro.href} className="font-medium text-primary underline">{fila.registro.nombre}</Link> : fila.registro.nombre}</> },
  { id: "detalle", encabezado: "Detalle", celda: (fila) => fila.resumen || "Sin detalle adicional" },
];
export function TablaBitacora({ lista, consulta }: { lista: ListaBitacora; consulta: ConsultaBitacora }) {
  const hrefPagina = (pagina: number) => {
    const { ordenar, ...resto } = consulta;
    const parametros = new URLSearchParams(Object.entries(resto).filter(([, valor]) => valor !== undefined)
      .map(([campo, valor]) => [campo, String(valor)]));
    if (ordenar) parametros.set("ordenar", textoOrden(ordenar));
    parametros.set("pagina", String(pagina));
    return `/trazabilidad?${parametros}`;
  };
  return <ZonaResultados><DataTable apilarEnMovil titulo="Bitácora global" filas={lista.datos} columnas={columnas} idFila={(fila) => fila.id}
    vacio={<EmptyState ilustracion="uv-dtf" titulo="Sin eventos" descripcion="No hay eventos con estos filtros." />}
    paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina, hrefPagina }}
    className="min-w-0 max-md:[&_tbody_td]:flex-col max-md:[&_tbody_td]:items-stretch max-md:[&_tbody_td]:gap-0.5 max-md:[&_tbody_th]:flex-col max-md:[&_tbody_th]:items-stretch max-md:[&_tbody_th]:gap-0.5 md:[&_table]:min-w-[40rem] [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_td]:px-2 [&_th]:px-2" /></ZonaResultados>;
}
