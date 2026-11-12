"use client";

import { CampoArea, CampoSeleccion } from "@/modules/cotizaciones/componentes/CamposEditor";
import type { EntradaCrearOrden } from "../schema";
import type { OpcionesOrden, ReferenciaOrden } from "../tipos";

export type EtapasSeleccionadas = NonNullable<EntradaCrearOrden["etapas"]>;

export function AreasOrden({ opciones, etapas, errores, alCambiar }: {
  opciones: OpcionesOrden; etapas: EtapasSeleccionadas; errores: Record<string, string>;
  alCambiar: (etapas: EtapasSeleccionadas) => void;
}) {
  function alternar(area: ReferenciaOrden, activar: boolean) {
    alCambiar(activar ? [...etapas, { areaId: area.id, responsableId: "", instrucciones: "" }] :
      etapas.filter(({ areaId }) => areaId !== area.id));
  }
  return <fieldset className="min-w-0 space-y-4" aria-describedby={errores.etapas ? "error-areas" : undefined}>
    <legend className="sr-only">Áreas de producción</legend>
    {errores.etapas ? <p id="error-areas" role="alert" className="text-sm text-destructive">{errores.etapas}</p> : null}
    {opciones.areasConversion?.map((area) => {
      const indice = etapas.findIndex(({ areaId }) => areaId === area.id);
      const etapa = etapas[indice];
      const actualizar = (cambios: Partial<EtapasSeleccionadas[number]>) =>
        alCambiar(etapas.map((fila) => fila.areaId === area.id ? { ...fila, ...cambios } : fila));
      return <div key={area.id} className="space-y-3 rounded-lg border p-4">
        <label className="flex min-h-8 items-center gap-2 font-medium">
          <input type="checkbox" className="size-4 accent-primary" checked={Boolean(etapa)} disabled={!area.responsables.length}
            aria-invalid={errores.etapas ? true : undefined} onChange={(evento) => alternar(area, evento.target.checked)} />
          {area.nombre}{etapa ? <span className="text-xs text-muted-foreground">Etapa {indice + 1}</span> : null}
        </label>
        {!area.responsables.length ? <p className="text-sm text-muted-foreground">Área sin personal asignado.</p> : null}
        {etapa ? <>
          <CampoSeleccion id={`responsable-${area.id}`} etiqueta={`Responsable de ${area.nombre}`} requerido
            valor={etapa.responsableId} opciones={area.responsables} error={errores[`etapas.${indice}.responsableId`]}
            alCambiar={(responsableId) => actualizar({ responsableId })} />
          <CampoArea id={`instrucciones-${area.id}`} etiqueta={`Instrucciones de ${area.nombre}`} requerido
            valor={etapa.instrucciones} error={errores[`etapas.${indice}.instrucciones`]}
            alCambiar={(instrucciones) => actualizar({ instrucciones })} />
        </> : null}
      </div>;
    })}
  </fieldset>;
}
