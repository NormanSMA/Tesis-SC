import { CircleCheck, CircleMinus, Lock, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ETIQUETA_PERFIL, PERFILES } from "@/core/permisos";
import type { cargarUsuarios } from "@/modules/admin/paginas";
import type { UsuarioDto } from "@/modules/admin/tipos";
import { SelectNativo } from "@/modules/clientes/componentes/SelectNativo";

import { estadoUsuario, hrefUsuarios, type EstadoUsuario, type FiltrosUsuarios } from "./interfaz";

export function FiltrosListaUsuarios({ filtros }: { filtros: FiltrosUsuarios }) {
  return (
    <form method="get" action="/admin/usuarios" role="search" aria-label="Buscar usuarios" className="mb-5 flex flex-wrap items-end gap-3">
      <div className="w-full min-w-0 flex-1 space-y-2 sm:basis-56">
        <Label htmlFor="usuarios-q">Buscar</Label>
        <Input id="usuarios-q" name="q" type="search" className="min-h-10" defaultValue={filtros.q} placeholder="Nombre o correo" maxLength={200} />
      </div>
      <div className="w-full min-w-0 space-y-2 sm:w-auto sm:basis-56">
        <Label htmlFor="usuarios-perfil">Perfil</Label>
        <SelectNativo id="usuarios-perfil" name="perfil" defaultValue={filtros.perfil}>
          <option value="">Todos los perfiles</option>
          {PERFILES.map(({ codigo, nombre }) => <option key={codigo} value={codigo}>{nombre}</option>)}
        </SelectNativo>
      </div>
      <div className="w-full min-w-0 space-y-2 sm:w-auto sm:basis-40">
        <Label htmlFor="usuarios-estado">Estado</Label>
        <SelectNativo id="usuarios-estado" name="estado" defaultValue={filtros.estado}>
          <option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option>
          <option value="TODOS">Todos</option>
        </SelectNativo>
      </div>
      <Button type="submit" className="min-h-10">Buscar</Button>
      <Button asChild variant="outline" className="min-h-10"><Link href="/admin/usuarios">Limpiar filtros</Link></Button>
    </form>
  );
}

type Lista = Awaited<ReturnType<typeof cargarUsuarios>>;
export function TablaUsuarios({ lista, filtros }: { lista: Lista; filtros: FiltrosUsuarios }) {
  if (!lista.datos.length) return (
    <div className="space-y-3 rounded-lg border p-5">
      <p>{lista.total ? "Esa página no existe." : "Ningún usuario coincide con los filtros."}</p>
      <Button asChild variant="outline" className="min-h-10"><Link href={hrefUsuarios(filtros, 1)}>Volver a la primera página</Link></Button>
    </div>
  );
  return (
    <div className="min-w-0 space-y-4">
      <div role="region" aria-label="Lista de usuarios" className="min-w-0">
        <div className="overflow-hidden rounded-lg border bg-card max-md:hidden">
          <Table>
            <caption className="sr-only">Usuarios y perfiles asignados</caption>
            <TableHeader><TableRow>{["Nombre", "Correo", "Perfiles", "Estado"].map((texto) => <TableHead key={texto} scope="col">{texto}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{lista.datos.map((usuario) => <TableRow key={usuario.id} className="h-auto">
              <TableCell className="max-w-64 font-medium whitespace-normal"><EnlaceUsuario usuario={usuario} /></TableCell>
              <TableCell className="max-w-64 break-all whitespace-normal">{usuario.correo}</TableCell>
              <TableCell className="max-w-72 whitespace-normal"><PerfilesUsuario perfiles={usuario.perfiles} /></TableCell>
              <TableCell><EstadoUsuarioBadge estado={estadoUsuario(usuario, lista.ahora)} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        <ul className="space-y-3 md:hidden">{lista.datos.map((usuario) => <li key={usuario.id} className="space-y-2 rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-medium"><EnlaceUsuario usuario={usuario} /></p>
            <EstadoUsuarioBadge estado={estadoUsuario(usuario, lista.ahora)} />
          </div>
          <p className="break-all text-sm text-muted-foreground">{usuario.correo}</p>
          <PerfilesUsuario perfiles={usuario.perfiles} />
        </li>)}</ul>
      </div>
      <PaginacionUsuarios lista={lista} filtros={filtros} />
    </div>
  );
}

const ESTADOS_USUARIO: Record<EstadoUsuario, { etiqueta: string; tono: "exito" | "advertencia" | "neutro"; icono: LucideIcon }> = {
  ACTIVO: { etiqueta: "Activo", tono: "exito", icono: CircleCheck },
  BLOQUEADO: { etiqueta: "Bloqueado", tono: "advertencia", icono: Lock },
  INACTIVO: { etiqueta: "Inactivo", tono: "neutro", icono: CircleMinus },
};

function EstadoUsuarioBadge({ estado }: { estado: EstadoUsuario }) {
  const { etiqueta, tono, icono: Icono } = ESTADOS_USUARIO[estado];
  return <Badge variant={tono}><Icono aria-hidden="true" />{etiqueta}</Badge>;
}

function EnlaceUsuario({ usuario }: { usuario: UsuarioDto }) {
  return <Link className="inline-flex min-h-10 items-center break-words text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" href={`/admin/usuarios/${usuario.id}`}>{usuario.nombre}</Link>;
}

function PerfilesUsuario({ perfiles }: { perfiles: UsuarioDto["perfiles"] }) {
  return <div className="flex flex-wrap gap-2">{perfiles.map((perfil) => <Badge key={perfil} variant="neutro" className="whitespace-normal">{ETIQUETA_PERFIL[perfil]}</Badge>)}</div>;
}

function PaginacionUsuarios({ lista, filtros }: { lista: Lista; filtros: FiltrosUsuarios }) {
  const paginas = Math.max(1, Math.ceil(lista.total / lista.porPagina));
  const desde = lista.total === 0 ? 0 : (lista.pagina - 1) * lista.porPagina + 1;
  const hasta = Math.min(lista.pagina * lista.porPagina, lista.total);
  return (
    <nav aria-label="Páginas de usuarios" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Mostrando {desde} a {hasta} de {lista.total}</p>
      <div className="flex gap-3">
        {lista.pagina > 1 ? <Button asChild variant="outline" className="min-h-10"><Link href={hrefUsuarios(filtros, lista.pagina - 1)}>Anterior</Link></Button> : null}
        {lista.pagina < paginas ? <Button asChild variant="outline" className="min-h-10"><Link href={hrefUsuarios(filtros, lista.pagina + 1)}>Siguiente</Link></Button> : null}
      </div>
    </nav>
  );
}
