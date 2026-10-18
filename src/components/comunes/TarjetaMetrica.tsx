import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ContadorMetrica, type FormatoNumero } from "@/components/comunes/ContadorMetrica";
import type { Moneda } from "@/core/moneda";
import { cn } from "@/lib/utils";

export type TendenciaMetrica = { direccion: "sube" | "baja" | "igual"; texto: string };

type PropiedadesTarjeta = {
  etiqueta: string;
  numero: number | null;
  /** Valor final formateado (servidor). */
  texto: string;
  formato: FormatoNumero;
  moneda?: Moneda;
  tendencia?: TendenciaMetrica;
  /** Invierte el color: bajar es bueno (atrasadas, sin responsable). */
  mejorSiBaja?: boolean;
  /** Pie comparativo, ej. "vs. septiembre: C$ 120,000". */
  pie?: string;
  alerta?: boolean;
  destino?: string;
  icono?: LucideIcon;
  /** Zona derecha opcional (anillo, mini barra). */
  adorno?: ReactNode;
};

const ICONOS_TENDENCIA = { sube: ArrowUpRight, baja: ArrowDownRight, igual: ArrowRight };

function colorTendencia(direccion: TendenciaMetrica["direccion"], mejorSiBaja: boolean): string {
  if (direccion === "igual") return "text-muted-foreground";
  const buena = mejorSiBaja ? direccion === "baja" : direccion === "sube";
  return buena ? "text-success" : "text-danger";
}

/** Tarjeta KPI de tres zonas: cabecera (título y alerta), cuerpo (valor y tendencia) y pie comparativo. */
export function TarjetaMetrica(propiedades: PropiedadesTarjeta) {
  const { etiqueta, numero, texto, formato, moneda, tendencia, mejorSiBaja = false, pie, alerta, destino, icono: Icono, adorno } = propiedades;
  const IconoTendencia = tendencia ? ICONOS_TENDENCIA[tendencia.direccion] : null;
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {Icono ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground">
              <Icono aria-hidden="true" className="size-4" />
            </span>
          ) : null}
          <span className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{etiqueta}</span>
        </span>
        {alerta ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning-soft-border bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
            <Clock aria-hidden="true" className="size-3" />Requiere acción
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <ContadorMetrica numero={numero} texto={texto} formato={formato} moneda={moneda}
            className="text-3xl font-bold tracking-tight text-slate-900" />
          {tendencia && IconoTendencia ? (
            <span className={cn("inline-flex items-center text-xs font-semibold", colorTendencia(tendencia.direccion, mejorSiBaja))}>
              <IconoTendencia aria-hidden="true" className="size-3.5" />
              <span className="sr-only">{tendencia.direccion === "sube" ? "Sube" : tendencia.direccion === "baja" ? "Baja" : "Igual"}</span>
              {tendencia.texto}
            </span>
          ) : null}
        </div>
        {adorno}
      </div>
      {pie ? <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-muted-foreground">{pie}</p> : null}
    </>
  );
  const clase = "flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:p-5";
  if (!destino) return <div className={clase}>{contenido}</div>;
  return (
    <Link href={destino} aria-label={`${etiqueta}: ${texto}. Ver detalle`}
      className={cn(clase, "transition-colors duration-100 ease-out hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring")}>
      {contenido}
    </Link>
  );
}
