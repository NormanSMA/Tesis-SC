"use client";

import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ResumenOrdenInventario } from "../contrato-orden";
import type { MaterialDto } from "../dto";
import { SelectorMaterial } from "./SelectorMaterial";

export type LineaFormulario = { clave: string; materialId: string; codigo: string; nombre: string; cantidad: string; existencia: string; unidad: string };
export function LineaMovimientoOrden({ linea, indice, resumen, errores, cambiar, quitar }: {
  linea: LineaFormulario; indice: number; resumen: ResumenOrdenInventario; errores: Record<string, string>;
  cambiar: (cambios: Partial<LineaFormulario>) => void; quitar: () => void;
}) {
  const prefijo = `lineas.${indice}`;
  const disponible = resumen.materiales.find((fila) => fila.material.id === linea.materialId)?.existencia ?? linea.existencia;
  function seleccionar(material: MaterialDto | null) {
    cambiar({ materialId: material?.id ?? "", codigo: material?.codigo ?? "", nombre: material?.nombre ?? "", existencia: material?.existencia ?? "0.000", unidad: material?.unidad ?? "" });
  }
  return <Card className="min-w-0 gap-4 px-5"><fieldset className="min-w-0 space-y-4">
    <legend className="text-base font-semibold">Línea {indice + 1}: {linea.nombre || "Seleccione material"}</legend>
    <SelectorMaterial id={`${prefijo}.materialId`} valor={linea.materialId} error={errores[`${prefijo}.materialId`]}
      cambiar={seleccionar} />
    <p className="text-sm">Existencia disponible: {disponible} {linea.unidad}</p>
    <FormField id={`${prefijo}.cantidad`} etiqueta="Cantidad" requerido error={errores[`${prefijo}.cantidad`]
      ?? errores[`${prefijo}.disponible`] ?? errores[linea.materialId]}>{(atributos) => <Input {...atributos} inputMode="decimal"
        value={linea.cantidad} onChange={(e) => cambiar({ cantidad: e.target.value })} />}</FormField>
    <Button type="button" variant="outline" onClick={quitar} aria-label={`Quitar línea ${indice + 1}`}>Quitar línea</Button>
  </fieldset></Card>;
}
