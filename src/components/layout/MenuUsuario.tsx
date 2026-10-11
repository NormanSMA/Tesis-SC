"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ETIQUETA_PERFIL } from "@/core/permisos";
import type { UsuarioSesion } from "@/lib/auth/sesion";

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primera + ultima).toUpperCase();
}

export function MenuUsuario({ usuario }: { usuario: UsuarioSesion }) {
  const router = useRouter();

  async function cerrarSesion() {
    try {
      const respuesta = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!respuesta.ok) throw new Error("logout");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("No se pudo cerrar la sesión. Intente de nuevo.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2" aria-label={`Menú de usuario: ${usuario.nombre}`}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
              {iniciales(usuario.nombre)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium lg:inline">{usuario.nombre}</span>
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="text-sm font-semibold">{usuario.nombre}</span>
          <span className="text-xs font-normal text-muted-foreground">{usuario.correo}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {usuario.perfiles.length > 1 ? "Perfiles" : "Perfil"}:{" "}
            {usuario.perfiles.map((codigo) => ETIQUETA_PERFIL[codigo]).join(", ")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={cerrarSesion} className="h-10 cursor-pointer">
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
