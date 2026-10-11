import type { Actor } from "@/core/autorizacion";
import { destinoPorPerfil, perfilPrincipal, type PerfilCodigo } from "@/core/permisos";
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

export type DatosUsuario = Pick<UsuarioSesion, "id" | "nombre" | "correo" | "perfil" | "perfiles">;

type PerfilConPermisos = { codigo: PerfilCodigo; permisos: { permiso: { recurso: string; accion: string } }[] };

type UsuarioConPerfiles = {
  id: string;
  nombre: string;
  correo: string;
  perfiles: { perfil: PerfilConPermisos }[];
};

const INCLUIR_PERFILES = {
  perfiles: { include: { perfil: { include: { permisos: { include: { permiso: true } } } } } },
} as const;

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

// Une los perfiles del usuario: el principal sigue el orden de PERFILES y los permisos son la unión.
function resumenAcceso(usuario: UsuarioConPerfiles): { perfil: PerfilCodigo; perfiles: PerfilCodigo[]; permisos: string[] } {
  const perfiles = usuario.perfiles.map(({ perfil }) => perfil.codigo);
  const permisos = new Set(
    usuario.perfiles.flatMap(({ perfil }) => perfil.permisos.map(({ permiso }) => `${permiso.recurso}:${permiso.accion}`)),
  );
  return { perfil: perfilPrincipal(perfiles), perfiles, permisos: [...permisos].sort() };
}

function datosUsuario({ id, nombre, correo }: Pick<DatosUsuario, "id" | "nombre" | "correo">, acceso: { perfil: PerfilCodigo; perfiles: readonly PerfilCodigo[] }): DatosUsuario {
  return { id, nombre, correo, perfil: acceso.perfil, perfiles: [...acceso.perfiles] };
}

export function respuestaSesion(actor: Actor): { usuario: DatosUsuario; permisos: string[] } {
  return { usuario: datosUsuario(actor, actor), permisos: [...actor.permisos] };
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

async function abrirSesion(usuario: UsuarioConPerfiles, ahora: Date): Promise<ResultadoLogin> {
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
  const acceso = resumenAcceso(usuario);
  return {
    usuario: datosUsuario(usuario, acceso),
    permisos: acceso.permisos,
    destino: destinoPorPerfil[acceso.perfil],
    token,
    maxAgeSegundos: Math.floor((expiraEn.getTime() - ahora.getTime()) / 1000),
  };
}

export async function iniciarSesion(entrada: CredencialesLogin, ahora = new Date()): Promise<ResultadoLogin> {
  const correo = entrada.correo.trim().toLowerCase();
  const usuario = await prisma.usuario.findUnique({ where: { correo }, include: INCLUIR_PERFILES });
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
  if (!usuario.activo || usuario.perfiles.length === 0) throw credencialesInvalidas();
  return abrirSesion(usuario, ahora);
}

export async function cerrarSesion(token: string | null, ahora = new Date()): Promise<void> {
  if (!token) return;
  await prisma.sesion.updateMany({
    where: { tokenHash: hashearToken(token), revocadaEn: null },
    data: { revocadaEn: ahora },
  });
}

// Los permisos salen de usuario_perfil y perfil_permiso en cada petición: un cambio rige de inmediato.
export async function resolverSesion(token: string, ahora = new Date()): Promise<UsuarioSesion | null> {
  const sesion = await prisma.sesion.findUnique({
    where: { tokenHash: hashearToken(token) },
    include: { usuario: { include: INCLUIR_PERFILES } },
  });
  if (!sesion || sesion.revocadaEn || sesion.expiraEn <= ahora || !sesion.usuario.activo) return null;
  const { usuario } = sesion;
  if (usuario.perfiles.length === 0) return null;
  return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, ...resumenAcceso(usuario) };
}
