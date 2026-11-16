import { exigir, type Actor } from "@/core/autorizacion";
import { prisma } from "@/lib/db";
import { registrarEvento } from "@/lib/bitacora";
import { AppError } from "@/lib/errores";
import { versionPermisos } from "./permisos-dto";
import type { EntradaReemplazarPermisos } from "./permisos-schema";

export async function listarAccesosIndividuales(actor: Actor) {
  exigir(actor, "permiso:gestionar");
  const usuarios = await prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" },
    include: { perfiles: { include: { perfil: { include: { permisos: { include: { permiso: true } } } } } },
      permisosAdicionales: { include: { permiso: true } } } });
  return usuarios.map(usuario => {
    const heredados = [...new Set(usuario.perfiles.flatMap(({ perfil }) =>
      perfil.permisos.map(({ permiso }) => `${permiso.recurso}:${permiso.accion}`)))].sort();
    const adicionales = usuario.permisosAdicionales.map(({ permiso }) => `${permiso.recurso}:${permiso.accion}`).sort();
    return { id: usuario.id, nombre: usuario.nombre, perfiles: usuario.perfiles.map(({ perfil }) => perfil.nombre),
      heredados, adicionales, version: versionPermisos(adicionales) };
  });
}

export async function guardarAccesosIndividuales(id: string, entrada: EntradaReemplazarPermisos, actor: Actor) {
  exigir(actor, "permiso:gestionar");
  return prisma.$transaction(async tx => {
    const usuarios = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM usuario WHERE id = ${id}::uuid AND activo FOR UPDATE`;
    if (!usuarios.length) throw new AppError({ status: 404, codigo: "NO_ENCONTRADO", mensaje: "El usuario no existe." });
    const actuales = await tx.usuarioPermiso.findMany({ where: { usuarioId: id }, include: { permiso: true } });
    const codigos = actuales.map(({ permiso }) => `${permiso.recurso}:${permiso.accion}`);
    if (versionPermisos(codigos) !== entrada.version) throw new AppError({
      status: 409, codigo: "CONFLICTO_EDICION", mensaje: "Los permisos cambiaron. Recargue antes de guardar.",
    });
    const catalogo = await tx.permiso.findMany();
    const solicitados = new Set<string>(entrada.permisos);
    const seleccion = catalogo.filter(p => solicitados.has(`${p.recurso}:${p.accion}`));
    if (seleccion.length !== new Set(entrada.permisos).size) throw new AppError({
      status: 422, codigo: "PERMISO_INVALIDO", mensaje: "Hay permisos desconocidos.",
    });
    await tx.usuarioPermiso.deleteMany({ where: { usuarioId: id, permisoId: { notIn: seleccion.map(p => p.id) } } });
    await tx.usuarioPermiso.createMany({ data: seleccion.map(p => ({ usuarioId: id, permisoId: p.id, otorgadoPorId: actor.id })), skipDuplicates: true });
    for (const permiso of catalogo) {
      const codigo = `${permiso.recurso}:${permiso.accion}`;
      if (codigos.includes(codigo) === solicitados.has(codigo)) continue;
      await registrarEvento(tx, { entidad: "USUARIO", entidadId: id, actorId: actor.id,
        accion: solicitados.has(codigo) ? "OTORGAR_PERMISO" : "REVOCAR_PERMISO",
        detalle: { recurso: permiso.recurso, accion: permiso.accion, alcance: "individual" } });
    }
    return { adicionales: entrada.permisos, version: versionPermisos(entrada.permisos) };
  });
}
