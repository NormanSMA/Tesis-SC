"use client";

import { FormField } from "@/components/comunes/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Campo = { id: string; etiqueta: string; valor: string; alCambiar: (valor: string) => void;
  error?: string; ayuda?: string; requerido?: boolean; deshabilitado?: boolean };

export function CampoTexto({ decimal, ...campo }: Campo & { decimal?: boolean }) {
  return <FormField id={campo.id} etiqueta={campo.etiqueta} ayuda={campo.ayuda} error={campo.error} requerido={campo.requerido}>
    {(atributos) => <Input {...atributos} value={campo.valor} onChange={(evento) => campo.alCambiar(evento.target.value)}
      disabled={campo.deshabilitado} inputMode={decimal ? "decimal" : undefined} autoComplete="off" />}
  </FormField>;
}

export function CampoArea(campo: Campo) {
  return <FormField id={campo.id} etiqueta={campo.etiqueta} ayuda={campo.ayuda} error={campo.error} requerido={campo.requerido}>
    {(atributos) => <Textarea {...atributos} value={campo.valor} onChange={(evento) => campo.alCambiar(evento.target.value)}
      disabled={campo.deshabilitado} />}
  </FormField>;
}

export function CampoSeleccion({ opciones, ...campo }: Campo & { opciones: { id: string; nombre: string }[] }) {
  return <FormField id={campo.id} etiqueta={campo.etiqueta} ayuda={campo.ayuda} error={campo.error} requerido={campo.requerido}>
    {(atributos) => <Select value={campo.valor || undefined} onValueChange={campo.alCambiar} disabled={campo.deshabilitado}>
      <SelectTrigger {...atributos}><SelectValue placeholder="Seleccione una opción" /></SelectTrigger>
      <SelectContent>{opciones.map((opcion) => <SelectItem key={opcion.id} value={opcion.id}>{opcion.nombre}</SelectItem>)}</SelectContent>
    </Select>}
  </FormField>;
}
