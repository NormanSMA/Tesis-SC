"use client";

import { ArrowDownUp } from "lucide-react";
import { useId } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { cn } from "@/lib/utils";

export type OpcionOrden = { valor: string; etiqueta: string };

type PropiedadesSelector = {
  opciones: OpcionOrden[];
  /** Valor `campo:direccion` del orden por defecto; no se escribe en la URL. */
  valorPorDefecto: string;
  parametro?: string;
  className?: string;
};

/**
 * Menú "Ordenar" para listas sin cabeceras ordenables (tarjetas, móvil) o con orden por fecha.
 * El valor vive en la URL como `campo:direccion` y vuelve a la página 1.
 */
export function SelectorOrden({ opciones, valorPorDefecto, parametro = "orden", className }: PropiedadesSelector) {
  const { parametros, navegar } = useParametrosUrl();
  const id = useId();
  const leido = parametros.get(parametro);
  const actual = opciones.some((opcion) => opcion.valor === leido) ? leido! : valorPorDefecto;
  return (
    <div className={cn("flex items-center", className)}>
      <label htmlFor={id} className="sr-only">Ordenar</label>
      <Select value={actual} onValueChange={(valor) => navegar({ [parametro]: valor === valorPorDefecto ? null : valor })}>
        <SelectTrigger id={id} className="h-10 gap-2 bg-card">
          <ArrowDownUp aria-hidden="true" className="size-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {opciones.map((opcion) => <SelectItem key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
