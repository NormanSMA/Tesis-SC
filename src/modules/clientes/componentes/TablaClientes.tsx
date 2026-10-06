import Link from "next/link";
import { Plus } from "lucide-react";

import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Button } from "@/components/ui/button";

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

// DataTable no permite ocultar columnas por ancho: a 820 px las claves (nombre, estado, cotizaciones)
// van primero y quedan visibles; las secundarias van a la derecha y se alcanzan desplazando la tabla.
function columnas(conCotizaciones: boolean): ColumnaTabla<ClienteFila>[] {
  const claves: ColumnaTabla<ClienteFila>[] = [
    {
      id: "nombre",
      encabezado: "Nombre",
      principal: true,
      celda: (cliente) => (
        <Link href={`/clientes/${cliente.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
          {cliente.nombre}
        </Link>
      ),
    },
    { id: "estado", encabezado: "Estado", celda: (cliente) => <EstadoCliente activo={cliente.activo} /> },
  ];
  if (conCotizaciones) {
    claves.push({
      id: "cotizaciones",
      encabezado: "Cotizaciones",
      alinear: "derecha",
      celda: (cliente) => <span className="tabular-nums">{cliente.cotizaciones ?? 0}</span>,
    });
  }
  return [
    ...claves,
    { id: "tipo", encabezado: "Tipo", celda: (cliente) => ETIQUETA_TIPO[cliente.tipo] },
    { id: "contacto", encabezado: "Contacto", celda: (cliente) => cliente.contactoPrincipal ?? "—" },
    { id: "telefono", encabezado: "Teléfono", celda: (cliente) => cliente.telefono ?? "—" },
  ];
}

type PropiedadesSinResultados = { consulta: ConsultaClientes; puedeGestionar: boolean; totalGeneral: number };

function SinResultados({ consulta, puedeGestionar, totalGeneral }: PropiedadesSinResultados) {
  if (totalGeneral > 0) {
    return (
      <EmptyState
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

export function TablaClientes({ lista, consulta, puedeGestionar, conCotizaciones }: PropiedadesTabla) {
  return (
    <DataTable
      titulo="Listado de clientes"
      columnas={columnas(conCotizaciones)}
      filas={lista.datos}
      idFila={(cliente) => cliente.id}
      vacio={<SinResultados consulta={consulta} puedeGestionar={puedeGestionar} totalGeneral={lista.total} />}
      paginacion={{
        pagina: lista.pagina,
        total: lista.total,
        tamano: lista.porPagina,
        hrefPagina: (pagina) => hrefPagina(consulta, pagina),
      }}
    />
  );
}
