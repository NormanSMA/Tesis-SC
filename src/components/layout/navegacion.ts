import { BookTextIcon } from "@/components/iconos-animados/book-text";
import { BoxesIcon } from "@/components/iconos-animados/boxes";
import { ChartColumnIncreasingIcon } from "@/components/iconos-animados/chart-column-increasing";
import { ClipboardCheckIcon } from "@/components/iconos-animados/clipboard-check";
import { HistoryIcon } from "@/components/iconos-animados/history";
import { LayoutGridIcon } from "@/components/iconos-animados/layout-grid";
import { ReceiptTextIcon } from "@/components/iconos-animados/receipt-text";
import { SettingsIcon } from "@/components/iconos-animados/settings";
import { ShieldCheckIcon } from "@/components/iconos-animados/shield-check";
import { UserRoundCogIcon } from "@/components/iconos-animados/user-round-cog";
import { UsersIcon } from "@/components/iconos-animados/users";

import { BrazoRobotAnimado } from "./IconoBrazoRobotAnimado";
import type { IconoAnimado } from "./icono-animado";

export type ItemNavegacion = {
  href: string;
  etiqueta: string;
  icono: IconoAnimado;
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
      { href: "/panel", etiqueta: "Panel", icono: LayoutGridIcon, permiso: "panel:ver" },
      { href: "/clientes", etiqueta: "Clientes", icono: UsersIcon, permiso: "cliente:ver" },
      { href: "/cotizaciones", etiqueta: "Cotizaciones", icono: ReceiptTextIcon, permiso: "cotizacion:ver" },
      { href: "/ordenes", etiqueta: "Órdenes de trabajo", icono: ClipboardCheckIcon, permiso: "orden:ver" },
      { href: "/produccion", etiqueta: "Producción", icono: BrazoRobotAnimado, permiso: "produccion:ver" },
      { href: "/inventario", etiqueta: "Inventario", icono: BoxesIcon, permiso: "inventario:ver" },
      { href: "/catalogo", etiqueta: "Catálogo", icono: BookTextIcon, permiso: "catalogo:ver" },
      { href: "/trazabilidad", etiqueta: "Trazabilidad", icono: HistoryIcon, permiso: "bitacora:ver" },
      { href: "/reportes", etiqueta: "Reportes", icono: ChartColumnIncreasingIcon, permiso: "reporte:ver" },
    ],
  },
  {
    id: "administracion",
    etiqueta: "Administración técnica",
    items: [
      { href: "/admin/usuarios", etiqueta: "Usuarios", icono: UserRoundCogIcon, permiso: "usuario:gestionar" },
      { href: "/admin/permisos", etiqueta: "Perfiles y permisos", icono: ShieldCheckIcon, permiso: "permiso:gestionar" },
      { href: "/admin/configuracion", etiqueta: "Configuración", icono: SettingsIcon, permiso: "configuracion:gestionar" },
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
