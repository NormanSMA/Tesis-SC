import { can, type Actor } from "@/core/autorizacion";

export function puedeCrearCliente(actor: Actor): boolean {
  return can(actor, "cliente:crear") || can(actor, "cliente:gestionar");
}

export function puedeListarClientes(actor: Actor): boolean {
  return actor.perfiles.includes("GERENCIA") || can(actor, "cliente:gestionar");
}
