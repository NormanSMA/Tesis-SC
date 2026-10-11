import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/comunes/EmptyState";
import { Paginacion } from "@/components/comunes/Paginacion";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { ETIQUETA_TIPO, type ConsultaClientes } from "../schema";
import type { ClienteFila, ListaClientes } from "../tipos";
import { EstadoCliente } from "./EstadoCliente";
import { hayFiltrosActivos } from "./FiltrosClientes";

const TAMANO_POR_DEFECTO = 20;

function hrefPagina(consulta: ConsultaClientes, pagina: number): string {
  const parametros = new URLSearchParams();
  if (consulta.q) parametros.set("q", consulta.q);
  if (consulta.tipo) parametros.set("tipo", consulta.tipo);
  if (!consulta.activo) parametros.set("activo", "false");
  if (consulta.porPagina !== TAMANO_POR_DEFECTO) parametros.set("porPagina", String(consulta.porPagina));
  if (pagina > 1) parametros.set("pagina", String(pagina));
  const texto = parametros.toString();
  return texto ? `/clientes?${texto}` : "/clientes";
}

type ColumnaLista = {
  id: string;
  encabezado: string;
  derecha?: boolean;
  /** Clases de la celda en móvil, donde cada fila se apila como tarjeta. */
  movil?: string;
  conEtiqueta?: boolean;
  celda: (cliente: ClienteFila) => ReactNode;
};

// Máximo 4 columnas: contacto, teléfono y demás datos viven en la ficha. La fila entera enlaza a la ficha.
function columnas(conCotizaciones: boolean): ColumnaLista[] {
  const lista: ColumnaLista[] = [
    {
      id: "nombre",
      encabezado: "Nombre",
      movil: "max-md:col-span-2",
      celda: (cliente) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/clientes/${cliente.id}`}
            className="font-medium text-foreground underline-offset-4 outline-none hover:underline after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
          >
            {cliente.nombre}
          </Link>
          {cliente.activo ? null : <EstadoCliente activo={false} />}
        </div>
      ),
    },
    {
      id: "codigoCliente",
      encabezado: "Código",
      conEtiqueta: true,
      celda: (cliente) => cliente.codigoCliente,
    },
    { id: "tipo", encabezado: "Tipo", conEtiqueta: true, celda: (cliente) => ETIQUETA_TIPO[cliente.tipo] },
  ];
  if (conCotizaciones) {
    lista.push({
      id: "cotizaciones",
      encabezado: "Cotizaciones",
      derecha: true,
      conEtiqueta: true,
      celda: (cliente) => <span className="tabular-nums">{cliente.cotizaciones ?? 0}</span>,
    });
  }
  return lista;
}

type PropiedadesSinResultados = { consulta: ConsultaClientes; puedeGestionar: boolean; totalGeneral: number };

function SinResultados({ consulta, puedeGestionar, totalGeneral }: PropiedadesSinResultados) {
  if (totalGeneral > 0) {
    return (
      <EmptyState
        ilustracion="reconocimientos"
        titulo="Esa página no existe"
        descripcion={`La búsqueda tiene ${totalGeneral} resultados en menos páginas.`}
        accion={
          <Button asChild variant="outline">
            <Link href={hrefPagina(consulta, 1)}>Ir a la primera página</Link>
          </Button>
        }
      />
    );
  }
  if (hayFiltrosActivos(consulta)) {
    return (
      <EmptyState
        ilustracion="reconocimientos"
        titulo="Sin resultados"
        descripcion="Ningún cliente coincide con la búsqueda. Pruebe con otros términos o quite los filtros."
        accion={
          <Button asChild variant="outline">
            <Link href="/clientes">Limpiar filtros</Link>
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      ilustracion="reconocimientos"
      titulo="Aún no hay clientes"
      descripcion="Registre el primer cliente para empezar a cotizar."
      accion={
        puedeGestionar ? (
          <Button asChild>
            <Link href="/clientes/nuevo">
              <Plus aria-hidden="true" />
              Nuevo cliente
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

type PropiedadesTabla = {
  lista: ListaClientes;
  consulta: ConsultaClientes;
  puedeGestionar: boolean;
  conCotizaciones: boolean;
};

function FilaCliente({ cliente, visibles }: { cliente: ClienteFila; visibles: ColumnaLista[] }) {
  return (
    <TableRow className="relative h-12 max-md:grid max-md:h-auto max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-y-1 max-md:px-4 max-md:py-3">
      {visibles.map((columna, indice) => {
        const Celda = indice === 0 ? TableRowHeader : TableCell;
        return (
        <Celda
          key={columna.id}
          data-etiqueta={columna.encabezado}
          className={cn(
            "max-md:p-0 max-md:whitespace-normal max-md:break-words",
            columna.derecha && "text-right",
            columna.conEtiqueta &&
              "max-md:col-span-2 max-md:flex max-md:justify-between max-md:text-sm max-md:text-muted-foreground max-md:before:content-[attr(data-etiqueta)]",
            columna.movil,
          )}
        >
          {columna.celda(cliente)}
        </Celda>
        );
      })}
    </TableRow>
  );
}

export function TablaClientes({ lista, consulta, puedeGestionar, conCotizaciones }: PropiedadesTabla) {
  if (lista.datos.length === 0) {
    return <SinResultados consulta={consulta} puedeGestionar={puedeGestionar} totalGeneral={lista.total} />;
  }
  const visibles = columnas(conCotizaciones);
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table containerProps={{ role: "region", "aria-label": "Listado de clientes", tabIndex: 0 }}>
        <caption className="sr-only">Listado de clientes</caption>
        <TableHeader className="max-md:sr-only">
          <TableRow className="hover:bg-transparent">
            {visibles.map((columna) => (
              <TableHead key={columna.id} scope="col" className={cn(columna.derecha && "text-right")}>
                {columna.encabezado}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.datos.map((cliente) => (
            <FilaCliente key={cliente.id} cliente={cliente} visibles={visibles} />
          ))}
        </TableBody>
      </Table>
      <Paginacion
        pagina={lista.pagina}
        total={lista.total}
        tamano={lista.porPagina}
        hrefPagina={(pagina) => hrefPagina(consulta, pagina)}
      />
    </div>
  );
}
