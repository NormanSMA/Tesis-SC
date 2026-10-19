import { cn } from "@/lib/utils";

// Fondos suaves con texto 700 (contraste AA). Sin celeste verdoso ni lavanda (preferencia de Norman).
const TONOS = [
  "bg-indigo-50 text-indigo-700 ring-indigo-100",
  "bg-blue-50 text-blue-700 ring-blue-100",
  "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "bg-amber-50 text-amber-800 ring-amber-100",
  "bg-rose-50 text-rose-700 ring-rose-100",
  "bg-slate-100 text-slate-700 ring-slate-200",
];

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter((parte) => /[\p{L}\p{N}]/u.test(parte));
  const primera = partes[0]?.[0] ?? "";
  const segunda = partes.length > 1 ? partes[1][0] : (partes[0]?.[1] ?? "");
  return (primera + segunda).toUpperCase();
}

/** Mismo nombre, mismo color: el índice sale de un hash estable del texto. */
export function tonoDe(nombre: string): string {
  let hash = 0;
  for (const caracter of nombre) hash = (hash * 31 + caracter.codePointAt(0)!) >>> 0;
  return TONOS[hash % TONOS.length];
}

/** Iniciales en círculo con color propio por nombre; decorativo (el nombre va al lado). */
export function AvatarIniciales({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1", tonoDe(nombre), className)}>
      {iniciales(nombre)}
    </span>
  );
}
