"use client";

import { FormField } from "@/components/comunes/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ValoresLibro } from "./tipos-libro";

export function CamposLibro({ tipo, valores, errores, cambiar }: { tipo: "entrada" | "ajuste"; valores: ValoresLibro;
  errores: Record<string, string>; cambiar: (campo: keyof ValoresLibro, valor: string) => void }) {
  if (tipo === "entrada") return <>
    <FormField id="costoUnitario" etiqueta="Costo unitario (C$)" requerido error={errores.costoUnitario}>{(atributos) =>
      <Input {...atributos} inputMode="decimal" value={valores.costoUnitario} onChange={(e) => cambiar("costoUnitario", e.target.value)} />}</FormField>
    <FormField id="referencia" etiqueta="Referencia" error={errores.referencia} ayuda="Factura o guía. Admite hasta 60 caracteres.">{(atributos) =>
      <Input {...atributos} maxLength={60} value={valores.referencia} onChange={(e) => cambiar("referencia", e.target.value)} />}</FormField>
  </>;
  return <>
    <FormField id="direccion" etiqueta="Dirección" requerido error={errores.direccion}>{(atributos) =>
      <select {...atributos} className="h-11 w-full rounded-md border border-input bg-background px-3" value={valores.direccion} onChange={(e) => cambiar("direccion", e.target.value)}>
        <option value="AUMENTAR">Aumentar existencia</option><option value="DISMINUIR">Disminuir existencia</option></select>}</FormField>
    <FormField id="motivo" etiqueta="Motivo" requerido error={errores.motivo} ayuda="Indique al menos 5 caracteres.">{(atributos) =>
      <Textarea {...atributos} className="min-h-24 border-input bg-background p-3" maxLength={10000}
        value={valores.motivo} onChange={(e) => cambiar("motivo", e.target.value)} />}</FormField>
  </>;
}
