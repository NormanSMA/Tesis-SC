"use client";

import { FormField } from "@/components/comunes/FormField";
import { rangoPlanificacion } from "@/core/fechas";
import { Input } from "@/components/ui/input";
import { SelectorBuscable } from "@/components/comunes/SelectorBuscable";
import { CampoArea, CampoSeleccion } from "@/modules/cotizaciones/componentes/CamposEditor";
import type { OpcionesOrden } from "../tipos";

export type ValoresOrden = { categoriaId: string; responsableId: string; fechaEntrega: string; especificaciones: string };
export function CamposOrden({ entrada, opciones, errores, hoy, convertir, soloResponsable, fechaBloqueada, alCambiar }: {
  entrada: ValoresOrden; opciones: OpcionesOrden; errores: Record<string, string>; hoy: string; convertir: boolean;
  soloResponsable?: boolean; fechaBloqueada?: boolean;
  alCambiar: (campo: keyof ValoresOrden, valor: string) => void;
}) {
  return <>
    {convertir ? <CampoSeleccion id="categoriaId" etiqueta="Categoría principal" valor={entrada.categoriaId} requerido
      error={errores.categoriaId} alCambiar={(valor) => alCambiar("categoriaId", valor)}
      opciones={opciones.categorias}
      ayuda="Clasificación del pedido." /> : null}
    <FormField id="responsableId" etiqueta={convertir ? "Responsable de la orden" : "Responsable"} requerido={convertir}
      ayuda={convertir ? "Coordina la orden completa. Las áreas tienen sus propios responsables." : undefined} error={errores.responsableId}>
      {(atributos) => <SelectorBuscable id={atributos.id} atributos={atributos} valor={entrada.responsableId || (convertir ? "" : "sin-responsable")}
        alCambiar={(valor) => alCambiar("responsableId", valor === "sin-responsable" ? "" : valor)} marcador="Buscar responsable"
        vacio={convertir ? "Seleccione un responsable" : undefined}
        opciones={convertir ? opciones.responsables : [{ id: "sin-responsable", nombre: "Sin responsable" }, ...opciones.responsables]} />}
    </FormField>
    {!soloResponsable ? <><FormField id="fechaEntrega" etiqueta="Fecha de entrega" requerido error={errores.fechaEntrega}
      ayuda={fechaBloqueada ? "La fecha queda fija al finalizar la producción." : undefined}>
      {(atributos) => <Input {...atributos} type="date" min={hoy} max={rangoPlanificacion(hoy).maximo} value={entrada.fechaEntrega}
        disabled={fechaBloqueada} onChange={(evento) => alCambiar("fechaEntrega", evento.target.value)} />}
    </FormField>
    <CampoArea id="especificaciones" etiqueta="Especificaciones" valor={entrada.especificaciones}
      error={errores.especificaciones} alCambiar={(valor) => alCambiar("especificaciones", valor)} /></> : null}
  </>;
}
