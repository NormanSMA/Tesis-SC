import type { PerfilCodigo } from "@/core/permisos";

export type UsuarioDto = {
  id: string;
  nombre: string;
  correo: string;
  activo: boolean;
  perfiles: PerfilCodigo[];
  intentosFallidos: number;
  bloqueadoHasta: string | null;
  ultimoAcceso: string | null;
  creadoEn: string;
  actualizadoEn: string;
};

export type UsuarioConClave = { usuario: UsuarioDto; claveTemporal: string };
export type ListaUsuarios = { datos: UsuarioDto[]; total: number; pagina: number; porPagina: number };
