import type { Metadata } from "next";

import Link from "next/link";

import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { leerFiltrosUsuarios } from "@/modules/admin/componentes/interfaz";
import { FiltrosListaUsuarios, TablaUsuarios } from "@/modules/admin/componentes/ListaUsuarios";
import { cargarUsuarios } from "@/modules/admin/paginas";

export const metadata: Metadata = { title: "Usuarios" };

export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPermisoPagina("usuario:gestionar");
  const filtros = leerFiltrosUsuarios(await searchParams);
  const lista = await cargarUsuarios(filtros, actor);
  return (
    <div className="w-full min-w-0 max-w-full">
      <PageHeader titulo={`${lista.activos} usuarios activos, ${lista.bloqueados} bloqueados`} tituloVisible={false}
        descripcion="Gestione cuentas de acceso y perfiles. Abra la ficha para realizar acciones."
        acciones={<Button className="min-h-10" asChild><Link href="/admin/usuarios/nuevo">Nuevo usuario</Link></Button>} />
      <ProveedorLista>
        <FiltrosListaUsuarios filtros={filtros} activos={lista.activos} bloqueados={lista.bloqueados} />
        <TablaUsuarios lista={lista} filtros={filtros} />
      </ProveedorLista>
    </div>
  );
}
