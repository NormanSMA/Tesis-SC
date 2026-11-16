"use client";
import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { cn } from "@/lib/utils";
export type OpcionSegmento = { valor: string; etiqueta: string; conteo?: number };
type Props = { etiqueta: string; opciones: OpcionSegmento[]; parametro: string; valorTodos?: string; className?: string };
/** Conserva el contrato anterior y sustituye las tiras de opciones por un desplegable. */
export function FiltroSegmentado({ etiqueta, opciones, parametro, valorTodos = "", className }: Props) {
  const { parametros, navegar } = useParametrosUrl();
  const id = useId(), vacio = "__sin_filtro__", actual = parametros.get(parametro) ?? valorTodos;
  return <div className={cn("flex min-w-40 max-w-full flex-col gap-1.5", className)}>
    <label htmlFor={id} className="text-sm font-medium">{etiqueta}</label>
    <Select value={actual || vacio} onValueChange={valor => navegar({ [parametro]: valor === vacio || valor === valorTodos ? null : valor })}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{opciones.map(opcion => <SelectItem key={opcion.valor} value={opcion.valor || vacio}>
        {opcion.etiqueta}{opcion.conteo !== undefined ? ` (${opcion.conteo})` : ""}
      </SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
