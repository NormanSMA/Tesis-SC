"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import type { Moneda } from "@/core/moneda";
import { formatearDecimal, formatearMonedaEntera } from "@/lib/formato";
import { formatearCompacto, UMBRAL_COMPACTO } from "@/lib/listas/numeros";
import { cn } from "@/lib/utils";

export type FormatoNumero = "entero" | "moneda" | "porcentaje";

type PropiedadesContador = {
  /** Valor crudo; null muestra "—". */
  numero: number | null;
  /** Texto final formateado por el servidor: se lee en voz alta y queda al terminar. */
  texto: string;
  formato: FormatoNumero;
  moneda?: Moneda;
  /** Muestra al final el texto del servidor tal cual (con decimales), sin redondear ni compactar. */
  textoExacto?: boolean;
  duracionMs?: number;
  className?: string;
};

function formatear(valor: number, formato: FormatoNumero, moneda: Moneda): string {
  if (Math.abs(valor) >= UMBRAL_COMPACTO) {
    const compacto = formatearCompacto(valor);
    return formato === "moneda" ? `${moneda === "USD" ? "US$" : "C$"} ${compacto}` : compacto;
  }
  if (formato === "moneda") return formatearMonedaEntera(Math.round(valor), moneda);
  if (formato === "porcentaje") return `${Math.round(valor)} %`;
  return formatearDecimal(Math.round(valor), 0);
}

const escapar = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Número que cuenta del valor anterior al nuevo (400 ms, ease-out cúbico) sin re-render por cuadro.
 * - El servidor pinta el valor final: sin parpadeo ni desajuste de hidratación.
 * - El nodo animado usa dangerouslySetInnerHTML: React solo lo toca si cambia el texto final,
 *   así un re-render del padre no pisa el conteo en curso.
 * - Lectores de pantalla oyen solo el valor final (sr-only); el número animado es aria-hidden.
 */
export function ContadorMetrica({ numero, texto, formato, moneda = "NIO", textoExacto = false, duracionMs = 400, className }: PropiedadesContador) {
  const nodo = useRef<HTMLSpanElement>(null);
  const anterior = useRef(0);
  const visibleFinal = numero === null ? "—" : textoExacto ? texto : formatear(numero, formato, moneda);
  const compacto = !textoExacto && numero !== null && Math.abs(numero) >= UMBRAL_COMPACTO;

  // Antes de pintar, el nodo arranca en el valor anterior para que no se vea un salto.
  useLayoutEffect(() => {
    const destino = nodo.current;
    if (!destino || numero === null) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducido && anterior.current !== numero) destino.textContent = formatear(anterior.current, formato, moneda);
  }, [numero, formato, moneda]);

  useEffect(() => {
    const destino = nodo.current;
    if (!destino || numero === null) return;
    const desde = anterior.current;
    anterior.current = numero;
    if (desde === numero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      destino.textContent = visibleFinal;
      return;
    }
    let inicio: number | null = null;
    let cuadro = 0;
    const paso = (instante: number) => {
      inicio ??= instante;
      const avance = Math.min((instante - inicio) / duracionMs, 1);
      const suave = 1 - (1 - avance) ** 3;
      destino.textContent = avance < 1 ? formatear(desde + (numero - desde) * suave, formato, moneda) : visibleFinal;
      if (avance < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [numero, visibleFinal, formato, moneda, duracionMs]);

  return (
    <span className={cn("tabular-nums", className)} title={compacto ? texto : undefined}>
      <span ref={nodo} aria-hidden="true" dangerouslySetInnerHTML={{ __html: escapar(visibleFinal) }} />
      <span className="sr-only">{numero === null ? "Sin datos" : texto}</span>
    </span>
  );
}
