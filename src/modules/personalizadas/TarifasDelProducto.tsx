"use client";
import { Button } from "@/components/ui/button";
import { CampoSeleccion, CampoTexto } from "@/modules/cotizaciones/componentes/CamposEditor";
import type { TipoPersonalizado } from "./schema";
import type { TarifasProducto } from "./gastos-schema";
const etiquetas = { hora:"Tarifa por hora y persona",viatico:"Viático por persona y día",hospedaje:"Hospedaje por persona y noche",renta:"Renta sugerida por trabajo" };
export function TarifasDelProducto({ tipo, alCambiar }: {tipo:TipoPersonalizado;alCambiar:(t:TipoPersonalizado)=>void}) {
  const t = tipo.tarifas;
  return <details className="rounded-lg border border-formulario/70 p-4"><summary className="cursor-pointer font-medium">Tarifas sugeridas para este producto (opcional)</summary>
    <p className="my-3 text-sm">Complete los valores conocidos; cero significa pendiente o no aplicable. Si se activa un gasto al cotizar, su tarifa deberá estar completa. No se modifican cotizaciones anteriores.</p>
    {!t ? <Button variant="outline" onClick={()=>alCambiar({...tipo,tarifas:{moneda:"NIO",hora:"0",viatico:"0",hospedaje:"0",renta:"0"}})}>Definir tarifas del producto</Button> : <div className="grid gap-4 sm:grid-cols-2">
      <CampoSeleccion id="tarifas-moneda" etiqueta="Moneda de las tarifas" valor={t.moneda} opciones={[{id:"NIO",nombre:"Córdobas"},{id:"USD",nombre:"Dólares"}]} alCambiar={moneda=>alCambiar({...tipo,tarifas:{...t,moneda:moneda as TarifasProducto["moneda"]}})} />
      {(Object.keys(etiquetas) as (keyof typeof etiquetas)[]).map(k=><CampoTexto key={k} id={`tarifa-producto-${k}`} etiqueta={etiquetas[k]} decimal valor={t[k]} alCambiar={valor=>alCambiar({...tipo,tarifas:{...t,[k]:valor}})} />)}
    </div>}
  </details>;
}
