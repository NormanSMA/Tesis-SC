import { closeSync, openSync, writeSync } from "node:fs";
import type { Actor } from "../../src/core/autorizacion";
import { PERFILES, perfilPrincipal } from "../../src/core/permisos";
import { prisma } from "../../src/lib/db";
import { crearUsuario, desactivarUsuario } from "../../src/modules/admin/service";
import ficticios from "../../prisma/seed/datos/usuarios.json";
import { personas } from "./personas";
import { reasignarActivos } from "./asignaciones";

const correoTecnico = "pruebas.admin@solucionescreativas.test";
const ruta = process.env.USUARIOS_REALES_SALIDA ?? "/salida/credenciales.local.md";

async function cargarActor(correo?: string): Promise<Actor> {
  const usuario = await prisma.usuario.findFirstOrThrow({
    where: { activo: true, ...(correo ? { correo } : {}),
      perfiles: { some: { perfil: { codigo: "ADMIN" } } } },
    include: { perfiles: { include: { perfil: { include: { permisos: { include: { permiso: true } } } } } } },
  });
  const perfiles = usuario.perfiles.map(p => p.perfil.codigo);
  const permisos = [...new Set(usuario.perfiles.flatMap(p =>
    p.perfil.permisos.map(x => `${x.permiso.recurso}:${x.permiso.accion}`)))];
  if (!permisos.includes("usuario:gestionar")) throw new Error("Falta un administrador con gestión de usuarios.");
  return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo,
    perfil: perfilPrincipal(perfiles), perfiles, permisos };
}

async function validarExistentes() {
  const esperados = [...personas, { nombre: "Administrador de pruebas", correo: correoTecnico,
    perfiles: PERFILES.map(p => p.codigo) }];
  for (const persona of esperados) {
    const usuario = await prisma.usuario.findUnique({ where: { correo: persona.correo },
      include: { perfiles: { include: { perfil: true } } } });
    if (!usuario) continue;
    const perfiles = "perfil" in persona ? [persona.perfil] : persona.perfiles;
    if (!usuario.activo || usuario.nombre !== persona.nombre ||
      usuario.perfiles.length !== perfiles.length || usuario.perfiles.some(p => !perfiles.includes(p.perfil.codigo))) {
      throw new Error(`Revise la cuenta existente ${persona.correo}: nombre, estado o perfiles diferentes. No se sobrescribe.`);
    }
  }
}

async function crearCuentas(archivo: number) {
  let actor = await cargarActor();
  const entradas = [{ nombre: "Administrador de pruebas", correo: correoTecnico,
    perfiles: PERFILES.map(p => p.codigo) },
  ...personas.map(p => ({ nombre: p.nombre, correo: p.correo, perfiles: [p.perfil] }))];
  for (const entrada of entradas) {
    const existente = await prisma.usuario.findUnique({ where: { correo: entrada.correo } });
    if (!existente) {
      const creada = await crearUsuario(entrada, actor);
      writeSync(archivo, `| ${entrada.nombre} | ${entrada.correo} | ${creada.claveTemporal} |\n`);
      console.log(`Creada: ${entrada.nombre}`);
    } else {
      console.log(`Conservada: ${entrada.nombre}`);
    }
    if (entrada.correo === correoTecnico) actor = await cargarActor(correoTecnico);
  }
  return actor;
}

async function retirarFicticios(actor: Actor) {
  const antiguos = await prisma.usuario.findMany({ where: {
    correo: { in: ficticios.map(u => u.correo) }, activo: true } });
  for (const usuario of antiguos) {
    await desactivarUsuario(usuario.id, { version: usuario.actualizadoEn.toISOString() }, actor);
    console.log(`Desactivada: ${usuario.nombre}`);
  }
}

async function main() {
  await validarExistentes();
  // Abrir antes de crear cuentas evita altas sin un destino disponible para las claves.
  const archivo = openSync(ruta, "a", 0o600);
  try {
    writeSync(archivo, `\n## Ejecución ${new Date().toISOString()}\n\n` +
      "Claves temporales: vencen en 48 horas y deben cambiarse al entrar. Solo cuentas nuevas.\n\n" +
      "| Nombre | Correo de acceso | Contraseña temporal |\n|---|---|---|\n");
    const actor = await crearCuentas(archivo);
    await reasignarActivos(actor);
    await retirarFicticios(actor);
    console.log("Usuarios reales preparados. Credenciales guardadas únicamente en el archivo local.");
  } finally {
    closeSync(archivo);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "No se pudieron preparar los usuarios.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
