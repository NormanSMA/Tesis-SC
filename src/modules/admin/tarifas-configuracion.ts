import { can, type Actor } from "@/core/autorizacion";

export function puedeGestionarTarifas(actor: Actor) {
  return can(actor, "tarifa:gestionar");
}

export function esTarifa(clave: string) {
  return clave.startsWith("tarifa_") || clave.startsWith("material:");
}
