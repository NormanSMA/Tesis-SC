import { DataTable } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { Money } from "@/components/comunes/ValorFormateado";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearCantidad, formatearCantidadPorUnidad, formatearPorcentaje } from "@/lib/formato";

import type { FichaProducto as Ficha } from "../tipos";
import { esMargenBajo, margenPct } from "./margen";

const unidadDe = (ficha: Ficha) => (ficha.unidadCobro === "M2" ? "m²" : "unidad");

export function DatosProducto({ ficha, className }: { ficha: Ficha; className?: string }) {
  return <TarjetaSeccion titulo="Datos del producto" className={className}>
    <ListaDatos columnas={3} datos={[
      { etiqueta: "Código", valor: <span className="font-mono">{ficha.codigo}</span> },
      { etiqueta: "Categoría", valor: ficha.categoria.nombre },
      { etiqueta: "Unidad de cobro", valor: ficha.unidadCobro === "M2" ? "m²" : "Unidad" },
      { etiqueta: "Descripción", ancho: true,
        valor: <span className="font-normal break-words whitespace-pre-wrap text-slate-600">{ficha.descripcion ?? "Sin descripción."}</span> },
    ]} />
  </TarjetaSeccion>;
}

export function PrecioProducto({ ficha, className }: { ficha: Ficha; className?: string }) {
  const margen = margenPct(ficha.precioBase, ficha.costoUnitario);
  return <TarjetaSeccion titulo="Precio y margen" className={className}>
    <div className="space-y-4">
      <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        <Money valor={ficha.precioBase} /> <span className="text-sm font-normal text-slate-500">/ {unidadDe(ficha)}</span>
      </p>
      {ficha.costoUnitario !== undefined ? <dl className="grid gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs font-medium text-slate-500">Costo de referencia</dt>
          <dd className="text-sm font-medium tabular-nums">{ficha.costoUnitario === null ? "Sin costo de referencia" : `C$ ${formatearCantidad(ficha.costoUnitario, 4)}`}</dd>
        </div>
        {margen !== null ? <div className="flex items-center justify-between gap-3">
          <dt className="text-xs font-medium text-slate-500">Margen sobre el precio</dt>
          <dd><Badge variant={esMargenBajo(margen) ? "advertencia" : "exito"}>
            {esMargenBajo(margen) ? "Margen bajo " : ""}{formatearPorcentaje(margen, 1)}</Badge></dd>
        </div> : null}
      </dl> : null}
    </div>
  </TarjetaSeccion>;
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
    <TabsContent value="receta" className="pt-4">
      <TarjetaSeccion titulo="Receta de materiales" descripcion={`Cantidades por ${unidadDe(ficha)} de cobro.`} sinRelleno>
        <DataTable titulo="Receta del producto" filas={ficha.receta} idFila={(fila) => fila.materialId} className="rounded-none border-0 shadow-none"
          vacio={<EmptyState titulo="Sin receta" descripcion="Este producto no tiene materiales definidos." />}
          columnas={[
            { id: "material", encabezado: "Material", principal: true, celda: (fila) => <span className="whitespace-normal break-words">{fila.material.codigo} · {fila.material.nombre}{!fila.material.activo ? " (archivado)" : ""}</span> },
            { id: "unidad", encabezado: "Unidad", celda: (fila) => fila.material.unidad.toLowerCase() },
            { id: "cantidad", encabezado: "Cantidad", alinear: "derecha", celda: (fila) => formatearCantidadPorUnidad(fila.cantidad, fila.material.unidad) },
          ]} />
      </TarjetaSeccion>
    </TabsContent>
  </Tabs>;
}
