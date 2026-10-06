"use client";

import { FormField } from "@/components/comunes/FormField";
import { Input } from "@/components/ui/input";
import { CampoArea, CampoSeleccion } from "@/modules/cotizaciones/componentes/CamposEditor";
import type { OpcionesOrden } from "../tipos";

export type ValoresOrden = { categoriaId: string; responsableId: string; fechaEntrega: string; especificaciones: string };
export function CamposOrden({ entrada, opciones, errores, hoy, convertir, alCambiar }: {
  entrada: ValoresOrden; opciones: OpcionesOrden; errores: Record<string, string>; hoy: string; convertir: boolean;
  alCambiar: (campo: keyof ValoresOrden, valor: string) => void;
}) {
  return <>
    {convertir ? <CampoSeleccion id="categoriaId" etiqueta="Categoría principal" valor={entrada.categoriaId} requerido
      error={errores.categoriaId} alCambiar={(valor) => alCambiar("categoriaId", valor)}
      opciones={opciones.categorias.map((categoria) => ({ id: categoria.id, nombre: `${categoria.nombre} (${categoria.etapas} etapas)` }))}
      ayuda="La categoría define las etapas de la orden." /> : null}
    <CampoSeleccion id="responsableId" etiqueta="Responsable" valor={entrada.responsableId} opciones={opciones.responsables}
      requerido error={errores.responsableId} alCambiar={(valor) => alCambiar("responsableId", valor)} />
    <FormField id="fechaEntrega" etiqueta="Fecha de entrega" requerido error={errores.fechaEntrega}>
      {(atributos) => <Input {...atributos} type="date" min={hoy} value={entrada.fechaEntrega}
        onChange={(evento) => alCambiar("fechaEntrega", evento.target.value)} />}
    </FormField>
    <CampoArea id="especificaciones" etiqueta="Especificaciones" valor={entrada.especificaciones}
      error={errores.especificaciones} alCambiar={(valor) => alCambiar("especificaciones", valor)} />
  </>;
}
