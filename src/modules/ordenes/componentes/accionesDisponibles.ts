import { puedeMarcarseLista } from "@/modules/produccion/reglas";
import { EDITABLES } from "../reglas";
import type { OrdenDto } from "../tipos";

export type PermisosOrden = { gestionar: boolean; entregar: boolean; cerrar: boolean; cancelar: boolean };
export type PermisosProduccionOrden = { planificar: boolean; ejecutar: boolean; avanzar: boolean };
type OrdenAcciones = { estado: OrdenDto["estado"]; etapas: readonly Pick<OrdenDto["etapas"][number], "estado">[] };

function avisoLista(visible: boolean, habilitada: boolean) {
  if (!visible) return null;
  if (!habilitada) return { clase: "text-sm text-muted-foreground",
    texto: "Cierre todas las etapas y complete al menos una para marcar la orden lista." };
  return { clase: "text-sm", texto: "Todas las etapas están cerradas. Puede marcar la orden lista." };
}

export function accionesDisponibles({ orden, permisos, permisosEtapas }: {
  orden: OrdenAcciones; permisos: PermisosOrden; permisosEtapas: PermisosProduccionOrden;
}) {
  const puedeProducir = permisosEtapas.planificar || permisosEtapas.ejecutar || permisosEtapas.avanzar;
  const lista = permisosEtapas.avanzar && orden.estado === "EN_PRODUCCION";
  const listaHabilitada = puedeMarcarseLista(orden.estado, orden.etapas.map((etapa) => etapa.estado), permisosEtapas.avanzar);
  const editable = EDITABLES.includes(orden.estado);
  return {
    iniciarProduccion: puedeProducir && orden.estado === "PENDIENTE",
    lista, listaHabilitada, avisoLista: avisoLista(lista, listaHabilitada),
    entregar: permisos.entregar && orden.estado === "LISTA",
    cerrar: permisos.cerrar && orden.estado === "ENTREGADA",
    editar: permisos.gestionar && editable,
    cancelar: permisos.cancelar && editable,
  };
}
