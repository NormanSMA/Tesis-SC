"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect } from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MONEDAS } from "@/core/moneda";
import { nombreMoneda } from "../moneda";
import { esquemaCrearCotizacion, type EntradaCrearCotizacion } from "../schema";
import { enfocarError, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { FormField } from "@/components/comunes/FormField";
import { CampoArea, CampoSeleccion, CampoTexto } from "./CamposEditor";
import { SelectorCliente } from "./SelectorCliente";

type Propiedades = {
  clientes: { id: string; nombre: string }[]; condiciones: string; clienteId?: string;
  variante?: "pagina" | "drawer"; alGuardar?: (id: string, numero?: string) => void;
  alCancelar?: () => void; puedeCrearCliente?: boolean;
  /** Abre el alta rápida; recibe el texto buscado para prellenar el nombre. */
  alNuevoCliente?: (nombre?: string) => void;
};
type Formulario = UseFormReturn<EntradaCrearCotizacion>;

function CamposNuevaCotizacion({ formulario, propiedades, campos }: {
  formulario: Formulario; propiedades: Propiedades; campos: Record<string, string>;
}) {
  const moneda = useWatch({ control: formulario.control, name: "moneda" });
  return <>
    <Controller control={formulario.control} name="moneda" render={({ field }) =>
      <CampoSeleccion id="moneda" etiqueta="Moneda" valor={field.value ?? "NIO"} requerido error={campos.moneda}
        opciones={MONEDAS.map((id) => ({ id, nombre: nombreMoneda(id) }))} alCambiar={field.onChange} />} />
    {moneda === "USD" ? <p className="text-sm text-muted-foreground">El tipo de cambio se toma de la configuración al crear la cotización y queda congelado.</p> : null}
    <div className="flex items-end gap-3"><div className="min-w-0 flex-1">
      <Controller control={formulario.control} name="clienteId" render={({ field }) =>
        <FormField id="clienteId" etiqueta="Cliente" requerido error={campos.clienteId}>
          {(atributos) => <SelectorCliente atributos={atributos} valor={field.value} opciones={propiedades.clientes}
            alCambiar={field.onChange} alCrear={propiedades.puedeCrearCliente ? propiedades.alNuevoCliente : undefined} />}
        </FormField>} />
    </div>{propiedades.puedeCrearCliente && propiedades.alNuevoCliente ?
      <Button id="nuevo-cliente-cotizacion" type="button" variant="outline" onClick={() => propiedades.alNuevoCliente?.()}>Nuevo cliente</Button> : null}</div>
    <Controller control={formulario.control} name="asunto" render={({ field }) =>
      <CampoTexto id="asunto" etiqueta="Asunto" valor={field.value} requerido error={campos.asunto} alCambiar={field.onChange} />} />
    <Controller control={formulario.control} name="condiciones" render={({ field }) =>
      <CampoArea id="condiciones" etiqueta="Condiciones comerciales" valor={field.value ?? ""} error={campos.condiciones} alCambiar={field.onChange} />} />
  </>;
}

export function NuevaCotizacion(propiedades: Propiedades) {
  const { clientes, condiciones, clienteId = "", variante = "pagina", alGuardar, alCancelar } = propiedades;
  const formulario = useForm<EntradaCrearCotizacion>({
    resolver: zodResolver(esquemaCrearCotizacion), shouldFocusError: false,
    defaultValues: { clienteId, asunto: "", condiciones, moneda: "NIO" },
  });
  const { setValue } = formulario;
  useEffect(() => { setValue("clienteId", clienteId, { shouldValidate: false }); }, [clienteId, setValue]);
  const solicitud = useSolicitudCotizacion("nueva-cotizacion", alGuardar);
  const campos = { ...Object.fromEntries(Object.entries(formulario.formState.errors).map(([clave, error]) =>
    [clave, error.message ?? "Revise el campo."])), ...solicitud.campos };
  const guardar = formulario.handleSubmit(async (entrada) => {
    await solicitud.enviar({ url: "/api/v1/cotizaciones", metodo: "POST", cuerpo: entrada, destino: "editar" });
  }, () => enfocarError("nueva-cotizacion"));
  const contenido = <fieldset disabled={solicitud.enviando} className="space-y-5">
    <CamposNuevaCotizacion formulario={formulario} propiedades={propiedades} campos={campos} />
  </fieldset>;
  return <form id="nueva-cotizacion" onSubmit={guardar} noValidate aria-label="Nueva cotización"
    aria-busy={solicitud.enviando} className="max-w-3xl space-y-5">
    <AvisoGuardado {...solicitud} />
    {variante === "pagina" ? <Card className="px-5">{contenido}</Card> : contenido}
    {variante === "pagina" ? <div className="flex gap-3">
      <Button type="submit" disabled={solicitud.enviando || !clientes.length}>Crear cotización</Button>
      {alCancelar ? <Button type="button" variant="outline" onClick={alCancelar}>Cancelar</Button> :
        <Button asChild variant="outline"><Link href="/cotizaciones">Cancelar</Link></Button>}
    </div> : null}
    {!clientes.length ? <p role="status">Registre un cliente activo para crear una cotización.</p> : null}
  </form>;
}
