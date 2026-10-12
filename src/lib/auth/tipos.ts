import type { PerfilCodigo } from "@/core/permisos";

export type UsuarioSesion = {
  id: string;
  nombre: string;
  correo: string;
  perfil: PerfilCodigo;
  perfiles: PerfilCodigo[];
  permisos: string[];
  debeCambiarClave: boolean;
};
