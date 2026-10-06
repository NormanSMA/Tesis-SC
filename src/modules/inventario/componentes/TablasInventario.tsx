import Link from "next/link";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatearCantidad, formatearFechaHora } from "@/lib/formato";
import type { ListaMateriales, ListaMovimientos, MaterialDto, MovimientoDto } from "../dto";

const ESTILO_TABLA = "min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_th]:px-2 [&_td]:px-2";
export function EstadoMaterial({ material }: { material: Pick<MaterialDto, "activo" | "alerta"> }) {
  return <div className="flex flex-wrap gap-1"><Badge variant="neutro">{material.activo ? "Activo" : "Archivado"}</Badge>
    {material.alerta ? <Badge variant="advertencia">{material.alerta}</Badge> : null}</div>;
}
const columnasMaterial: ColumnaTabla<MaterialDto>[] = [
  { id: "material", encabezado: "Material", principal: true, celda: (fila) => <div>
    <Link className="font-medium text-primary underline" href={`/inventario/${fila.id}`}>{fila.nombre}</Link>
    <span className="block text-xs text-muted-foreground">{fila.codigo}</span></div> },
  { id: "existencia", encabezado: "Existencia", alinear: "derecha", celda: (fila) => <div>
    {formatearCantidad(fila.existencia, 3)}<span className="block text-xs">{fila.unidad}</span></div> },
  { id: "minimo", encabezado: "Stock mínimo", alinear: "derecha", celda: (fila) => formatearCantidad(fila.stockMinimo, 3) },
  { id: "costo", encabezado: "Costo promedio (C$)", alinear: "derecha", celda: (fila) => formatearCantidad(fila.costoPromedio, 4) },
  { id: "estado", encabezado: "Estado", celda: (fila) => <EstadoMaterial material={fila} /> },
];
const columnasLibro: ColumnaTabla<MovimientoDto>[] = [
  { id: "fecha", encabezado: "Fecha (Managua)", principal: true, celda: (fila) => <div>{formatearFechaHora(fila.creadoEn)}
    <span className="block text-xs">{fila.usuario.nombre}</span></div> },
  { id: "material", encabezado: "Material", celda: (fila) => <Link className="text-primary underline" href={`/inventario/${fila.material.id}`}>{fila.material.nombre}</Link> },
  { id: "tipo", encabezado: "Movimiento", celda: (fila) => <div><Badge variant="neutro">{fila.tipo}</Badge>
    {fila.orden ? <Link className="block text-primary underline" href={`/ordenes/${fila.orden.id}`}>{fila.orden.numero}</Link> : null}
    <span className="block text-xs">{fila.referencia ?? fila.motivo}</span></div> },
  { id: "cantidad", encabezado: "Cantidad", alinear: "derecha", celda: (fila) => formatearCantidad(fila.cantidad, 3) },
  { id: "saldo", encabezado: "Existencia resultante", alinear: "derecha", celda: (fila) => formatearCantidad(fila.existenciaResultante, 3) },
  { id: "costo", encabezado: "Costos (C$)", alinear: "derecha", celda: (fila) => fila.costoUnitario === undefined
    ? <span className="text-xs">Sin permiso</span> : <div><span>Unitario: {formatearCantidad(fila.costoUnitario, 4)}</span>
      <span className="block text-xs">Promedio: {formatearCantidad(fila.costoPromedioResultante, 4)}</span></div> },
];
export function hrefInventario(entrada: { ruta: string; consulta: object; pagina: number }) {
  const parametros = new URLSearchParams();
  const valores: Record<string, unknown> = { ...entrada.consulta, pagina: entrada.pagina };
  Object.entries(valores).forEach(([campo, valor]) => {
    if (valor !== undefined && valor !== "") parametros.set(campo, String(valor));
  });
  return `${entrada.ruta}?${parametros}`;
}
export function TablaMateriales({ lista, consulta }: { lista: ListaMateriales; consulta: object }) {
  return <DataTable titulo="Materiales del inventario" filas={lista.datos} columnas={columnasMaterial}
    idFila={(fila) => fila.id} className={ESTILO_TABLA} paginacion={{ pagina: lista.pagina, total: lista.total,
      tamano: lista.porPagina, hrefPagina: (pagina) => hrefInventario({ ruta: "/inventario", consulta, pagina }) }} />;
}
export function TablaMovimientos({ lista, consulta, ruta = "/inventario" }: { lista: ListaMovimientos; consulta: object; ruta?: string }) {
  return <DataTable titulo="Libro de movimientos del inventario" filas={lista.datos} columnas={columnasLibro}
    idFila={(fila) => fila.id} className={ESTILO_TABLA} paginacion={{ pagina: lista.pagina, total: lista.total,
      tamano: lista.porPagina, hrefPagina: (pagina) => hrefInventario({ ruta, consulta: { ...consulta, pestana: "movimientos" }, pagina }) }} />;
}
