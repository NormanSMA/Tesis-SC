import { ArrowDown, ArrowRight, ArrowUp, Activity, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ContadorMetrica, type FormatoNumero } from "@/components/comunes/ContadorMetrica";
import { PuntoEnVivo } from "@/components/comunes/PuntoEnVivo";
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
  /** Reportes: la cifra final conserva los decimales del texto del servidor. */
  textoExacto?: boolean;
  tendencia?: TendenciaMetrica;
  /** Invierte el color: bajar es bueno (atrasadas, sin responsable). */
  mejorSiBaja?: boolean;
  /** Texto comparativo junto a la tendencia, ej. "vs. septiembre: C$ 120,000". */
  pie?: string;
  alerta?: boolean;
  destino?: string;
  icono?: LucideIcon;
  /** Caja del ícono rellena con el color principal (primera métrica). */
  destacada?: boolean;
  /** Zona derecha opcional (anillo, mini barra). */
  adorno?: ReactNode;
};

const ICONOS_TENDENCIA = { sube: ArrowUp, baja: ArrowDown, igual: ArrowRight };

function tonoTendencia(direccion: TendenciaMetrica["direccion"], mejorSiBaja: boolean): "exito" | "peligro" | "neutro" {
  if (direccion === "igual") return "neutro";
  const buena = mejorSiBaja ? direccion === "baja" : direccion === "sube";
  return buena ? "exito" : "peligro";
}

const COLORES_TENDENCIA = {
  exito: { texto: "text-success", circulo: "bg-success" },
  peligro: { texto: "text-danger", circulo: "bg-danger" },
  neutro: { texto: "text-slate-500", circulo: "bg-slate-400" },
};

function Tendencia({ tendencia, mejorSiBaja }: { tendencia: TendenciaMetrica; mejorSiBaja: boolean }) {
  const Icono = ICONOS_TENDENCIA[tendencia.direccion];
  const colores = COLORES_TENDENCIA[tonoTendencia(tendencia.direccion, mejorSiBaja)];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-sm font-medium whitespace-nowrap", colores.texto)}>
      <span aria-hidden="true" className={cn("flex size-[18px] items-center justify-center rounded-full text-white", colores.circulo)}>
        <Icono className="size-3" strokeWidth={3} />
      </span>
      <span className="sr-only">{tendencia.direccion === "sube" ? "Sube" : tendencia.direccion === "baja" ? "Baja" : "Igual"}</span>
      {tendencia.texto}
    </span>
  );
}

/**
 * Tarjeta KPI estilo Mise: cabecera con ícono en caja y título, separador fino,
 * número grande de trazo ligero y fila de tendencia con texto comparativo.
 */
export function TarjetaMetrica(propiedades: PropiedadesTarjeta) {
  const { etiqueta, numero, texto, formato, moneda, textoExacto, tendencia, mejorSiBaja = false, pie, alerta, destino, icono: Icono = Activity, destacada, adorno } = propiedades;
  const contenido = (
    <>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg",
          destacada ? "bg-primary text-primary-foreground shadow-sm" : "border border-slate-200 bg-card text-slate-600")}>
          <Icono aria-hidden="true" className="size-4" />
        </span>
        <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug font-medium text-slate-800">{etiqueta}</span>
        {/* Alerta compacta: un punto rojo con pulso no le quita espacio al título. */}
        {alerta ? (
          <span className="flex shrink-0 items-center" title="Requiere acción">
            <PuntoEnVivo className="size-2" />
            <span className="sr-only">Requiere acción</span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 px-4 pt-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <ContadorMetrica numero={numero} texto={texto} formato={formato} moneda={moneda} textoExacto={textoExacto}
            className="text-[2.25rem] leading-none font-normal tracking-tight text-slate-900" />
          {adorno}
        </div>
        {tendencia || pie ? (
          <div className="flex min-w-0 items-center justify-between gap-3">
            {tendencia ? <Tendencia tendencia={tendencia} mejorSiBaja={mejorSiBaja} /> : null}
            {pie ? <span className={cn("min-w-0 truncate text-sm text-slate-500", tendencia && "text-right")} title={pie}>{pie}</span> : null}
          </div>
        ) : null}
      </div>
    </>
  );
  const clase = "flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm";
  if (!destino) return <div className={clase}>{contenido}</div>;
  return (
    <Link href={destino} aria-label={`${etiqueta}: ${texto}. Ver detalle`}
      className={cn(clase, "transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring")}>
      {contenido}
    </Link>
  );
}

/** Bandeja gris que agrupa tarjetas tipo bento con separación fina. */
export function BandejaMetricas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-1.5 rounded-[20px] border border-slate-200/70 bg-slate-100/80 p-1.5 md:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}
