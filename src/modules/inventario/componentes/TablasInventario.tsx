import Link from "next/link";
import { ETIQUETA_MOVIMIENTO, etiquetar } from "../etiquetas";
import { BarraProgresoAnimada } from "@/components/comunes/BarraProgresoAnimada";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatearCantidad, formatearCantidadConUnidad, formatearCantidadPorUnidad, formatearFechaHora, nombreUnidad } from "@/lib/formato";
import { textoOrden, type Orden } from "@/lib/listas/orden";
import { cn } from "@/lib/utils";
import type { ListaMateriales, ListaMovimientos, MaterialDto, MovimientoDto } from "../dto";

/** Enlace extendido: toda la fila navega al material. El resto de las celdas es solo texto. */
const ENLACE_FILA = "font-medium text-primary underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] hover:underline";
const CLASES_FILA_ENLAZADA = "[&_tbody_tr]:cursor-pointer [&_tbody_tr:has(a:focus-visible)]:outline-2 [&_tbody_tr:has(a:focus-visible)]:-outline-offset-2 [&_tbody_tr:has(a:focus-visible)]:outline-ring";
/** Escritorio: tabla. Móvil (menos de 768 px): una tarjeta apilada por fila, sin desplazamiento horizontal. */
const CLASES_TABLA = [
  "[&_tbody_tr]:relative",
  "max-md:[&_thead]:sr-only max-md:[&_tr]:grid max-md:[&_tr]:h-auto max-md:[&_tr]:grid-cols-1 max-md:[&_tr]:gap-y-1 max-md:[&_tr]:px-4 max-md:[&_tr]:py-3",
  "max-md:[&_td]:whitespace-normal max-md:[&_td]:p-0 max-md:[&_td]:text-left max-md:[&_th]:whitespace-normal max-md:[&_th]:p-0",
].join(" ");
const ETIQUETA_MOVIL = "text-muted-foreground md:hidden";

/** Vocabulario único de alerta de stock en lista y ficha: "Sin existencia" o "Bajo mínimo". */
export function etiquetaAlertaMaterial(alerta: MaterialDto["alerta"]): string | null {
  if (!alerta) return null;
  return alerta === "Sin existencia" ? "Sin existencia" : "Bajo mínimo";
}
export function EstadoMaterial({ material }: { material: Pick<MaterialDto, "activo" | "alerta"> }) {
  const alerta = etiquetaAlertaMaterial(material.alerta);
  return <div className="flex flex-wrap gap-1"><Badge variant="neutro">{material.activo ? "Activo" : "Archivado"}</Badge>
    {alerta ? <Badge variant="advertencia">{alerta}</Badge> : null}</div>;
}
export function EstadoListaMaterial({ material }: { material: Pick<MaterialDto, "activo" | "alerta"> }) {
  if (!material.activo) return <Badge variant="neutro">Archivado</Badge>;
  if (material.alerta === "Sin existencia") return <Badge variant="peligro">Sin existencia</Badge>;
  return material.alerta ? <Badge variant="advertencia">Bajo mínimo</Badge> : <Badge variant="neutro">Normal</Badge>;
}
/** Tono de la barra de existencia: advertencia bajo el mínimo, peligro sin existencia. */
export function tonoExistencia(material: Pick<MaterialDto, "activo" | "alerta">) {
  return material.alerta === "Sin existencia" ? "peligro" : material.alerta ? "advertencia" : material.activo ? "exito" : "primario";
}
/** Existencia y su barra frente al mínimo. */
export function ExistenciaMaterial({ material }: { material: Pick<MaterialDto, "nombre" | "unidad" | "existencia" | "stockMinimo" | "activo" | "alerta"> }) {
  const minimo = Number(material.stockMinimo);
  const tono = tonoExistencia(material);
  return <div className="min-w-0 md:w-60">
    <p className="font-medium tabular-nums"><span className={cn(ETIQUETA_MOVIL, "font-normal")}>Existencia: </span>
      {formatearCantidadConUnidad(material.existencia, material.unidad)}</p>
    {minimo > 0
      ? <BarraProgresoAnimada className="mt-1 [&>span]:min-w-20 [&>span]:text-right" valor={Number(material.existencia)} total={minimo} tono={tono}
        etiqueta={`Existencia de ${material.nombre} frente al mínimo`} texto={`Mín. ${formatearCantidadPorUnidad(material.stockMinimo, material.unidad)}`} />
      : <p className="text-xs text-muted-foreground">Sin mínimo definido</p>}
  </div>;
}
const columnasMaterial: ColumnaTabla<MaterialDto>[] = [
  { id: "material", encabezado: "Material", celda: (fila) => <div className="min-w-0">
    <Link className={ENLACE_FILA} href={`/inventario/${fila.id}`}>{fila.nombre}</Link>
    <p className="truncate text-xs text-muted-foreground" title={`${fila.codigo} · ${nombreUnidad(fila.unidad)}`}>{fila.codigo} · {nombreUnidad(fila.unidad)}</p></div> },
  { id: "existencia", encabezado: "Existencia frente al mínimo", celda: (fila) => <ExistenciaMaterial material={fila} /> },
  { id: "estado", encabezado: "Estado", celda: (fila) => <EstadoListaMaterial material={fila} /> },
];
const TONO_MOVIMIENTO = { ENTRADA: "exito", CONSUMO: "info", AJUSTE: "advertencia", DEVOLUCION: "acento" } as const;
function celdaMovimiento(fila: MovimientoDto, sinMaterial: boolean) {
  const tono = TONO_MOVIMIENTO[fila.tipo as keyof typeof TONO_MOVIMIENTO] ?? "neutro";
  const detalle = fila.referencia ?? fila.motivo;
  return <div className="min-w-0 max-w-48 max-md:max-w-full lg:max-w-72">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant={tono}>{etiquetar(ETIQUETA_MOVIMIENTO, fila.tipo)}</Badge>
      {fila.orden ? <Link className="relative z-10 text-sm text-primary underline-offset-4 hover:underline" href={`/ordenes/${fila.orden.id}`}>{fila.orden.numero}</Link> : null}
    </div>
    {sinMaterial ? null : <Link className={cn(ENLACE_FILA, "block truncate")} href={`/inventario/${fila.material.id}`} title={fila.material.nombre}>{fila.material.nombre}</Link>}
    {detalle ? <p className="truncate text-xs text-muted-foreground" title={detalle}>{detalle}</p> : null}
  </div>;
}
function columnasLibro(sinMaterial: boolean): ColumnaTabla<MovimientoDto>[] {
  return [
    { id: "fecha", encabezado: "Fecha (Managua)", celda: (fila) => <div>{formatearFechaHora(fila.creadoEn)}
      <span className="block text-xs text-muted-foreground">{fila.usuario.nombre}</span></div> },
    { id: "tipo", encabezado: "Movimiento", celda: (fila) => celdaMovimiento(fila, sinMaterial) },
    { id: "cantidad", encabezado: "Cantidad", alinear: "derecha", celda: (fila) => <div className="tabular-nums">
      <span className={ETIQUETA_MOVIL}>Cantidad: </span>{formatearCantidadPorUnidad(fila.cantidad, fila.material.unidad)}
      <span className="block text-xs text-muted-foreground"><span className="md:hidden">Existencia resultante: </span>
        <span className="max-md:hidden">Saldo </span>{formatearCantidadPorUnidad(fila.existenciaResultante, fila.material.unidad)}</span></div> },
    { id: "costo", encabezado: "Costos (C$)", alinear: "derecha", celda: (fila) => fila.costoUnitario === undefined
      ? <span className="text-xs text-muted-foreground">Sin permiso</span>
      : <div className="tabular-nums"><span>Unitario: {formatearCantidad(fila.costoUnitario, 4)}</span>
        <span className="block text-xs text-muted-foreground">Promedio: {formatearCantidad(fila.costoPromedioResultante, 4)}</span></div> },
  ];
}
export function hrefInventario(entrada: { ruta: string; consulta: object; pagina: number }) {
  const parametros = new URLSearchParams();
  const valores: Record<string, unknown> = { ...entrada.consulta, pagina: entrada.pagina };
  Object.entries(valores).forEach(([campo, valor]) => {
    if (valor === undefined || valor === "") return;
    // `ordenar` llega como objeto ya validado; la URL lo guarda como `campo:direccion`.
    parametros.set(campo, campo === "ordenar" ? textoOrden(valor as Orden<string>) : String(valor));
  });
  return `${entrada.ruta}?${parametros}`;
}
function Vacio({ total, filtrado, sinRegistros, limpiar, primera }: {
  total: number; filtrado: boolean; sinRegistros: string; limpiar: string; primera: string }) {
  if (total > 0) return <EmptyState ilustracion="muebles" titulo="Esa página no existe" descripcion={`La búsqueda tiene ${total} resultados en menos páginas.`}
    accion={<Button asChild variant="outline"><Link href={primera}>Ir a la primera página</Link></Button>} />;
  if (!filtrado) return <EmptyState ilustracion="muebles" titulo="Sin registros" descripcion={sinRegistros} />;
  return <EmptyState ilustracion="muebles" titulo="Sin resultados" descripcion="Nada coincide con la búsqueda. Pruebe con otros términos o quite los filtros."
    accion={<Button asChild variant="outline"><Link href={limpiar}>Limpiar filtros</Link></Button>} />;
}
export function TablaMateriales({ lista, consulta }: { lista: ListaMateriales; consulta: { q?: string; estado?: string; porPagina?: number; ordenar?: Orden<string> } }) {
  return <ZonaResultados>
    <DataTable titulo="Materiales del inventario" filas={lista.datos} columnas={columnasMaterial}
      vacio={<Vacio total={lista.total} filtrado={Boolean(consulta.q || consulta.estado)} sinRegistros="Registre el primer material para controlar existencias."
        limpiar="/inventario" primera={hrefInventario({ ruta: "/inventario", consulta, pagina: 1 })} />}
      idFila={(fila) => fila.id} className={cn(CLASES_TABLA, CLASES_FILA_ENLAZADA)} claveConsulta={JSON.stringify(consulta)}
      paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
        hrefPagina: (pagina) => hrefInventario({ ruta: "/inventario", consulta, pagina }) }} />
  </ZonaResultados>;
}
export function TablaMovimientos({ lista, consulta, ruta = "/inventario", sinMaterial = false }: {
  lista: ListaMovimientos; consulta: object; ruta?: string; sinMaterial?: boolean }) {
  const parametros = { ...consulta, ...(sinMaterial ? {} : { pestana: "movimientos" }) };
  const filtrado = ["tipo", "material", "orden", "usuario", "desde", "hasta"].some((clave) => (consulta as Record<string, unknown>)[clave]);
  return <ZonaResultados>
    <DataTable titulo="Libro de movimientos del inventario" filas={lista.datos} columnas={columnasLibro(sinMaterial)}
      vacio={<Vacio total={lista.total} filtrado={filtrado} sinRegistros="Aún no hay movimientos en el libro."
        limpiar={sinMaterial ? ruta : "/inventario?pestana=movimientos"} primera={hrefInventario({ ruta, consulta: parametros, pagina: 1 })} />}
      idFila={(fila) => fila.id} className={cn(CLASES_TABLA, !sinMaterial && CLASES_FILA_ENLAZADA)} claveConsulta={JSON.stringify(consulta)}
      paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
        hrefPagina: (pagina) => hrefInventario({ ruta, consulta: parametros, pagina }) }} />
  </ZonaResultados>;
}
