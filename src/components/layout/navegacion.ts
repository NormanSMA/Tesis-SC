import {
  Activity,
  BookOpen,
  Boxes,
  ClipboardCheck,
  History,
  LayoutDashboard,
  BarChart3,
  Settings,
  ShieldCheck,
  Calculator,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import { BrazoRobot } from "./IconoBrazoRobot";

export type ItemNavegacion = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  permiso: string;
};

export type GrupoNavegacion = {
  id: string;
  etiqueta?: string;
  /** La etiqueta solo titula el grupo en el menú; no aparece en las migas. */
  soloMenu?: boolean;
  items: ItemNavegacion[];
};

export const gruposNavegacion: GrupoNavegacion[] = [
  {
    id: "operacion",
    etiqueta: "Operación",
    soloMenu: true,
    items: [
      { href: "/panel", etiqueta: "Panel", icono: LayoutDashboard, permiso: "panel:ver" },
      { href: "/clientes", etiqueta: "Clientes", icono: Users, permiso: "cliente:ver" },
      { href: "/cotizaciones", etiqueta: "Cotizaciones", icono: Calculator, permiso: "cotizacion:ver" },
      { href: "/ordenes", etiqueta: "Órdenes de trabajo", icono: ClipboardCheck, permiso: "orden:ver" },
      { href: "/produccion", etiqueta: "Producción", icono: BrazoRobot, permiso: "produccion:ver" },
    ],
  },
  {
    id: "recursos",
    etiqueta: "Recursos",
    soloMenu: true,
    items: [
      { href: "/inventario", etiqueta: "Inventario", icono: Boxes, permiso: "inventario:ver" },
      { href: "/catalogo", etiqueta: "Catálogo", icono: BookOpen, permiso: "catalogo:ver" },
    ],
  },
  {
    id: "analisis",
    etiqueta: "Análisis",
    soloMenu: true,
    items: [
      { href: "/trazabilidad", etiqueta: "Trazabilidad", icono: History, permiso: "bitacora:ver" },
      { href: "/reportes", etiqueta: "Reportes", icono: BarChart3, permiso: "reporte:ver" },
    ],
  },
  {
    id: "administracion",
    etiqueta: "Administración técnica",
    items: [
      { href: "/admin/usuarios", etiqueta: "Usuarios", icono: UserCog, permiso: "usuario:gestionar" },
      { href: "/admin/permisos", etiqueta: "Perfiles y permisos", icono: ShieldCheck, permiso: "permiso:gestionar" },
      { href: "/admin/configuracion", etiqueta: "Configuración", icono: Settings, permiso: "configuracion:gestionar" },
      { href: "/admin/sistema", etiqueta: "Estado del sistema", icono: Activity, permiso: "configuracion:gestionar" },
    ],
  },
];

// Solo oculta opciones. La autorización real ocurre en el servidor.
export function filtrarNavegacion(
  grupos: GrupoNavegacion[],
  permisos: string[],
): GrupoNavegacion[] {
  const concedidos = new Set(permisos);
  return grupos
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => concedidos.has(item.permiso)),
    }))
    .filter((grupo) => grupo.items.length > 0);
}

export function itemActivo(grupos: GrupoNavegacion[], ruta: string): ItemNavegacion | undefined {
  const todos = grupos.flatMap((grupo) => grupo.items);
  return todos
    .filter((item) => ruta === item.href || ruta.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * Inicio de un usuario: el destino de su perfil si puede verlo; si la matriz se lo quitó,
 * la primera sección permitida. Lo usan el logo del menú y "Ir a mi inicio".
 */
export function inicioDeUsuario(destinoPerfil: string, permisos: string[]): string {
  const permitidas = filtrarNavegacion(gruposNavegacion, permisos).flatMap((grupo) => grupo.items.map((item) => item.href));
  return permitidas.includes(destinoPerfil) ? destinoPerfil : (permitidas[0] ?? destinoPerfil);
}
