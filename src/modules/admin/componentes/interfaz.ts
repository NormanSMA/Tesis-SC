import { z } from "zod";

import { PERFILES, type PerfilCodigo } from "@/core/permisos";
import { esquemaValorPorClaveConfiguracion } from "@/modules/admin/configuracion-schema";
import type { UsuarioDto } from "@/modules/admin/tipos";

export type EstadoUsuario = "ACTIVO" | "BLOQUEADO" | "INACTIVO";
export type FiltroEstadoUsuario = EstadoUsuario | "TODOS";
export type FiltrosUsuarios = { q: string; perfil: PerfilCodigo | ""; estado: FiltroEstadoUsuario; pagina: number };
export const FILTRO_ESTADO_PREDETERMINADO: FiltroEstadoUsuario = "ACTIVO";
export const PERMISOS_PROTEGIDOS = ["usuario:gestionar", "permiso:gestionar", "configuracion:gestionar"];

export function estadoUsuario(usuario: UsuarioDto, ahora: number): EstadoUsuario {
  if (!usuario.activo) return "INACTIVO";
  return usuario.bloqueadoHasta && Date.parse(usuario.bloqueadoHasta) > ahora ? "BLOQUEADO" : "ACTIVO";
}

export function leerFiltrosUsuarios(parametros: Record<string, string | string[] | undefined>): FiltrosUsuarios {
  const texto = (clave: string) => typeof parametros[clave] === "string" ? parametros[clave] : "";
  const perfil = PERFILES.find(({ codigo }) => codigo === texto("perfil"))?.codigo ?? "";
  const estado = ["ACTIVO", "BLOQUEADO", "INACTIVO", "TODOS"].find((valor) => valor === texto("estado")) ?? FILTRO_ESTADO_PREDETERMINADO;
  const pagina = Number(texto("pagina"));
  return {
    q: texto("q").trim().slice(0, 200), perfil, estado: estado as FiltroEstadoUsuario,
    pagina: Number.isInteger(pagina) && pagina > 0 ? Math.min(pagina, 100_000) : 1,
  };
}

export function filtrarUsuarios(datos: UsuarioDto[], filtros: FiltrosUsuarios, ahora: number) {
  const q = filtros.q.toLocaleLowerCase("es");
  return datos.filter((usuario) =>
    (!q || `${usuario.nombre} ${usuario.correo}`.toLocaleLowerCase("es").includes(q)) &&
    (!filtros.perfil || usuario.perfiles.includes(filtros.perfil)) &&
    coincideEstado(usuario, filtros.estado, ahora));
}

function coincideEstado(usuario: UsuarioDto, filtro: FiltroEstadoUsuario, ahora: number): boolean {
  if (filtro === "TODOS") return true;
  if (filtro === "ACTIVO") return usuario.activo;
  return estadoUsuario(usuario, ahora) === filtro;
}

export function hrefUsuarios(filtros: FiltrosUsuarios, pagina: number): string {
  const parametros = new URLSearchParams();
  if (filtros.q) parametros.set("q", filtros.q);
  if (filtros.perfil) parametros.set("perfil", filtros.perfil);
  if (filtros.estado !== FILTRO_ESTADO_PREDETERMINADO) parametros.set("estado", filtros.estado);
  if (pagina > 1) parametros.set("pagina", String(pagina));
  const texto = parametros.toString();
  return `/admin/usuarios${texto ? `?${texto}` : ""}`;
}

export function diferenciasPermisos(actual: readonly string[], nuevo: readonly string[]) {
  return {
    altas: nuevo.filter((permiso) => !actual.includes(permiso)),
    bajas: actual.filter((permiso) => !nuevo.includes(permiso)),
  };
}

export function permisoProtegido(perfil: string, permiso: string): boolean {
  return perfil === "ADMIN" && PERMISOS_PROTEGIDOS.includes(permiso);
}

export function esquemaValorConfiguracion({ clave, tipo }: { clave: string; tipo: string }) {
  if (clave === "zona_horaria") return z.string().refine(() => false, "La zona horaria es de solo lectura.");
  const tipos: Record<string, z.ZodType<string>> = {
    DECIMAL: z.string().regex(/^-?\d+(\.\d+)?$/, "Ingrese un valor decimal."),
    ENTERO: z.string().regex(/^-?\d+$/, "Ingrese un valor entero."),
    TEXTO: z.string(),
  };
  const tipoValor = tipos[tipo] ?? z.string().refine(() => false, "El tipo no es editable.");
  const esquemaClave = esquemaValorPorClaveConfiguracion(clave);
  return esquemaClave ? tipoValor.pipe(esquemaClave) : tipoValor;
}

export function fechaAdministracion(valor: string | null): string {
  if (!valor) return "Sin registro";
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Managua",
  }).format(new Date(valor));
}
