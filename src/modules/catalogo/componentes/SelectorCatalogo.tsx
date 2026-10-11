"use client";

import type { AtributosCampo } from "@/components/comunes/FormField";
import { IconoServicio } from "@/components/comunes/IconoServicio";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Propiedades = AtributosCampo & {
  /** Con `categoria`, la opción muestra la ilustración de esa categoría junto al texto. */
  opciones: { valor: string; etiqueta: string; categoria?: string }[];
  valor?: string; inicial?: string; nombre?: string; alCambiar?: (valor: string) => void; marcador?: string;
};
export function SelectorCatalogo({ opciones, valor, inicial, nombre, alCambiar, marcador, ...atributos }: Propiedades) {
  return (
    <Select name={nombre} value={valor || undefined} defaultValue={inicial} onValueChange={alCambiar}>
      <SelectTrigger {...atributos}><SelectValue placeholder={marcador ?? "Seleccione"} /></SelectTrigger>
      <SelectContent><SelectGroup>
        {opciones.map((opcion) => <SelectItem key={opcion.valor} value={opcion.valor}>
          {opcion.categoria ? <IconoServicio categoria={opcion.categoria} tamano={20} /> : null}{opcion.etiqueta}
        </SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  );
}
