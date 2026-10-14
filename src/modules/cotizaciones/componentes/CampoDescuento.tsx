"use client";

import { Money } from "@/components/comunes/ValorFormateado";
import type { Moneda } from "@/core/moneda";
import type { ModoDescuento } from "../calculo";
import { simboloMoneda } from "../moneda";
import { CampoSeleccion, CampoTexto } from "./CamposEditor";

type Propiedades = {
  moneda: Moneda; modo: ModoDescuento; monto: string; porcentaje: string; montoCalculado: string | null;
  errorMonto?: string; errorPorcentaje?: string; alCambiarModo: (modo: string) => void;
  alCambiarMonto: (valor: string) => void; alCambiarPorcentaje: (valor: string) => void;
};

/** Selector Monto/Porcentaje y el campo del modo elegido. Con porcentaje muestra el monto resultante. */
export function CampoDescuento(propiedades: Propiedades) {
  const { moneda, modo } = propiedades;
  return <>
    <CampoSeleccion id="cabecera-descuento-modo" etiqueta="Tipo de descuento" valor={modo} alCambiar={propiedades.alCambiarModo}
      opciones={[{ id: "MONTO", nombre: `Monto (${simboloMoneda(moneda)})` }, { id: "PORCENTAJE", nombre: "Porcentaje (%)" }]} />
    <div className="space-y-2">
      {modo === "PORCENTAJE"
        ? <CampoTexto id="cabecera-descuento-pct" etiqueta="Descuento global (%)" decimal valor={propiedades.porcentaje}
          error={propiedades.errorPorcentaje} alCambiar={propiedades.alCambiarPorcentaje} />
        : <CampoTexto id="cabecera-descuento" etiqueta={`Descuento global (${simboloMoneda(moneda)})`} decimal valor={propiedades.monto}
          error={propiedades.errorMonto} alCambiar={propiedades.alCambiarMonto} />}
      {modo === "PORCENTAJE" && propiedades.montoCalculado !== null
        ? <p id="cabecera-descuento-monto" className="text-sm">Descuento: <Money valor={propiedades.montoCalculado} moneda={moneda} /></p> : null}
    </div>
  </>;
}
