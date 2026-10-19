"use client";

import { FormField } from "@/components/comunes/FormField";
import { OPCIONES_PARA_BUSCAR, SelectorBuscable } from "@/components/comunes/SelectorBuscable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Campo = { id: string; etiqueta: string; valor: string; alCambiar: (valor: string) => void;
  error?: string; requerido?: boolean; deshabilitado?: boolean };
const estiloSeleccion = "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";

export function SeleccionProduccion({ opciones, vacio = "Seleccione", ...campo }: Campo & {
  opciones: { id: string; nombre: string }[]; vacio?: string;
}) {
  return <FormField id={campo.id} etiqueta={campo.etiqueta} error={campo.error} requerido={campo.requerido}>
    {(atributos) => opciones.length >= OPCIONES_PARA_BUSCAR
      // Listas largas de datos (áreas, responsables): se escribe para filtrar además de desplegar.
      ? <SelectorBuscable id={atributos.id} atributos={atributos} valor={campo.valor} alCambiar={campo.alCambiar}
        deshabilitado={campo.deshabilitado} marcador={`Buscar ${campo.etiqueta.toLowerCase()}`} vacio={vacio}
        opciones={campo.requerido ? opciones : [{ id: "", nombre: vacio }, ...opciones]} />
      : <select {...atributos} value={campo.valor} required={campo.requerido}
      disabled={campo.deshabilitado} className={estiloSeleccion} onChange={(evento) => campo.alCambiar(evento.target.value)}>
      <option value="">{vacio}</option>{opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
    </select>}
  </FormField>;
}

export function TextoProduccion({ tipo = "text", maximo, minimo, ...campo }: Campo & {
  tipo?: "text" | "date" | "number"; maximo?: number; minimo?: number;
}) {
  return <FormField id={campo.id} etiqueta={campo.etiqueta} error={campo.error} requerido={campo.requerido}>
    {(atributos) => <Input {...atributos} type={tipo} value={campo.valor} required={campo.requerido}
      maxLength={maximo} min={minimo} disabled={campo.deshabilitado} onChange={(evento) => campo.alCambiar(evento.target.value)} />}
  </FormField>;
}

export function MotivoProduccion(campo: Campo) {
  return <FormField id={campo.id} etiqueta="Motivo" error={campo.error} requerido ayuda="Escriba al menos 5 caracteres.">
    {(atributos) => <Textarea {...atributos} value={campo.valor} required minLength={5}
      disabled={campo.deshabilitado} onChange={(evento) => campo.alCambiar(evento.target.value)} />}
  </FormField>;
}

export function AvisoProduccion({ error, conflicto, recargar }: {
  error: string | null; conflicto: boolean; recargar: () => void;
}) {
  return <div>{error ? <div role="alert" className="space-y-2 rounded-md border border-danger p-3 text-sm text-danger">
    <p>{error}</p>{conflicto ? <><p>Recargue los datos para consultar los cambios recientes.</p>
      <Button type="button" variant="outline" onClick={recargar}>Recargar datos</Button></> : null}
  </div> : null}</div>;
}
