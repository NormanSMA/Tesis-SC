import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETIQUETA_PERFIL, PERFILES } from "@/core/permisos";
import type { cargarUsuarios } from "@/modules/admin/paginas";
import { SelectNativo } from "@/modules/clientes/componentes/SelectNativo";

import { estadoUsuario, hrefUsuarios, type FiltrosUsuarios } from "./interfaz";

export function FiltrosListaUsuarios({ filtros }: { filtros: FiltrosUsuarios }) {
  return (
    <form method="get" action="/admin/usuarios" role="search" aria-label="Buscar usuarios" className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 basis-56 flex-1 space-y-2">
        <Label htmlFor="usuarios-q">Buscar</Label>
        <Input id="usuarios-q" name="q" type="search" className="min-h-10" defaultValue={filtros.q} placeholder="Nombre o correo" maxLength={200} />
      </div>
      <div className="min-w-0 basis-56 space-y-2">
        <Label htmlFor="usuarios-perfil">Perfil</Label>
        <SelectNativo id="usuarios-perfil" name="perfil" defaultValue={filtros.perfil}>
          <option value="">Todos los perfiles</option>
          {PERFILES.map(({ codigo, nombre }) => <option key={codigo} value={codigo}>{nombre}</option>)}
        </SelectNativo>
      </div>
      <div className="min-w-0 basis-40 space-y-2">
        <Label htmlFor="usuarios-estado">Estado</Label>
        <SelectNativo id="usuarios-estado" name="estado" defaultValue={filtros.estado}>
          <option value="">Todos los estados</option><option value="ACTIVO">Activo</option>
          <option value="BLOQUEADO">Bloqueado</option><option value="INACTIVO">Inactivo</option>
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
      <div className="max-w-full overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Lista de usuarios">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Usuarios y perfiles asignados</caption>
          <thead className="bg-muted"><tr>{["Nombre", "Correo", "Perfiles", "Estado"].map((texto) => <th key={texto} scope="col" className="p-3 font-medium">{texto}</th>)}</tr></thead>
          <tbody>{lista.datos.map((usuario) => <tr key={usuario.id} className="border-t">
            <th scope="row" className="max-w-64 p-3 font-medium"><Link className="inline-flex min-h-10 items-center break-words text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" href={`/admin/usuarios/${usuario.id}`}>{usuario.nombre}</Link></th>
            <td className="max-w-64 break-all p-3">{usuario.correo}</td>
            <td className="max-w-72 p-3"><div className="flex flex-wrap gap-2">{usuario.perfiles.map((perfil) => <Badge key={perfil} variant="neutro" className="whitespace-normal">{ETIQUETA_PERFIL[perfil]}</Badge>)}</div></td>
            <td className="p-3">{estadoUsuario(usuario, lista.ahora)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <PaginacionUsuarios lista={lista} filtros={filtros} />
    </div>
  );
}

function PaginacionUsuarios({ lista, filtros }: { lista: Lista; filtros: FiltrosUsuarios }) {
  const paginas = Math.max(1, Math.ceil(lista.total / lista.porPagina));
  return (
    <nav aria-label="Páginas de usuarios" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{lista.total} usuarios. Página {lista.pagina} de {paginas}.</p>
      <div className="flex gap-3">
        {lista.pagina > 1 ? <Button asChild variant="outline" className="min-h-10"><Link href={hrefUsuarios(filtros, lista.pagina - 1)}>Anterior</Link></Button> : null}
        {lista.pagina < paginas ? <Button asChild variant="outline" className="min-h-10"><Link href={hrefUsuarios(filtros, lista.pagina + 1)}>Siguiente</Link></Button> : null}
      </div>
    </nav>
  );
}
