import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { KpiCard } from "@/components/comunes/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import type { PanelDto } from "../service";

const ESTILO = "min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2";
function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section aria-label={titulo} className="min-w-0"><Card className="min-w-0"><CardHeader>
    <CardTitle className="text-lg">{titulo}</CardTitle></CardHeader><CardContent className="min-w-0 space-y-4">{children}</CardContent></Card></section>;
}
type Cotizacion = NonNullable<PanelDto["cotizaciones"]>["filas"][number];
const columnasCotizacion: ColumnaTabla<Cotizacion>[] = [
  { id: "numero", encabezado: "Cotización", celda: (fila) => <Link className="font-medium text-primary underline" href={fila.href}>{fila.numero}</Link> },
  { id: "cliente", encabezado: "Cliente", celda: (fila) => fila.cliente },
  { id: "vencimiento", encabezado: "Vencimiento", celda: (fila) => formatearFecha(fila.vencimiento) },
  { id: "importe", encabezado: "Total", celda: (fila) => formatearMoneda(fila.total) },
];
export function CotizacionesPanel({ datos }: { datos: NonNullable<PanelDto["cotizaciones"]> }) {
  return <Bloque titulo="Cotizaciones pendientes"><div className="grid gap-4 sm:grid-cols-3">
    <KpiCard etiqueta="Enviadas vigentes" valor={datos.cantidad} ayuda="Pendientes de respuesta" />
    <KpiCard etiqueta="Vencen pronto" valor={datos.vencenPronto} ayuda="Hoy y siguientes 3 días" />
    <KpiCard etiqueta="Por marcar vencidas" valor={datos.porMarcarVencidas} ayuda="Vigencia finalizada" /></div>
    <DataTable titulo="Cotizaciones próximas a vencer" columnas={columnasCotizacion} filas={datos.filas}
      idFila={(fila) => fila.href} className={ESTILO} vacio={<EmptyState titulo="Sin cotizaciones pendientes" descripcion="No hay cotizaciones enviadas vigentes." />} />
    <Link href="/cotizaciones?estado=ENVIADA" className="inline-flex min-h-11 items-center text-primary underline">Consultar cotizaciones</Link>
  </Bloque>;
}
type Material = NonNullable<PanelDto["materiales"]>["filas"][number];
const columnasMaterial: ColumnaTabla<Material>[] = [
  { id: "material", encabezado: "Material", celda: (fila) => <Link className="font-medium text-primary underline" href={fila.href}>{fila.nombre}<span className="block text-xs">{fila.codigo}</span></Link> },
  { id: "existencia", encabezado: "Existencia", celda: (fila) => fila.existencia },
  { id: "minimo", encabezado: "Stock mínimo", celda: (fila) => fila.stockMinimo },
  { id: "alerta", encabezado: "Alerta", celda: (fila) => <span className="font-medium">{fila.alerta}</span> },
];
export function MaterialesPanel({ datos }: { datos: NonNullable<PanelDto["materiales"]> }) {
  return <Bloque titulo="Materiales disponibles"><div className="grid gap-4 sm:grid-cols-2">
    <KpiCard etiqueta="Materiales en alerta" valor={datos.enAlerta} ayuda="Existencia menor o igual al mínimo" />
    <KpiCard etiqueta="Sin existencia" valor={datos.sinExistencia} ayuda="Materiales activos con existencia cero" /></div>
    <DataTable titulo="Materiales en alerta" columnas={columnasMaterial} filas={datos.filas} idFila={(fila) => fila.href}
      className={ESTILO} vacio={<EmptyState titulo="Sin alertas de materiales" descripcion="Los materiales activos no requieren reposición por stock mínimo." />} />
    <Link href="/inventario" className="inline-flex min-h-11 items-center text-primary underline">Consultar inventario</Link>
  </Bloque>;
}
type Grupo = NonNullable<PanelDto["carga"]>["porArea"][number];
function GruposCarga({ titulo, grupos }: { titulo: string; grupos: Grupo[] }) {
  return <div className="min-w-0 space-y-3"><h3 className="font-semibold">{titulo}</h3>
    {grupos.length ? <ul className="space-y-3">{grupos.map((grupo) => <li key={grupo.href + grupo.nombre} className="break-words rounded-md border p-3">
      <Link href={grupo.href} className="inline-flex min-h-11 items-center font-medium text-primary underline">{grupo.nombre}</Link>
      <p className="text-sm">Etapas abiertas: {grupo.cantidad}. Atrasadas: {grupo.atrasadas}.</p>
      <ul className="mt-2 space-y-2">{grupo.etapas.map((etapa, indice) => <li key={`${etapa.href}-${indice}`}>
        <Link href={etapa.href} className="text-primary underline">{etapa.numero}: {etapa.nombre}</Link>
        {etapa.atrasada ? <span className="ml-2 font-medium">Atrasada</span> : null}</li>)}</ul></li>)}</ul>
      : <p className="text-sm text-muted-foreground">Sin etapas abiertas.</p>}</div>;
}
export function CargaPanel({ datos }: { datos: NonNullable<PanelDto["carga"]> }) {
  return <Bloque titulo="Carga de trabajo"><ul className="grid gap-3 sm:grid-cols-3">{datos.porEstado.map((fila) =>
    <li key={fila.estado}><Link href={fila.href} className="inline-flex min-h-11 items-center text-primary underline">{fila.estado}: {fila.cantidad}</Link></li>)}</ul>
    <div className="grid min-w-0 gap-6 xl:grid-cols-2"><GruposCarga titulo="Por responsable" grupos={datos.porResponsable} />
      <GruposCarga titulo="Por área" grupos={datos.porArea} /></div>
    <h3 className="font-semibold">Entregas próximas</h3>{datos.entregas.length ? <ul className="space-y-2">{datos.entregas.map((fila) =>
      <li key={fila.href} className="break-words"><Link href={fila.href} className="inline-flex min-h-11 items-center text-primary underline">{fila.numero}</Link>
        <span className="ml-2">{formatearFecha(fila.fechaEntrega)}. {fila.estado}. {fila.responsable}.</span></li>)}</ul>
      : <p className="text-sm text-muted-foreground">Sin entregas en los siguientes 7 días.</p>}
  </Bloque>;
}
export function ResumenPanel({ datos }: { datos: NonNullable<PanelDto["resumen"]> }) {
  return <section aria-label="Resumen de la operación" className="space-y-3"><h2 className="text-lg font-semibold">Resumen de la operación</h2>
    <div className="grid gap-4 sm:grid-cols-3"><KpiCard etiqueta="Órdenes en producción" valor={datos.enProduccion} ayuda="Trabajo en producción" />
      <KpiCard etiqueta="Órdenes atrasadas" valor={datos.atrasadas} ayuda="Fecha de entrega pasada" />
      <KpiCard etiqueta="Entregas próximas" valor={datos.entregasProximas} ayuda="Hoy y siguientes 7 días" /></div></section>;
}
