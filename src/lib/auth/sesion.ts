export type PerfilCodigo = "GERENCIA" | "VENTAS" | "PRODUCCION" | "ADMIN";

export type UsuarioSesion = {
  id: string;
  nombre: string;
  correo: string;
  perfil: PerfilCodigo;
  permisos: string[];
};

// Stub del agente de diseño. El agente de autenticación reemplaza esta implementación y conserva las firmas.
const USUARIO_DEMOSTRACION: UsuarioSesion = {
  id: "00000000-0000-4000-8000-000000000001",
  nombre: "Usuario Demo",
  correo: "demo@solucionescreativas.test",
  perfil: "ADMIN",
  permisos: [
    "panel:ver",
    "cliente:ver",
    "cotizacion:ver",
    "orden:ver",
    "produccion:ver",
    "inventario:ver",
    "catalogo:ver",
    "bitacora:ver",
    "reporte:ver",
    "usuario:gestionar",
    "permiso:gestionar",
    "configuracion:gestionar",
  ],
};

export async function obtenerSesion(): Promise<UsuarioSesion | null> {
  if (process.env.SC_DEMO_SESION === "1") return USUARIO_DEMOSTRACION;
  return null;
}
