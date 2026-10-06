"use client";

import type { AtributosCampo } from "@/components/comunes/FormField";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Propiedades = AtributosCampo & {
  opciones: { valor: string; etiqueta: string }[];
  valor?: string; inicial?: string; nombre?: string; alCambiar?: (valor: string) => void; marcador?: string;
};
export function SelectorCatalogo({ opciones, valor, inicial, nombre, alCambiar, marcador, ...atributos }: Propiedades) {
  return (
    <Select name={nombre} value={valor || undefined} defaultValue={inicial} onValueChange={alCambiar}>
      <SelectTrigger {...atributos}><SelectValue placeholder={marcador ?? "Seleccione"} /></SelectTrigger>
      <SelectContent><SelectGroup>
        {opciones.map((opcion) => <SelectItem key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  );
}
