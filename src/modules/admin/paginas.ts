import { notFound } from "next/navigation";

import type { Actor } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";
import { filtrarUsuarios, type FiltrosUsuarios } from "@/modules/admin/componentes/interfaz";
import { leerIdUsuario, listarUsuarios, obtenerUsuario } from "@/modules/admin/service";
import type { UsuarioDto } from "@/modules/admin/tipos";

export async function cargarUsuario(id: string, actor: Actor) {
  try {
    return { usuario: await obtenerUsuario(leerIdUsuario(id), actor), ahora: Date.now() };
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}

export async function cargarUsuarios(filtros: FiltrosUsuarios, actor: Actor) {
  // El servicio no ofrece filtro por bloqueo ni contadores globales.
  const datos: UsuarioDto[] = [];
  let pagina = 1;
  let total = 0;
  do {
    const lista = await listarUsuarios({ pagina, porPagina: 100, activo: undefined }, actor);
    datos.push(...lista.datos);
    total = lista.total;
    pagina += 1;
    if (lista.datos.length === 0) break;
  } while (datos.length < total);
  const ahora = Date.now();
  const encontrados = filtrarUsuarios(datos, filtros, ahora);
  const porPagina = 20;
  return {
    datos: encontrados.slice((filtros.pagina - 1) * porPagina, filtros.pagina * porPagina),
    total: encontrados.length, pagina: filtros.pagina, porPagina, ahora,
    activos: datos.filter((usuario) => usuario.activo).length,
    bloqueados: datos.filter((usuario) => usuario.activo && usuario.bloqueadoHasta && Date.parse(usuario.bloqueadoHasta) > ahora).length,
  };
}
