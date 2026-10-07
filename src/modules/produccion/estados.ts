import { exigir, type Actor } from "@/core/autorizacion";
import { aOrdenDto } from "@/modules/ordenes/dto";
import { exigirOrden, guardarCambios, registrarCambio } from "@/modules/ordenes/escritura";
import { crearEtapaManual } from "./etapas";
import { exigirVersion, regla } from "./errores";
import { transaccionProduccion } from "./escritura";
import { bloquearOrden } from "./repo";
import { exigirLista, validarMotivo } from "./reglas";
import type { EntradaRetrabajo, EntradaVersion } from "./schema";

export async function marcarLista(id: string, entrada: EntradaVersion, actor: Actor) {
  exigir(actor, "orden:avanzar");
  return transaccionProduccion(async (tx) => {
    const orden = await bloquearOrden(tx, id);
    exigirVersion(orden, entrada.version);
    if (orden.estado !== "EN_PRODUCCION") throw regla("TRANSICION_INVALIDA", "Solo una orden en producción puede marcarse lista.");
    const etapas = await tx.etapaOrden.findMany({ where: { ordenId: id }, select: { estado: true } });
    exigirLista(etapas.map((etapa) => etapa.estado));
    await guardarCambios(tx, await exigirOrden(tx, id), { estado: "LISTA" });
    await registrarCambio(tx, { ordenId: id, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: "EN_PRODUCCION", estadoNuevo: "LISTA" });
    return aOrdenDto(await exigirOrden(tx, id), actor);
  });
}
export async function reabrirPorRetrabajo(id: string, entrada: EntradaRetrabajo, actor: Actor) {
  exigir(actor, "orden:avanzar");
  const motivo = validarMotivo(entrada.motivo);
  return transaccionProduccion(async (tx) => {
    const orden = await bloquearOrden(tx, id);
    exigirVersion(orden, entrada.version);
    if (orden.estado !== "LISTA") throw regla("TRANSICION_INVALIDA", "Solo una orden lista admite retrabajo.");
    await crearEtapaManual(tx, { ordenId: id, entrada: { areaId: entrada.areaId, nombre: entrada.nombre }, actor });
    await guardarCambios(tx, await exigirOrden(tx, id), { estado: "EN_PRODUCCION" });
    await registrarCambio(tx, { ordenId: id, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: "LISTA",
      estadoNuevo: "EN_PRODUCCION", detalle: { motivo } });
    return aOrdenDto(await exigirOrden(tx, id), actor);
  });
}
