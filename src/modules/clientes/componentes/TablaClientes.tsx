import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import Link from "next/link";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { Button } from "@/components/ui/button";
import type { Orden } from "@/lib/listas/orden";
import type { ColumnaOpcional } from "../columnas";
import { ETIQUETA_TIPO } from "../schema";
import type { CampoOrdenCliente, ClienteFila, ListaClientes } from "../tipos";
import { EstadoCliente } from "./EstadoCliente";
import { NuevoCliente } from "./NuevoCliente";

function hrefPagina(parametros: Record<string, string>, pagina: number) {
  return `/clientes?${new URLSearchParams({ ...parametros, pagina: String(pagina) })}`;
}

const VACIO = <span data-vacio aria-label="Sin dato" className="text-muted-foreground">—</span>;

/** Enlace extendido: toda la fila navega a la ficha. El resto de las celdas es solo texto. */
const ENLACE_FILA = "font-medium text-primary underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] hover:underline";

function celdaCliente(cliente: ClienteFila, elegidas: readonly ColumnaOpcional[]) {
  const detalle = [
    elegidas.includes("codigoCliente") ? cliente.codigoCliente : null,
    elegidas.includes("tipo") ? ETIQUETA_TIPO[cliente.tipo] : null,
    elegidas.includes("ruc") ? cliente.ruc : null,
  ].filter(Boolean).join(" · ");
  return <div className="flex items-center gap-3">
    <AvatarIniciales nombre={cliente.nombre} />
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link href={`/clientes/${cliente.id}`} className={ENLACE_FILA}>{cliente.nombre}</Link>
        {cliente.activo ? null : <EstadoCliente activo={false} />}
      </div>
      {/* En tableta la línea gris se corta para que la tabla quepa; el texto completo queda en title. */}
      {detalle ? <p className="max-w-48 truncate text-xs text-muted-foreground lg:max-w-none max-md:max-w-full" title={detalle}>{detalle}</p> : null}
    </div>
  </div>;
}

// Contacto en dos líneas: persona arriba; teléfono y correo juntos abajo. Así la tabla cabe desde 768 px.
function celdaContacto(cliente: ClienteFila, elegidas: readonly ColumnaOpcional[]) {
  const contacto = elegidas.includes("contactoPrincipal") ? cliente.contactoPrincipal : null;
  const medios = [elegidas.includes("telefono") ? cliente.telefono : null, elegidas.includes("correo") ? cliente.correo : null]
    .filter(Boolean).join(" · ");
  if (!contacto && !medios) return VACIO;
  return <div className="min-w-0 max-w-52 max-md:max-w-full lg:max-w-80">
    {contacto ? <p className="truncate">{contacto}</p> : null}
    {medios ? <p className={contacto ? "truncate text-xs text-muted-foreground" : "truncate"} title={medios}>{medios}</p> : null}
  </div>;
}

function columnasDe(elegidas: readonly ColumnaOpcional[], conCotizaciones: boolean): ColumnaTabla<ClienteFila>[] {
  const columnas: ColumnaTabla<ClienteFila>[] = [
    { id: "cliente", encabezado: "Cliente", ordenable: "nombre", celda: (cliente) => celdaCliente(cliente, elegidas) },
  ];
  if (elegidas.includes("contactoPrincipal") || elegidas.includes("telefono") || elegidas.includes("correo")) {
    columnas.push({ id: "contacto", encabezado: "Contacto", celda: (cliente) => celdaContacto(cliente, elegidas) });
  }
  if (conCotizaciones && elegidas.includes("cotizaciones")) {
    columnas.push({ id: "cotizaciones", encabezado: "Cotizaciones", alinear: "derecha", celda: (cliente) =>
      <span className="tabular-nums"><span className="text-muted-foreground md:hidden">Cotizaciones: </span>{cliente.cotizaciones ?? 0}</span> });
  }
  return columnas;
}

/** Escritorio: tabla. Móvil (menos de 768 px): una tarjeta apilada por fila, sin desplazamiento horizontal. */
const CLASES_TABLA = [
  "[&_tbody_tr]:relative [&_tbody_tr]:cursor-pointer [&_tbody_tr:has(a:focus-visible)]:outline-2 [&_tbody_tr:has(a:focus-visible)]:-outline-offset-2 [&_tbody_tr:has(a:focus-visible)]:outline-ring",
  "max-md:[&_thead]:sr-only max-md:[&_tr]:grid max-md:[&_tr]:h-auto max-md:[&_tr]:grid-cols-1 max-md:[&_tr]:gap-y-1 max-md:[&_tr]:px-4 max-md:[&_tr]:py-3",
  "max-md:[&_td]:whitespace-normal max-md:[&_td]:p-0 max-md:[&_td]:text-left max-md:[&_th]:whitespace-normal max-md:[&_th]:p-0",
  "max-md:[&_td:has([data-vacio])]:hidden",
].join(" ");

export function TablaClientes({ lista, parametros, orden, puedeGestionar, conCotizaciones, columnasVisibles }: {
  lista: ListaClientes; parametros: Record<string, string>; orden: Orden<CampoOrdenCliente> | null;
  puedeGestionar: boolean; conCotizaciones: boolean; columnasVisibles: readonly ColumnaOpcional[];
}) {
  const filtrado = Object.keys(parametros).some((clave) => clave === "q" || clave === "tipo" || clave === "activo");
  const sinClientes = lista.total === 0 && !filtrado;
  const vacio = lista.total > 0
    ? <EmptyState ilustracion="reconocimientos" titulo="Esa página no existe"
      descripcion={`La búsqueda tiene ${lista.total} resultados en menos páginas.`}
      accion={<Button asChild variant="outline"><Link href={hrefPagina(parametros, 1)}>Ir a la primera página</Link></Button>} />
    : sinClientes
      ? <EmptyState ilustracion="reconocimientos" titulo="Aún no hay clientes"
        descripcion="Registre el primer cliente para empezar a cotizar."
        accion={puedeGestionar ? <NuevoCliente conEnlace={false} /> : undefined} />
      : <EmptyState ilustracion="reconocimientos" titulo="Sin resultados"
        descripcion="Ningún cliente coincide con la búsqueda. Pruebe con otros términos o quite los filtros."
        accion={<Button asChild variant="outline"><Link href="/clientes">Limpiar filtros</Link></Button>} />;
  return <ZonaResultados>
    <DataTable titulo="Listado de clientes" columnas={columnasDe(columnasVisibles, conCotizaciones)} filas={lista.datos}
      idFila={(cliente) => cliente.id} className={CLASES_TABLA} orden={orden} claveConsulta={new URLSearchParams(parametros).toString()}
      vacio={vacio} paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
        hrefPagina: (pagina) => hrefPagina(parametros, pagina) }} />
  </ZonaResultados>;
}
