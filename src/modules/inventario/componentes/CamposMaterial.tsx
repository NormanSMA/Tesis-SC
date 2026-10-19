"use client";

import { FormField } from "@/components/comunes/FormField";
import { SeccionFormulario } from "@/components/comunes/SeccionFormulario";
import { ETIQUETA_UNIDAD, etiquetar } from "../etiquetas";
import { Input } from "@/components/ui/input";
import { UNIDADES } from "../schema";

export type ValoresMaterial = { codigo: string; nombre: string; descripcion: string; unidad: string; stockMinimo: string; costoPromedio: string };
type Propiedades = { valores: ValoresMaterial; errores: Record<string, string>; editar: boolean; conExistencia: boolean;
  cambiar: (campo: keyof ValoresMaterial, valor: string) => void };
export function CamposMaterial({ valores, errores, editar, conExistencia, cambiar }: Propiedades) {
  return <><SeccionFormulario titulo="Identificación"><div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <FormField id="codigo" etiqueta="Código" requerido error={errores.codigo}>{(atributos) =>
      <Input {...atributos} value={valores.codigo} maxLength={30} disabled={editar} onChange={(e) => cambiar("codigo", e.target.value)} />}</FormField>
    <FormField id="nombre" etiqueta="Nombre" requerido error={errores.nombre}>{(atributos) =>
      <Input {...atributos} value={valores.nombre} maxLength={160} onChange={(e) => cambiar("nombre", e.target.value)} />}</FormField>
    <FormField id="unidad" etiqueta="Unidad" requerido error={errores.unidad} ayuda="La unidad permanece fija después del alta.">{(atributos) =>
      <select {...atributos} className="h-11 w-full rounded-md border border-input bg-background px-3" value={valores.unidad} disabled={editar}
        onChange={(e) => cambiar("unidad", e.target.value)}>{UNIDADES.map((unidad) => <option key={unidad} value={unidad}>{etiquetar(ETIQUETA_UNIDAD, unidad)}</option>)}</select>}</FormField>
  </div></SeccionFormulario>
  <SeccionFormulario titulo="Existencias y costo"><div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <FormField id="stockMinimo" etiqueta="Stock mínimo" requerido error={errores.stockMinimo}>{(atributos) =>
      <Input {...atributos} inputMode="decimal" value={valores.stockMinimo} onChange={(e) => cambiar("stockMinimo", e.target.value)} />}</FormField>
    <FormField id="costoPromedio" etiqueta="Costo promedio (C$)" requerido error={errores.costoPromedio}
      ayuda={conExistencia ? "El costo cambia mediante entradas mientras hay existencia." : "Precio de referencia. Admite hasta 4 decimales."}>{(atributos) =>
      <Input {...atributos} inputMode="decimal" value={valores.costoPromedio} disabled={conExistencia}
        onChange={(e) => cambiar("costoPromedio", e.target.value)} />}</FormField>
    <FormField id="descripcion" etiqueta="Descripción" error={errores.descripcion} className="sm:col-span-2">{(atributos) =>
      <textarea {...atributos} className="min-h-24 w-full rounded-md border border-input bg-background p-3" maxLength={10000}
        value={valores.descripcion} onChange={(e) => cambiar("descripcion", e.target.value)} />}</FormField>
  </div></SeccionFormulario></>;
}
