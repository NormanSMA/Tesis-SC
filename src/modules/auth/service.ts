import type { Actor } from "@/core/autorizacion";
import { destinoPorPerfil, type PerfilCodigo } from "@/core/permisos";
import { ttlSesionHoras } from "@/lib/auth/cookies";
import { verificarContraFicticio, verificarContrasena } from "@/lib/auth/password";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { generarToken, hashearToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { formatearFechaHora } from "@/lib/formato";

import type { CredencialesLogin } from "./schema";

export const INTENTOS_MAXIMOS = 5;
export const BLOQUEO_MINUTOS = 15;

const MS_POR_MINUTO = 60_000;
const MS_POR_HORA = 3_600_000;

export type ResultadoLogin = {
  usuario: DatosUsuario;
  permisos: string[];
  destino: string;
  token: string;
  maxAgeSegundos: number;
};

export type DatosUsuario = Pick<UsuarioSesion, "id" | "nombre" | "correo" | "perfil">;

type UsuarioConPerfil = {
  id: string;
  nombre: string;
  correo: string;
  perfilId: string;
  perfil: { codigo: PerfilCodigo };
};

// El mismo mensaje para usuario inexistente, inactivo o clave errónea: evita enumerar cuentas.
function credencialesInvalidas(): AppError {
  return new AppError({
    codigo: "CREDENCIALES_INVALIDAS",
    mensaje: "Correo o contraseña incorrectos",
    status: 401,
  });
}

function cuentaBloqueada(hasta: Date): AppError {
  const cuando = formatearFechaHora(hasta.toISOString());
  return new AppError({
    codigo: "CUENTA_BLOQUEADA",
    mensaje: `La cuenta está bloqueada por intentos fallidos. Intente de nuevo después del ${cuando} (hora de Managua).`,
    status: 423,
  });
}

function datosUsuario({ id, nombre, correo }: Omit<DatosUsuario, "perfil">, perfil: PerfilCodigo): DatosUsuario {
  return { id, nombre, correo, perfil };
}

export function respuestaSesion(actor: Actor): { usuario: DatosUsuario; permisos: string[] } {
  return { usuario: datosUsuario(actor, actor.perfil), permisos: [...actor.permisos] };
}

// Un solo UPDATE condicionado: dos fallos simultáneos no pueden saltarse el conteo ni el bloqueo.
async function registrarFallo(usuarioId: string, ahora: Date): Promise<Date | null> {
  const hasta = new Date(ahora.getTime() + BLOQUEO_MINUTOS * MS_POR_MINUTO);
  const filas = await prisma.$queryRaw<{ bloqueada: boolean; bloqueado_hasta: Date | null }[]>`
    UPDATE usuario SET
      intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= ${INTENTOS_MAXIMOS}::int THEN 0 ELSE intentos_fallidos + 1 END,
      bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= ${INTENTOS_MAXIMOS}::int THEN ${hasta}::timestamptz ELSE bloqueado_hasta END,
      actualizado_en = ${ahora}::timestamptz
    WHERE id = ${usuarioId}::uuid AND (bloqueado_hasta IS NULL OR bloqueado_hasta <= ${ahora}::timestamptz)
    RETURNING (bloqueado_hasta > ${ahora}::timestamptz) AS bloqueada, bloqueado_hasta`;
  if (filas.length > 0) return filas[0].bloqueada && filas[0].bloqueado_hasta ? new Date(filas[0].bloqueado_hasta) : null;
  // Sin filas: otro intento fallido bloqueó la cuenta entre la lectura y este UPDATE.
  const actual = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { bloqueadoHasta: true } });
  return actual?.bloqueadoHasta && actual.bloqueadoHasta > ahora ? actual.bloqueadoHasta : null;
}

async function permisosDelPerfil(perfilId: string): Promise<string[]> {
  const filas = await prisma.perfilPermiso.findMany({
    where: { perfilId },
    select: { permiso: { select: { recurso: true, accion: true } } },
  });
  return filas.map(({ permiso }) => `${permiso.recurso}:${permiso.accion}`).sort();
}

async function abrirSesion(usuario: UsuarioConPerfil, ahora: Date): Promise<ResultadoLogin> {
  const token = generarToken();
  const expiraEn = new Date(ahora.getTime() + ttlSesionHoras() * MS_POR_HORA);
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: ahora },
    }),
    prisma.sesion.create({ data: { tokenHash: hashearToken(token), usuarioId: usuario.id, expiraEn } }),
    // Las sesiones vencidas no tienen historial de negocio: se purgan al abrir una nueva.
    prisma.sesion.deleteMany({ where: { usuarioId: usuario.id, expiraEn: { lt: ahora } } }),
  ]);
  return {
    usuario: datosUsuario(usuario, usuario.perfil.codigo),
    permisos: await permisosDelPerfil(usuario.perfilId),
    destino: destinoPorPerfil[usuario.perfil.codigo],
    token,
    maxAgeSegundos: Math.floor((expiraEn.getTime() - ahora.getTime()) / 1000),
  };
}

export async function iniciarSesion(entrada: CredencialesLogin, ahora = new Date()): Promise<ResultadoLogin> {
  const correo = entrada.correo.trim().toLowerCase();
  const usuario = await prisma.usuario.findUnique({ where: { correo }, include: { perfil: true } });
  if (!usuario) {
    await verificarContraFicticio(entrada.contrasena);
    throw credencialesInvalidas();
  }
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) throw cuentaBloqueada(usuario.bloqueadoHasta);

  const correcta = await verificarContrasena(usuario.hashContrasena, entrada.contrasena);
  if (!correcta) {
    const bloqueadaHasta = usuario.activo ? await registrarFallo(usuario.id, ahora) : null;
    throw bloqueadaHasta ? cuentaBloqueada(bloqueadaHasta) : credencialesInvalidas();
  }
  if (!usuario.activo) throw credencialesInvalidas();
  return abrirSesion(usuario, ahora);
}

export async function cerrarSesion(token: string | null, ahora = new Date()): Promise<void> {
  if (!token) return;
  await prisma.sesion.updateMany({
    where: { tokenHash: hashearToken(token), revocadaEn: null },
    data: { revocadaEn: ahora },
  });
}

// Los permisos salen de perfil_permiso en cada petición: un cambio de la matriz rige de inmediato.
export async function resolverSesion(token: string, ahora = new Date()): Promise<UsuarioSesion | null> {
  const sesion = await prisma.sesion.findUnique({
    where: { tokenHash: hashearToken(token) },
    include: { usuario: { include: { perfil: { include: { permisos: { include: { permiso: true } } } } } } },
  });
  if (!sesion || sesion.revocadaEn || sesion.expiraEn <= ahora || !sesion.usuario.activo) return null;
  const { usuario } = sesion;
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    perfil: usuario.perfil.codigo,
    permisos: usuario.perfil.permisos.map(({ permiso }) => `${permiso.recurso}:${permiso.accion}`).sort(),
  };
}
