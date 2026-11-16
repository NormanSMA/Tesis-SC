import type { Actor } from "../../src/core/autorizacion";
import { prisma } from "../../src/lib/db";
import { editarEtapa } from "../../src/modules/produccion/etapas";
import { editarOrden } from "../../src/modules/ordenes/service";
import { nombreOficialArea } from "../../src/modules/ordenes/areas-conversion";
import ficticios from "../../prisma/seed/datos/usuarios.json";
import { personas } from "./personas";
const turnos = new Map<string, number>();
function siguienteOperario(area: string) {
  const nombre = nombreOficialArea(area);
  const especialidad = nombre === "Acabado" ? "Acabado y Montaje" : nombre;
  const candidatos = personas.filter(c => c.perfil === 'PRODUCCION' && c.area === especialidad);
  if (!candidatos.length) throw new Error(`Área sin correspondencia: ${area}`);
  const turno = turnos.get(nombre) ?? 0;
  turnos.set(nombre, turno + 1);
  return candidatos[turno % candidatos.length];
}

export async function reasignarActivos(actor: Actor) {
  const viejos = await prisma.usuario.findMany({ where: { correo: { in: ficticios.map(u => u.correo) } }, select: { id: true } });
  const ids = viejos.map(u => u.id);
  const etapas = await prisma.etapaOrden.findMany({
    where: { responsableId: { in: ids }, estado: { in: ['PENDIENTE', 'EN_CURSO', 'OMITIDA'] },
      orden: { estado: { in: ['PENDIENTE', 'EN_PRODUCCION'] } } },
    include: { area: true }, orderBy: [{ ordenId: 'asc' }, { secuencia: 'asc' }],
  });
  for (const e of etapas) {
    const nuevo = siguienteOperario(e.area.nombre);
    await editarEtapa(e.id, { version: e.actualizadoEn.toISOString(), responsableId: (await prisma.usuario.findUniqueOrThrow({ where: { correo: nuevo.correo } })).id }, actor);
  }
  const ordenes = await prisma.ordenTrabajo.findMany({ where: { responsableId: { in: ids },
    estado: { in: ['PENDIENTE', 'EN_PRODUCCION', 'LISTA'] } },
    include: { etapas: { include: { area: true }, orderBy: { secuencia: 'asc' } } } });
  for (const o of ordenes) {
    const etapa = o.etapas.find(e => ['PENDIENTE', 'EN_CURSO'].includes(e.estado)) ?? o.etapas[0];
    if (!etapa) throw new Error('Orden sin etapas para asignar responsable.');
    const nuevo = siguienteOperario(etapa.area.nombre);
    await editarOrden(o.id, { version: o.actualizadoEn.toISOString(), responsableId: (await prisma.usuario.findUniqueOrThrow({ where: { correo: nuevo.correo } })).id }, actor);
  }
}
