"use client";

import { CampoArea, CampoSeleccion } from "./CamposEditor";
import { NOMBRES_TARIFA, TARIFAS, type PorcentajesTarifa, type Tarifa } from "../tarifas";

export function CampoTarifa({ tarifa, porcentajes, alCambiar }: {
  tarifa: Tarifa; porcentajes: PorcentajesTarifa; alCambiar: (tarifa: Tarifa) => void;
}) {
  return <CampoSeleccion id="tarifa-cotizacion" etiqueta="Tarifa" valor={tarifa} requerido
    opciones={TARIFAS.map((id) => ({ id, nombre: `${NOMBRES_TARIFA[id]} · ${Number(porcentajes[id])} %` }))}
    alCambiar={(valor) => alCambiar(valor as Tarifa)} />;
}

export function CampoMostrarCondiciones({ mostrar, condiciones, error, alMostrar, alCambiar }: {
  mostrar: boolean; condiciones: string; error?: string;
  alMostrar: (mostrar: boolean) => void; alCambiar: (valor: string) => void;
}) {
  return <div className="space-y-3">
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" className="size-4 accent-primary" checked={mostrar}
        onChange={(evento) => alMostrar(evento.currentTarget.checked)} />
      Mostrar condiciones comerciales
    </label>
    {mostrar ? <CampoArea id="condiciones" etiqueta="Condiciones comerciales" valor={condiciones} error={error} alCambiar={alCambiar} /> : null}
  </div>;
}
