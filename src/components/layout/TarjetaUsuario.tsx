"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ETIQUETA_PERFIL } from "@/core/permisos";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { cn } from "@/lib/utils";

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primera + ultima).toUpperCase();
}

function useCerrarSesion() {
  const router = useRouter();
  return async function cerrarSesion() {
    try {
      const respuesta = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!respuesta.ok) throw new Error("logout");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("No se pudo cerrar la sesión. Intente de nuevo.");
    }
  };
}

function Iniciales({ usuario, className }: { usuario: UsuarioSesion; className?: string }) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
        {iniciales(usuario.nombre)}
      </AvatarFallback>
    </Avatar>
  );
}

function BotonSalir({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0 text-slate-500 hover:bg-danger-soft hover:text-danger"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      onClick={onClick}
    >
      <LogOut aria-hidden="true" />
    </Button>
  );
}

/** Tarjeta completa: avatar, nombre, correo, perfil y salida (menú ancho y panel móvil). */
function TarjetaAmplia({ usuario, className }: { usuario: UsuarioSesion; className?: string }) {
  const cerrarSesion = useCerrarSesion();
  const etiquetaPerfil = usuario.perfiles.length > 1 ? "Perfiles" : "Perfil";
  const perfiles = usuario.perfiles.map((codigo) => ETIQUETA_PERFIL[codigo]).join(" · ");
  return (
    <section aria-label="Sesión de usuario" className={cn("p-3", className)}>
      <div className="flex items-center gap-3 rounded-xl px-1 py-1" title={usuario.correo}>
        <Iniciales usuario={usuario} className="size-9" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-foreground" title={usuario.nombre}>{usuario.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="sr-only">{etiquetaPerfil}: </span>{perfiles}
          </p>
        </div>
        <BotonSalir onClick={cerrarSesion} />
      </div>
    </section>
  );
}

/** Versión angosta para el riel de íconos: avatar y salida apilados. */
function TarjetaRiel({ usuario, className }: { usuario: UsuarioSesion; className?: string }) {
  const cerrarSesion = useCerrarSesion();
  const perfiles = usuario.perfiles.map((codigo) => ETIQUETA_PERFIL[codigo]).join(", ");
  return (
    <section aria-label="Sesión de usuario" className={cn("flex flex-col items-center gap-1 p-2", className)}>
      <span title={`${usuario.nombre} · ${perfiles}`} role="img" aria-label={usuario.nombre}>
        <Iniciales usuario={usuario} className="size-9" />
      </span>
      <BotonSalir onClick={cerrarSesion} />
    </section>
  );
}

type PropiedadesTarjeta = { usuario: UsuarioSesion; modo: "amplia" | "riel" | "adaptable" };

/** `adaptable`: riel angosto hasta 1279 px y tarjeta completa desde 1280 px, como el menú lateral. */
export function TarjetaUsuario({ usuario, modo }: PropiedadesTarjeta) {
  if (modo === "amplia") return <TarjetaAmplia usuario={usuario} />;
  if (modo === "riel") return <TarjetaRiel usuario={usuario} />;
  return (
    <>
      <TarjetaRiel usuario={usuario} className="xl:hidden" />
      <TarjetaAmplia usuario={usuario} className="hidden xl:block" />
    </>
  );
}
