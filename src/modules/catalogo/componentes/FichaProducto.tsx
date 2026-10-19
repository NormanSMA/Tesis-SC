import type { ReactNode } from "react";

import { DataTable } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Money } from "@/components/comunes/ValorFormateado";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearCantidad, formatearCantidadPorUnidad, formatearPorcentaje } from "@/lib/formato";
import { cn } from "@/lib/utils";

import type { FichaProducto as Ficha } from "../tipos";
import { esMargenBajo, margenPct } from "./margen";

const TARJETA = "gap-4 rounded-2xl border-slate-200/80 px-5";
const unidadDe = (ficha: Ficha) => (ficha.unidadCobro === "M2" ? "m²" : "unidad");

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-sm text-muted-foreground">{etiqueta}</dt>
    <dd className="mt-0.5 break-words">{children}</dd></div>;
}

export function DatosProducto({ ficha, className }: { ficha: Ficha; className?: string }) {
  return <Card className={cn(TARJETA, className)} aria-labelledby="datos-producto">
    <h2 id="datos-producto" className="text-lg font-medium text-slate-900">Datos del producto</h2>
    <dl className="grid gap-4 sm:grid-cols-3">
      <Dato etiqueta="Código"><span className="font-mono">{ficha.codigo}</span></Dato>
      <Dato etiqueta="Categoría">{ficha.categoria.nombre}</Dato>
      <Dato etiqueta="Unidad de cobro">{ficha.unidadCobro === "M2" ? "m²" : "Unidad"}</Dato>
    </dl>
    <p className="border-t border-slate-100 pt-4 break-words whitespace-pre-wrap text-muted-foreground">{ficha.descripcion ?? "Sin descripción."}</p>
  </Card>;
}

export function PrecioProducto({ ficha, className }: { ficha: Ficha; className?: string }) {
  const margen = margenPct(ficha.precioBase, ficha.costoUnitario);
  return <Card className={cn(TARJETA, className)} aria-labelledby="precio-producto">
    <h2 id="precio-producto" className="text-lg font-medium text-slate-900">Precio y margen</h2>
    <p className="text-3xl font-normal tracking-tight text-slate-900 tabular-nums">
      <Money valor={ficha.precioBase} /> <span className="text-sm text-muted-foreground">/ {unidadDe(ficha)}</span>
    </p>
    {ficha.costoUnitario !== undefined ? <dl className="grid gap-3 border-t border-slate-100 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-muted-foreground">Costo de referencia</dt>
        <dd className="tabular-nums">{ficha.costoUnitario === null ? "Sin costo de referencia" : `C$ ${formatearCantidad(ficha.costoUnitario, 4)}`}</dd>
      </div>
      {margen !== null ? <div className="flex items-center justify-between gap-3">
        <dt className="text-sm text-muted-foreground">Margen sobre el precio</dt>
        <dd><Badge variant={esMargenBajo(margen) ? "advertencia" : "exito"}>
          {esMargenBajo(margen) ? "Margen bajo " : ""}{formatearPorcentaje(margen, 1)}</Badge></dd>
      </div> : null}
    </dl> : null}
  </Card>;
}

const LISTA_PESTANAS = "h-auto w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto";
const PESTANA = "h-10 min-h-10 flex-none px-4";

export function FichaProducto({ ficha }: { ficha: Ficha }) {
  return <Tabs defaultValue="resumen">
    <TabsList variant="line" className={LISTA_PESTANAS} aria-label="Secciones de la ficha">
      <TabsTrigger value="resumen" className={PESTANA}>Resumen</TabsTrigger>
      <TabsTrigger value="receta" className={PESTANA}>Receta</TabsTrigger>
    </TabsList>
    <TabsContent value="resumen" className="pt-4">
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <DatosProducto ficha={ficha} className="lg:col-span-2" />
        <PrecioProducto ficha={ficha} />
      </div>
    </TabsContent>
    <TabsContent value="receta" className="space-y-3 pt-4">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Receta de materiales</h2>
        <p className="text-sm text-muted-foreground">Cantidades por {unidadDe(ficha)} de cobro.</p>
      </div>
      <DataTable titulo="Receta del producto" filas={ficha.receta} idFila={(fila) => fila.materialId} className="rounded-2xl"
        vacio={<EmptyState titulo="Sin receta" descripcion="Este producto no tiene materiales definidos." />}
        columnas={[
          { id: "material", encabezado: "Material", principal: true, celda: (fila) => <span className="whitespace-normal break-words">{fila.material.codigo} · {fila.material.nombre}{!fila.material.activo ? " (archivado)" : ""}</span> },
          { id: "unidad", encabezado: "Unidad", celda: (fila) => fila.material.unidad.toLowerCase() },
          { id: "cantidad", encabezado: "Cantidad", alinear: "derecha", celda: (fila) => formatearCantidadPorUnidad(fila.cantidad, fila.material.unidad) },
        ]} />
    </TabsContent>
  </Tabs>;
}
