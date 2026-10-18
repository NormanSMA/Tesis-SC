import { can, type Actor } from "@/core/autorizacion";
import { consultarCotizacionesFeed, consultarEtapasFeed, consultarMaterialesFeed, consultarOrdenesFeed, type FuenteFeed } from "./feed-consultas";
import type { ContenidoPanel, PerfilPanel } from "./tipos";

export async function consultarFeed(entrada: { perfil: PerfilPanel; actor: Actor; hoy: string; instante: Date }): Promise<Pick<ContenidoPanel, "atencion" | "atencionTotal">> {
  const { perfil, actor, hoy, instante } = entrada;
  const parametros = { hoy, instante, actorId: actor.id, verDinero: can(actor, "cotizacion:ver") };
  const fuentes: Promise<FuenteFeed>[] = [];
  if ((perfil === "GERENCIA" || perfil === "ATENCION_CLIENTE") && can(actor, "cotizacion:ver")) {
    for (const urgencia of ["SIN_RESPUESTA", "POR_VENCER", "AJUSTE_SOLICITADO"] as const) {
      fuentes.push(consultarCotizacionesFeed(parametros, urgencia));
    }
  }
  if ((perfil === "GERENCIA" || perfil === "OPERACIONES") && can(actor, "orden:ver")) {
    for (const urgencia of ["ORDEN_ATRASADA", "SIN_RESPONSABLE"] as const) {
      fuentes.push(consultarOrdenesFeed(parametros, urgencia));
    }
  }
  if ((perfil === "GERENCIA" || perfil === "ADMINISTRACION") && can(actor, "inventario:ver")) {
    fuentes.push(consultarMaterialesFeed(parametros));
  }
  if (perfil === "PRODUCCION" && can(actor, "produccion:ver") && can(actor, "orden:ver")) {
    for (const urgencia of ["ETAPA_ATRASADA", "ETAPA_DETENIDA"] as const) {
      fuentes.push(consultarEtapasFeed(parametros, urgencia));
    }
  }
  const resultados = await Promise.all(fuentes);
  const atencion = resultados.flatMap((fuente) => fuente.filas)
    .sort((a, b) => a.gravedad.localeCompare(b.gravedad) || b.dias - a.dias
      || a.codigo.localeCompare(b.codigo) || a.id.localeCompare(b.id) || a.urgencia.localeCompare(b.urgencia))
    .slice(0, 8);
  return { atencion, atencionTotal: resultados.reduce((total, fuente) => total + fuente.total, 0) };
}
