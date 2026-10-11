import {
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  Factory,
  History,
  LayoutDashboard,
  BarChart3,
  Settings,
  ShieldCheck,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type ItemNavegacion = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  permiso: string;
};

export type GrupoNavegacion = {
  id: string;
  etiqueta?: string;
  items: ItemNavegacion[];
};

export const gruposNavegacion: GrupoNavegacion[] = [
  {
    id: "operacion",
    items: [
      { href: "/panel", etiqueta: "Panel", icono: LayoutDashboard, permiso: "panel:ver" },
      { href: "/clientes", etiqueta: "Clientes", icono: Users, permiso: "cliente:ver" },
      { href: "/cotizaciones", etiqueta: "Cotizaciones", icono: FileText, permiso: "cotizacion:ver" },
      { href: "/ordenes", etiqueta: "Órdenes de trabajo", icono: ClipboardList, permiso: "orden:ver" },
      { href: "/produccion", etiqueta: "Producción", icono: Factory, permiso: "produccion:ver" },
      { href: "/inventario", etiqueta: "Inventario", icono: Boxes, permiso: "inventario:ver" },
      { href: "/catalogo", etiqueta: "Catálogo", icono: BookOpen, permiso: "catalogo:ver" },
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
