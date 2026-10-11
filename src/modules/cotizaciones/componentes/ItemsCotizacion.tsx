import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { IconoServicio } from "@/components/comunes/IconoServicio";
import { Money } from "@/components/comunes/ValorFormateado";
import { Card } from "@/components/ui/card";
import { formatearCantidad } from "@/lib/formato";
import type { ItemDto, LineaDto } from "../tipos";

type Categorias = ReadonlyMap<string, string>;

function columnasItems(categorias: Categorias): ColumnaTabla<ItemDto>[] {
  return [
  { id: "descripcion", encabezado: "Descripción", principal: true, celda: (item) => {
    const categoria = categorias.get(item.categoriaId);
    return <div className="max-w-72 whitespace-normal">
      <p className="font-medium">{item.descripcion}</p>
      {categoria ? <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <IconoServicio categoria={categoria} tamano={20} decorativo /><span>{categoria}</span></p> : null}
      {item.ancho && item.alto ? <p className="text-xs text-muted-foreground">{item.ancho} × {item.alto} m</p> : null}
    </div>;
  } },
  { id: "cantidad", encabezado: "Cantidad", alinear: "derecha", celda: (item) => formatearCantidad(item.cantidad, 3) },
  { id: "unidad", encabezado: "Cobro", celda: (item) => item.unidadCobro === "M2" ? "m²" : "Unidad" },
  { id: "precio", encabezado: "Precio unitario", alinear: "derecha", celda: (item) => <Money valor={item.precioUnitario} /> },
  { id: "importe", encabezado: "Importe", alinear: "derecha", celda: (item) => <Money valor={item.importe} /> },
  ];
}
const ETIQUETA = { MATERIAL: "Material", MANO_OBRA: "Mano de obra", TERCERO: "Tercero" };
const columnasLineas: ColumnaTabla<LineaDto>[] = [
  { id: "descripcion", encabezado: "Descripción", principal: true, celda: (linea) => <span className="block max-w-36 whitespace-normal">{linea.descripcion}</span> },
  { id: "tipo", encabezado: "Tipo", celda: (linea) => ETIQUETA[linea.tipo] },
  { id: "cantidad", encabezado: "Consumo", alinear: "derecha", celda: (linea) => `${linea.cantidad} ${linea.unidad}` },
  { id: "costo", encabezado: "Costo unitario", alinear: "derecha", celda: (linea) => <Money valor={linea.costoUnitario} /> },
  { id: "merma", encabezado: "Merma", alinear: "derecha", celda: (linea) => `${linea.mermaPct} %` },
  { id: "importe", encabezado: "Importe", alinear: "derecha", celda: (linea) => <Money valor={linea.importe} /> },
];

function CostosItem({ item }: { item: ItemDto }) {
  return <details className="rounded-md border px-4">
    <summary className="flex min-h-10 cursor-pointer items-center rounded-md py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
      Costos del ítem {item.secuencia}: {item.descripcion}
    </summary>
    <dl className="my-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
      <div><dt>Costo total</dt><dd><Money valor={item.costoTotal} /></dd></div>
      <div><dt>Margen sobre precio</dt><dd>{item.margenPct} %</dd></div>
    </dl>
    <p className="mb-3 text-sm text-muted-foreground">Los consumos corresponden al ítem completo.</p>
    <DataTable titulo={`Líneas de costo del ítem ${item.secuencia}`} columnas={columnasLineas} filas={item.lineas} idFila={(linea) => linea.id} />
  </details>;
}

/** Sección plegable con los costos y el margen de cada ítem personalizado. Solo uso interno. */
export function CostosInternosCotizacion({ items, margenPct }: { items: ItemDto[]; margenPct: string | null }) {
  const personalizados = items.filter((item) => item.tipo === "PERSONALIZADO");
  if (!personalizados.length) return null;
  return <Card className="px-5"><details>
    <summary className="flex min-h-10 cursor-pointer items-center rounded-md text-base font-semibold focus-visible:outline-2 focus-visible:outline-ring">
      Costos internos
    </summary>
    <dl className="my-4 flex justify-between gap-4 text-sm"><dt>Margen de ítems personalizados</dt>
      <dd>{margenPct === null ? "—" : `${margenPct} %`}</dd></dl>
    <div className="space-y-3">{personalizados.map((item) => <CostosItem key={item.id} item={item} />)}</div>
  </details></Card>;
}

/** `categorias` traduce categoriaId a nombre para mostrar la ilustración del servicio. Sin ella, no hay ilustración. */
export function ItemsCotizacion({ items, mostrarCostos = true, categorias = [] }: {
  items: ItemDto[]; mostrarCostos?: boolean; categorias?: { id: string; nombre: string }[];
}) {
  const nombres = new Map(categorias.map((categoria) => [categoria.id, categoria.nombre]));
  return <div className="space-y-4">
    <DataTable titulo="Ítems de cotización" columnas={columnasItems(nombres)} filas={items} idFila={(item) => item.id} />
    {mostrarCostos ? items.filter((item) => item.tipo === "PERSONALIZADO").map((item) => <CostosItem key={item.id} item={item} />) : null}
  </div>;
}
