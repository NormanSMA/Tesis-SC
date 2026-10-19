"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

const HORA = new Intl.DateTimeFormat("es-NI", { hour: "numeric", minute: "2-digit", timeZone: "America/Managua" });

function suscribir(avisar: () => void): () => void {
  const intervalo = window.setInterval(avisar, 15_000);
  return () => window.clearInterval(intervalo);
}

// Texto por minuto: el valor solo cambia cuando cambia el minuto, así React no re-renderiza en vano.
const horaActual = () => HORA.format(new Date());
// En el servidor y al hidratar no hay hora: se evita el desajuste de hidratación.
const sinHora = () => null;

/** Hora actual de Managua, arriba a la derecha de la barra superior. */
export function Reloj() {
  const hora = useSyncExternalStore(suscribir, horaActual, sinHora);
  if (!hora) return <span aria-hidden="true" className="w-20" />;
  return (
    <span className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-card px-2.5 py-1 text-sm text-slate-600 tabular-nums shadow-xs sm:inline-flex">
      <Clock aria-hidden="true" className="size-3.5 text-slate-400" />
      <time aria-label={`Hora actual: ${hora}`}>{hora}</time>
    </span>
  );
}
