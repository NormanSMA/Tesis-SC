"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Notificacion } from "../tipos";
import { useNotificaciones } from "./useNotificaciones";
import { useSonidoAvisos } from "./useSonidoAvisos";

const HORA = new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  timeZone: "America/Managua" });

function ElementoAviso({ aviso, nuevo, cerrar }: { aviso: Notificacion; nuevo: boolean; cerrar: () => void }) {
  return <li>
    <Link href={aviso.destino} prefetch={false} onClick={cerrar}
      className="flex gap-3 rounded-md px-3 py-2.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
      <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full",
        aviso.alerta ? "bg-destructive" : nuevo ? "bg-primary" : "bg-transparent")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", nuevo ? "font-semibold" : "font-medium")}>{aviso.titulo}</span>
        <span className="block truncate text-sm text-muted-foreground">{aviso.detalle}</span>
        <span className="block text-xs text-muted-foreground">{HORA.format(new Date(aviso.fecha))}</span>
      </span>
    </Link>
  </li>;
}

export function CentroNotificaciones({ usuarioId }: { usuarioId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [leidasAlAbrir, setLeidasAlAbrir] = useState<string | null>(null);
  const sonido = useSonidoAvisos(usuarioId);
  const { centro, marcarLeidas } = useNotificaciones(usuarioId, sonido.sonar);
  function alternar(valor: boolean) {
    setAbierto(valor);
    if (!valor) return;
    // Al abrir se conserva qué era nuevo para resaltarlo mientras la ventana sigue abierta.
    setLeidasAlAbrir(centro.leidasHasta);
    if (centro.noLeidas) void marcarLeidas();
  }
  const etiqueta = centro.noLeidas ? `Notificaciones, ${centro.noLeidas} sin leer` : "Notificaciones";
  return <Popover open={abierto} onOpenChange={alternar}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon-lg" className="relative text-slate-500 hover:bg-slate-200/60 hover:text-slate-900" aria-label={etiqueta}>
        <Bell aria-hidden="true" className="size-5" />
        {centro.noLeidas ? <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] leading-5 font-semibold text-white">
          {centro.noLeidas > 9 ? "9+" : centro.noLeidas}</span> : null}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Notificaciones</h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sonido <Switch size="sm" checked={sonido.activo} onCheckedChange={sonido.cambiar} aria-label="Sonido de avisos" />
        </label>
      </div>
      {centro.datos.length ? <ul aria-label="Avisos" className="max-h-96 overflow-y-auto p-1">
        {centro.datos.map((aviso) => <ElementoAviso key={aviso.id} aviso={aviso} cerrar={() => setAbierto(false)}
          nuevo={!leidasAlAbrir || aviso.fecha > leidasAlAbrir} />)}
      </ul> : <p className="px-4 py-6 text-center text-sm text-muted-foreground">No tiene notificaciones pendientes.</p>}
      {sonido.activo && !sonido.listo ? <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        El sonido se habilita al tocar cualquier parte de la página.</p> : null}
    </PopoverContent>
  </Popover>;
}
