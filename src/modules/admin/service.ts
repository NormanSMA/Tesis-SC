import { randomBytes } from "node:crypto";

import { exigir, type Actor } from "@/core/autorizacion";
import { hashearContrasena } from "@/lib/auth/password";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { aErrorHttp, AppError } from "@/lib/errores";

import { aUsuarioDto, camposUsuario } from "./dto";
import { validarCambioUsuario, validarPerfilesUsuario, validarVersionUsuario } from "./reglas";
import {
  actualizarUsuario, bloquearAdministradores, bloquearUsuario, buscarUsuario, consultarUsuarios,
  insertarUsuario, reemplazarPerfiles, revocarSesiones, type UsuarioPublico,
} from "./repo";
import {
  esquemaIdUsuario, type ConsultaUsuarios, type EntradaCambiarActivoUsuario,
  type EntradaCrearUsuario, type EntradaEditarUsuario,
} from "./schema";
import type { ListaUsuarios, UsuarioConClave, UsuarioDto } from "./tipos";

function noEncontrado(): AppError {
  return new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El usuario no existe.", status: 404 });
}

export function leerIdUsuario(valor: string | string[] | undefined): string {
  const resultado = esquemaIdUsuario.safeParse(valor);
  if (!resultado.success) throw noEncontrado();
  return resultado.data;
}

async function exigirUsuario(tx: Tx, id: string): Promise<UsuarioPublico> {
  const usuario = await buscarUsuario(tx, id);
  if (!usuario) throw noEncontrado();
  return usuario;
}

function traducirDuplicado(error: unknown): unknown {
  if (aErrorHttp(error).cuerpo.error.codigo !== "DUPLICADO") return error;
  const mensaje = "Ya existe un usuario con ese correo.";
  return new AppError({ codigo: "DUPLICADO", mensaje, status: 409, campos: { correo: mensaje } });
}

export async function listarUsuarios(consulta: ConsultaUsuarios, actor: Actor): Promise<ListaUsuarios> {
  exigir(actor, "usuario:gestionar");
  const { filas, total } = await consultarUsuarios(consulta);
  return { datos: filas.map(aUsuarioDto), total, pagina: consulta.pagina, porPagina: consulta.porPagina };
}

export async function obtenerUsuario(id: string, actor: Actor): Promise<UsuarioDto> {
  exigir(actor, "usuario:gestionar");
  return aUsuarioDto(await exigirUsuario(prisma, id));
}

export async function crearUsuario(entrada: EntradaCrearUsuario, actor: Actor): Promise<UsuarioConClave> {
  exigir(actor, "usuario:gestionar");
  validarPerfilesUsuario({ activo: true, perfiles: entrada.perfiles });
  const claveTemporal = randomBytes(12).toString("base64url");
  const hashContrasena = await hashearContrasena(claveTemporal);
  try {
    const usuario = await prisma.$transaction(async (tx) => {
      await bloquearAdministradores(tx);
      const creado = await insertarUsuario(tx, {
        ...entrada, correo: entrada.correo.toLowerCase(), hashContrasena, actorId: actor.id,
        contrasenaTemporalExpiraEn: new Date(Date.now() + 48 * 3_600_000),
      });
      await registrarEvento(tx, {
        entidad: "USUARIO", entidadId: creado.id, accion: "CREAR", actorId: actor.id,
        estadoNuevo: "ACTIVO", detalle: camposUsuario(creado),
      });
      return aUsuarioDto(creado);
    });
    return { usuario, claveTemporal };
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

function validarCambio(datos: {
  actual: UsuarioPublico; nuevo: { activo: boolean; perfiles: UsuarioDto["perfiles"] };
  actor: Actor; administradoresActivos: number;
}): void {
  validarCambioUsuario({
    actorId: datos.actor.id, actual: aUsuarioDto(datos.actual), nuevo: datos.nuevo,
    administradoresActivos: datos.administradoresActivos,
  });
}

export async function editarUsuario(id: string, entrada: EntradaEditarUsuario, actor: Actor): Promise<UsuarioDto> {
  exigir(actor, "usuario:gestionar");
  try {
    return await prisma.$transaction(async (tx) => {
      const administradoresActivos = await bloquearAdministradores(tx);
      await bloquearUsuario(tx, id);
      const actual = await exigirUsuario(tx, id);
      validarVersionUsuario(actual.actualizadoEn, entrada.version);
      const perfiles = entrada.perfiles ?? aUsuarioDto(actual).perfiles;
      validarCambio({ actual, nuevo: { activo: actual.activo, perfiles }, actor, administradoresActivos });
      const cambios = { nombre: entrada.nombre, correo: entrada.correo?.toLowerCase() };
      await actualizarUsuario(tx, { id, actualizadoEn: actual.actualizadoEn, cambios });
      if (entrada.perfiles) await reemplazarPerfiles(tx, id, { perfiles, actorId: actor.id });
      const nuevo = await exigirUsuario(tx, id);
      await registrarEvento(tx, {
        entidad: "USUARIO", entidadId: id, accion: "EDITAR", actorId: actor.id,
        detalle: { antes: camposUsuario(actual), despues: camposUsuario(nuevo) },
      });
      return aUsuarioDto(nuevo);
    });
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

async function cambiarActivo({ id, activo, version, actor }: {
  id: string; activo: boolean; version: string; actor: Actor;
}): Promise<UsuarioDto> {
  exigir(actor, "usuario:gestionar");
  return prisma.$transaction(async (tx) => {
    const administradoresActivos = await bloquearAdministradores(tx);
    await bloquearUsuario(tx, id);
    const actual = await exigirUsuario(tx, id);
    validarVersionUsuario(actual.actualizadoEn, version);
    validarCambio({ actual, nuevo: { activo, perfiles: aUsuarioDto(actual).perfiles }, actor, administradoresActivos });
    if (actual.activo === activo) return aUsuarioDto(actual);
    const nuevo = await actualizarUsuario(tx, { id, actualizadoEn: actual.actualizadoEn, cambios: { activo } });
    if (!activo) await revocarSesiones(tx, id);
    await registrarEvento(tx, {
      entidad: "USUARIO", entidadId: id, accion: "CAMBIAR_ESTADO", actorId: actor.id,
      estadoAnterior: actual.activo ? "ACTIVO" : "INACTIVO", estadoNuevo: activo ? "ACTIVO" : "INACTIVO",
      detalle: { activo: { anterior: actual.activo, nuevo: activo } },
    });
    return aUsuarioDto(nuevo);
  });
}

export function desactivarUsuario(id: string, entrada: EntradaCambiarActivoUsuario, actor: Actor): Promise<UsuarioDto> {
  return cambiarActivo({ id, activo: false, version: entrada.version, actor });
}

export function reactivarUsuario(id: string, entrada: EntradaCambiarActivoUsuario, actor: Actor): Promise<UsuarioDto> {
  return cambiarActivo({ id, activo: true, version: entrada.version, actor });
}

export async function desbloquearUsuario(id: string, actor: Actor): Promise<UsuarioDto> {
  exigir(actor, "usuario:gestionar");
  return prisma.$transaction(async (tx) => {
    await bloquearAdministradores(tx);
    await bloquearUsuario(tx, id);
    const actual = await exigirUsuario(tx, id);
    const nuevo = await actualizarUsuario(tx, {
      id, actualizadoEn: actual.actualizadoEn, cambios: { intentosFallidos: 0, bloqueadoHasta: null },
    });
    await registrarEvento(tx, {
      entidad: "USUARIO", entidadId: id, accion: "EDITAR", actorId: actor.id,
      detalle: {
        operacion: "DESBLOQUEAR", antes: { intentosFallidos: actual.intentosFallidos,
          bloqueadoHasta: actual.bloqueadoHasta?.toISOString() ?? null },
        despues: { intentosFallidos: 0, bloqueadoHasta: null },
      },
    });
    return aUsuarioDto(nuevo);
  });
}

export async function reiniciarClaveUsuario(id: string, actor: Actor): Promise<UsuarioConClave> {
  exigir(actor, "usuario:gestionar");
  const claveTemporal = randomBytes(12).toString("base64url");
  const hashContrasena = await hashearContrasena(claveTemporal);
  const usuario = await prisma.$transaction(async (tx) => {
    await bloquearAdministradores(tx);
    await bloquearUsuario(tx, id);
    const actual = await exigirUsuario(tx, id);
    const nuevo = await actualizarUsuario(tx, {
      id, actualizadoEn: actual.actualizadoEn, cambios: {
        hashContrasena, intentosFallidos: 0, bloqueadoHasta: null,
        contrasenaTemporal: true, contrasenaTemporalExpiraEn: new Date(Date.now() + 48 * 3_600_000),
      },
    });
    await revocarSesiones(tx, id);
    await registrarEvento(tx, {
      entidad: "USUARIO", entidadId: id, accion: "EDITAR", actorId: actor.id,
      detalle: { operacion: "REINICIAR_CLAVE", sesionesRevocadas: true },
    });
    return aUsuarioDto(nuevo);
  });
  return { usuario, claveTemporal };
}
