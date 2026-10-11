import { exigir, type Actor } from "@/core/autorizacion";
import { PERFILES } from "@/core/permisos";
import { AppError } from "@/lib/errores";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { construirPanel } from "./paneles";
import { consultarPerfilesPanel } from "./repo";
import type { PanelDto, PerfilPanel } from "./tipos";

export async function obtenerPanel(actor: Actor, instante = new Date(), solicitado?: string | null): Promise<PanelDto> {
  exigir(actor, "panel:ver");
  const concedidos = await consultarPerfilesPanel(actor.perfiles);
  const perfilesDisponibles = PERFILES.filter((perfil) => perfil.codigo !== "ADMIN" && concedidos.some((fila) => fila.codigo === perfil.codigo))
    .map(({ codigo, nombre }) => ({ codigo: codigo as PerfilPanel, nombre }));
  const principal = perfilesDisponibles.find((perfil) => perfil.codigo === actor.perfil) ?? perfilesDisponibles[0];
  if (!principal) throw new AppError({ codigo: "SIN_PERMISO", mensaje: "No tiene un perfil con acceso al panel.", status: 403 });
  const perfil = perfilesDisponibles.find((perfil) => perfil.codigo === solicitado)?.codigo ?? principal.codigo;
  const hoy = hoyManagua(instante);
  const contenido = await construirPanel({ perfil, actor, hoy, instante });
  return { perfil, perfilesDisponibles, generadoEn: instante.toISOString(), ...contenido };
}
export type { PanelDto } from "./tipos";
