import { CircleCheck, CircleMinus, Lock, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { FiltroSegmentado, type OpcionSegmento } from "@/components/comunes/FiltroSegmentado";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETIQUETA_PERFIL, PERFILES } from "@/core/permisos";
import type { cargarUsuarios } from "@/modules/admin/paginas";
import type { UsuarioDto } from "@/modules/admin/tipos";

import { estadoUsuario, FILTRO_ESTADO_PREDETERMINADO, hrefUsuarios, type EstadoUsuario, type FiltrosUsuarios } from "./interfaz";

const OPCIONES_PERFIL: OpcionSegmento[] = [
  { valor: "todos", etiqueta: "Todos" },
  ...PERFILES.map(({ codigo, nombre }) => ({ valor: codigo, etiqueta: nombre })),
];
function opcionesEstado(activos: number, bloqueados: number): OpcionSegmento[] {
  return [
    { valor: "ACTIVO", etiqueta: "Activos", conteo: activos }, { valor: "BLOQUEADO", etiqueta: "Bloqueados", conteo: bloqueados },
    { valor: "INACTIVO", etiqueta: "Inactivos" }, { valor: "TODOS", etiqueta: "Todos" },
  ];
}

/** Barra de la lista: búsqueda en vivo y pastillas de perfil y estado. Todo vive en la URL. */
export function FiltrosListaUsuarios({ filtros, activos, bloqueados }: { filtros: FiltrosUsuarios; activos: number; bloqueados: number }) {
  const hayFiltros = Boolean(filtros.q || filtros.perfil) || filtros.estado !== FILTRO_ESTADO_PREDETERMINADO;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <BuscadorEnVivo etiqueta="Buscar usuarios" marcador="Buscar por nombre o correo" className="basis-full sm:max-w-md lg:basis-auto lg:flex-1" />
      <FiltroSegmentado etiqueta="Estado" parametro="estado" valorTodos={FILTRO_ESTADO_PREDETERMINADO} opciones={opcionesEstado(activos, bloqueados)} />
      <FiltroSegmentado etiqueta="Perfil" parametro="perfil" valorTodos="todos" opciones={OPCIONES_PERFIL} />
      {hayFiltros ? <Button asChild variant="ghost" className="h-10"><Link href="/admin/usuarios">Limpiar filtros</Link></Button> : null}
    </div>
  );
}

type Lista = Awaited<ReturnType<typeof cargarUsuarios>>;

/** Enlace extendido: toda la fila navega a la ficha. El resto de las celdas es solo texto. */
const ENLACE_FILA = "font-medium text-primary underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] hover:underline";
const CLASES_TABLA = "[&_tbody_tr]:relative [&_tbody_tr]:cursor-pointer [&_tbody_tr:has(a:focus-visible)]:outline-2 [&_tbody_tr:has(a:focus-visible)]:-outline-offset-2 [&_tbody_tr:has(a:focus-visible)]:outline-ring [&_td]:whitespace-normal";

function columnasDe(ahora: number): ColumnaTabla<UsuarioDto>[] {
  return [
    { id: "nombre", encabezado: "Nombre", celda: (usuario) => (
      <div className="flex min-w-0 items-center gap-3">
        <AvatarIniciales nombre={usuario.nombre} />
        <Link href={`/admin/usuarios/${usuario.id}`} className={`${ENLACE_FILA} min-w-0 break-words`}>{usuario.nombre}</Link>
      </div>) },
    { id: "correo", encabezado: "Correo", celda: (usuario) => <span className="break-all text-muted-foreground">{usuario.correo}</span> },
    { id: "perfiles", encabezado: "Perfiles", celda: (usuario) => <PerfilesUsuario perfiles={usuario.perfiles} /> },
    { id: "estado", encabezado: "Estado", celda: (usuario) => <EstadoUsuarioBadge estado={estadoUsuario(usuario, ahora)} /> },
  ];
}

export function TablaUsuarios({ lista, filtros }: { lista: Lista; filtros: FiltrosUsuarios }) {
  const vacio = lista.total
    ? <EmptyState ilustracion="reconocimientos" titulo="Esa página no existe"
      descripcion={`La búsqueda tiene ${lista.total} resultados en menos páginas.`}
      accion={<Button asChild variant="outline"><Link href={hrefUsuarios(filtros, 1)}>Volver a la primera página</Link></Button>} />
    : <EmptyState ilustracion="reconocimientos" titulo="Sin resultados"
      descripcion="Ningún usuario coincide con los filtros. Pruebe con otros términos o quite los filtros."
      accion={<Button asChild variant="outline"><Link href="/admin/usuarios">Limpiar filtros</Link></Button>} />;
  return (
    <ZonaResultados>
      <DataTable apilarEnMovil titulo="Lista de usuarios" columnas={columnasDe(lista.ahora)} filas={lista.datos}
        idFila={(usuario) => usuario.id} className={CLASES_TABLA} vacio={vacio}
        claveConsulta={hrefUsuarios(filtros, lista.pagina)}
        paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
          hrefPagina: (pagina) => hrefUsuarios(filtros, pagina) }} />
    </ZonaResultados>
  );
}

const ESTADOS_USUARIO: Record<EstadoUsuario, { etiqueta: string; tono: "exito" | "advertencia" | "neutro"; icono: LucideIcon }> = {
  ACTIVO: { etiqueta: "Activo", tono: "exito", icono: CircleCheck },
  BLOQUEADO: { etiqueta: "Bloqueado", tono: "advertencia", icono: Lock },
  INACTIVO: { etiqueta: "Inactivo", tono: "neutro", icono: CircleMinus },
};

export function EstadoUsuarioBadge({ estado }: { estado: EstadoUsuario }) {
  const { etiqueta, tono, icono: Icono } = ESTADOS_USUARIO[estado];
  return <Badge variant={tono}><Icono aria-hidden="true" />{etiqueta}</Badge>;
}

function PerfilesUsuario({ perfiles }: { perfiles: UsuarioDto["perfiles"] }) {
  return <div className="flex flex-wrap gap-1.5">{perfiles.map((perfil) => <Badge key={perfil} variant="acento" className="whitespace-normal">{ETIQUETA_PERFIL[perfil]}</Badge>)}</div>;
}
