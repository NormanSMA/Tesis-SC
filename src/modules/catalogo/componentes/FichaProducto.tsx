import Image from "next/image";

import { DataTable } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Money } from "@/components/comunes/ValorFormateado";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearCantidad } from "@/lib/formato";

import { imagenPorCategoria } from "../imagenes";
import type { FichaProducto as Ficha } from "../tipos";

export function DatosProducto({ ficha }: { ficha: Ficha }) {
  return <Card>
    <CardHeader><CardTitle><h2>Datos del producto</h2></CardTitle></CardHeader>
    <CardContent className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-4">
        <div><dt className="text-sm text-muted-foreground">Código</dt><dd className="break-words">{ficha.codigo}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Categoría</dt><dd className="break-words">{ficha.categoria.nombre}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Unidad de cobro</dt><dd>{ficha.unidadCobro === "M2" ? "m²" : "Unidad"}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Precio base</dt><dd className="tabular-nums"><Money valor={ficha.precioBase} /></dd></div>
        {ficha.costoUnitario !== undefined ? <div><dt className="text-sm text-muted-foreground">Costo de referencia</dt>
          <dd className="tabular-nums">{ficha.costoUnitario === null ? "Sin costo de referencia" : `C$ ${formatearCantidad(ficha.costoUnitario, 4)}`}</dd>
        </div> : null}
      </dl>
      <p className="whitespace-pre-wrap break-words text-muted-foreground">{ficha.descripcion ?? "Sin descripción."}</p>
    </CardContent>
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
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Image src={imagenPorCategoria(ficha.categoria.nombre)} alt={`Producto: ${ficha.nombre}`} width={640} height={640}
          sizes="(min-width: 768px) 33vw, 100vw" className="aspect-square w-full rounded-lg object-cover" />
        <DatosProducto ficha={ficha} />
      </div>
    </TabsContent>
    <TabsContent value="receta" className="pt-4">
      <Card>
        <CardHeader><CardTitle><h2>Receta de materiales</h2></CardTitle>
          <CardDescription>Cantidades por {ficha.unidadCobro === "M2" ? "m²" : "unidad"} de cobro.</CardDescription>
        </CardHeader>
        <CardContent><DataTable titulo="Receta del producto" filas={ficha.receta} idFila={(fila) => fila.materialId}
          vacio={<EmptyState titulo="Sin receta" descripcion="Este producto no tiene materiales definidos." />}
          columnas={[
            { id: "material", encabezado: "Material", principal: true, celda: (fila) => <span className="whitespace-normal break-words">{fila.material.codigo} · {fila.material.nombre}{!fila.material.activo ? " (archivado)" : ""}</span> },
            { id: "unidad", encabezado: "Unidad", celda: (fila) => fila.material.unidad.toLowerCase() },
            { id: "cantidad", encabezado: "Cantidad", alinear: "derecha", celda: (fila) => formatearCantidad(fila.cantidad, 3) },
          ]} /></CardContent>
      </Card>
    </TabsContent>
  </Tabs>;
}
