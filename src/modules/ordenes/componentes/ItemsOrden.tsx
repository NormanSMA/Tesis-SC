import { Card } from "@/components/ui/card";
import { Money } from "@/components/comunes/ValorFormateado";
import { formatearCantidad } from "@/lib/formato";
import type { ItemOrden, LineaOrden } from "../tipos";

function LineaItem({ linea }: { linea: LineaOrden }) {
  return <li className="space-y-1 border-t pt-3 text-sm">
    <p className="font-medium break-words [overflow-wrap:anywhere]">Línea {linea.secuencia}: {linea.descripcion}</p>
    <p>{formatearCantidad(linea.cantidad, 3)} {linea.unidad}{linea.tipo === "MATERIAL" ? ` · Merma: ${linea.mermaPct} %` : ""}</p>
    {linea.material ? <p className="break-words">Material: {linea.material.nombre} ({linea.material.unidad})</p> : null}
    {linea.costoUnitario !== undefined ? <p>Costo unitario: <Money valor={linea.costoUnitario} /> · Importe: <Money valor={linea.importe} /></p> : null}
  </li>;
}

function FichaItem({ item }: { item: ItemOrden }) {
  return <Card className="min-w-0 px-5"><h3 className="font-semibold break-words [overflow-wrap:anywhere]">
    {item.secuencia}. {item.descripcion}</h3>
    <p className="text-sm break-words">{item.categoria.nombre} · {item.tipo === "CATALOGO" ? "Catálogo" : "Personalizado"}</p>
    <p>Cantidad: {formatearCantidad(item.cantidad, 3)} {item.unidadCobro === "M2" ? "m²" : "unidades"}</p>
    {item.ancho && item.alto ? <p>Medidas: {item.ancho} × {item.alto} m</p> : null}
    {item.precioUnitario !== undefined ? <dl className="grid gap-3 sm:grid-cols-2">
      <div><dt className="text-sm text-muted-foreground">Precio unitario</dt><dd><Money valor={item.precioUnitario} /></dd></div>
      <div><dt className="text-sm text-muted-foreground">Importe</dt><dd><Money valor={item.importe} /></dd></div>
      {item.costoTotal !== null && item.costoTotal !== undefined ? <>
        <div><dt className="text-sm text-muted-foreground">Costo total</dt><dd><Money valor={item.costoTotal} /></dd></div>
        <div><dt className="text-sm text-muted-foreground">Margen</dt><dd>{item.margenPct} %</dd></div></> : null}
    </dl> : null}
    {item.lineas.length ? <ul aria-label={`Líneas del ítem ${item.secuencia}`} className="space-y-3">
      {item.lineas.map((linea) => <LineaItem key={linea.id} linea={linea} />)}</ul> : null}
  </Card>;
}

export function ItemsOrden({ items }: { items: ItemOrden[] }) {
  return <section aria-labelledby="titulo-items-orden"><h2 id="titulo-items-orden" className="mb-4 text-xl font-semibold">Ítems</h2>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">{items.map((item) => <FichaItem key={item.id} item={item} />)}</div>
  </section>;
}
