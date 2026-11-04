import type { Actor } from "../../src/core/autorizacion";
import { prisma } from "../../src/lib/db";
import { editarEtapa } from "../../src/modules/produccion/etapas";
import { editarOrden } from "../../src/modules/ordenes/service";
import ficticios from "../../prisma/seed/datos/usuarios.json";
import { personas } from "./personas";
const equivalencias: Record<string, string> = {
  'Diseño y artes gráficas': 'Diseño Gráfico', 'Impresión': 'Impresión Digital',
  'Corte y láser': 'Grabado y Corte Láser', 'Carpintería y metalmecánica': 'Taller',
  'Acabados': 'Acabado y Montaje', 'Instalación': 'Acabado y Montaje',
  'Electricidad y LED': 'Taller', 'Despacho': 'Acabado y Montaje',
};
const turnos = new Map<string, number>();
function siguienteOperario(area: string) {
  const especialidad = equivalencias[area];
  const candidatos = personas.filter(c => c.perfil === 'PRODUCCION' && c.area === especialidad);
  if (!candidatos.length) throw new Error(`Área sin correspondencia: ${area}`);
  const turno = turnos.get(area) ?? 0;
  turnos.set(area, turno + 1);
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
