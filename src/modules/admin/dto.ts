import { PERFILES } from "@/core/permisos";

import type { UsuarioPublico } from "./repo";
import type { UsuarioDto } from "./tipos";

export function aUsuarioDto(usuario: UsuarioPublico): UsuarioDto {
  const codigos = usuario.perfiles.map(({ perfil }) => perfil.codigo);
  return {
    id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, activo: usuario.activo,
    perfiles: PERFILES.filter(({ codigo }) => codigos.includes(codigo)).map(({ codigo }) => codigo),
    intentosFallidos: usuario.intentosFallidos,
    bloqueadoHasta: usuario.bloqueadoHasta?.toISOString() ?? null,
    ultimoAcceso: usuario.ultimoAcceso?.toISOString() ?? null,
    creadoEn: usuario.creadoEn.toISOString(), actualizadoEn: usuario.actualizadoEn.toISOString(),
  };
}

export function camposUsuario(usuario: UsuarioPublico) {
  const { nombre, correo, perfiles } = aUsuarioDto(usuario);
  return { nombre, correo, perfiles };
}
