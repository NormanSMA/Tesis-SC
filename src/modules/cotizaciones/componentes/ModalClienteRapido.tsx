"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { solicitarApi } from "@/lib/cliente-api";
import { esquemaCrearCliente, type EntradaCrearCliente } from "@/modules/clientes/schema";

type Valores = z.input<typeof esquemaCrearCliente>;
type Propiedades = {
  abierto: boolean; alCambiar: (abierto: boolean) => void;
  alGuardar: (cliente: { id: string; nombre: string }) => void;
  /** Texto bajo el título; cambia según desde dónde se abre (cotización o lista de clientes). */
  descripcion?: string;
  /** id del botón que recibe el foco al cerrar. */
  idRetorno?: string;
  /** Enlace al formulario completo de cliente (solo fuera del drawer de cotización). */
  enlaceCompleto?: string;
};
const esquemaCliente = z.object({ id: z.string(), nombre: z.string() });
const CAMPOS = [
  { nombre: "nombre", etiqueta: "Nombre", tipo: "text" },
  { nombre: "ruc", etiqueta: "RUC o cédula", tipo: "text" },
  { nombre: "correo", etiqueta: "Correo", tipo: "email" },
  { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel" },
] as const;

function useClienteRapido(alGuardar: Propiedades["alGuardar"]) {
  const formulario = useForm<Valores, unknown, EntradaCrearCliente>({
    resolver: zodResolver(esquemaCrearCliente),
    defaultValues: { nombre: "", tipo: "EMPRESA", ruc: "", correo: "", telefono: "" },
  });
  const guardar = formulario.handleSubmit(async (entrada) => {
    formulario.clearErrors();
    const resultado = await solicitarApi({ url: "/api/v1/clientes", metodo: "POST", cuerpo: entrada, esquema: esquemaCliente });
    if ("datos" in resultado) { alGuardar(resultado.datos); formulario.reset(); return; }
    formulario.setError("root", { message: resultado.error.mensaje });
    const campos = Object.entries(resultado.error.campos ?? {});
    for (const [nombre, message] of campos) {
      if (CAMPOS.some((campo) => campo.nombre === nombre)) formulario.setError(nombre as keyof Valores, { message });
    }
    const primero = CAMPOS.find((campo) => campos.some(([nombre]) => nombre === campo.nombre));
    if (primero) formulario.setFocus(primero.nombre);
  });
  return { formulario, guardar };
}

export function ModalClienteRapido({ abierto, alCambiar, alGuardar, descripcion = "Registre el cliente para esta cotización.",
  idRetorno = "nuevo-cliente-cotizacion", enlaceCompleto }: Propiedades) {
  const { formulario, guardar } = useClienteRapido(alGuardar);
  const { errors, isSubmitting } = formulario.formState;
  return <Dialog open={abierto} onOpenChange={(valor) => { if (!isSubmitting) alCambiar(valor); }}>
    <DialogContent className="sm:max-w-md" onCloseAutoFocus={(evento) => {
      evento.preventDefault(); document.getElementById(idRetorno)?.focus();
    }}>
      <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle>
        <DialogDescription>{descripcion}</DialogDescription></DialogHeader>
      <form onSubmit={guardar} noValidate className="space-y-4">
        {errors.root ? <p role="alert" className="text-sm text-destructive">{errors.root.message}</p> : null}
        <fieldset disabled={isSubmitting} className="space-y-4">
          {CAMPOS.map((campo) => <FormField key={campo.nombre} id={`cliente-rapido-${campo.nombre}`}
            etiqueta={campo.etiqueta} requerido={campo.nombre === "nombre"} error={errors[campo.nombre]?.message}>
            {(atributos) => <Input {...atributos} {...formulario.register(campo.nombre)} type={campo.tipo} />}
          </FormField>)}
        </fieldset>
        <DialogFooter className="sm:items-center">
          {enlaceCompleto ? <Link href={enlaceCompleto} className="mr-auto text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">¿Necesita más datos? Formulario completo</Link> : null}
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => alCambiar(false)}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>Guardar cliente</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
