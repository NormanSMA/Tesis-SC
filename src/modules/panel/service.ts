import { can, exigir, type Actor } from "@/core/autorizacion";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { obtenerTablero } from "@/modules/produccion/consulta";
import type { GrupoEtapas } from "@/modules/produccion/tipos";
import { consultarMaterialesPanel, consultarOperacion, consultarPendientes } from "./repo";

function resumirGrupos(grupos: GrupoEtapas[], campo: "area" | "responsable", hoy: string) {
  const atrasada = (etapa: GrupoEtapas["etapas"][number]) => Boolean(etapa.fechaFinPlan && etapa.fechaFinPlan < hoy);
  return grupos.map((grupo) => ({ nombre: grupo.nombre, cantidad: grupo.etapas.length,
    atrasadas: grupo.etapas.filter(atrasada).length,
    href: grupo.id ? `/produccion?${campo}=${grupo.id}` : "/produccion",
    etapas: grupo.etapas.map((etapa) => ({ nombre: etapa.nombre, numero: etapa.orden.numero,
      atrasada: atrasada(etapa), href: `/ordenes/${etapa.orden.id}` })) }));
}
export async function obtenerPanel(actor: Actor, instante = new Date()) {
  exigir(actor, "panel:ver");
  const hoy = hoyManagua(instante);
  const verCarga = can(actor, "orden:ver") && can(actor, "produccion:ver");
  const [cotizaciones, materiales, operacion, tablero] = await Promise.all([
    can(actor, "cotizacion:ver") ? consultarPendientes(hoy) : undefined,
    can(actor, "inventario:ver") ? consultarMaterialesPanel() : undefined,
    verCarga ? consultarOperacion(hoy) : undefined,
    verCarga ? obtenerTablero({}, actor) : undefined,
  ]);
  return { generadoEn: instante.toISOString(), hoy,
    ...(cotizaciones && { cotizaciones }), ...(materiales && { materiales }),
    ...(operacion && tablero && { carga: { porEstado: operacion.porEstado, entregas: operacion.entregas,
      porResponsable: resumirGrupos(tablero.porResponsable, "responsable", hoy), porArea: resumirGrupos(tablero.porArea, "area", hoy) },
      resumen: operacion.resumen }) };
}
export type PanelDto = Awaited<ReturnType<typeof obtenerPanel>>;
