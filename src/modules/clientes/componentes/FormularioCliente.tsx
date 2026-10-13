"use client";

import { CircleAlert, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject, type SubmitEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { useFormularioCliente, type ModoFormulario } from "../useFormularioCliente";
import { useHidratado } from "../useHidratado";
import { CamposAdicionales, CamposContacto, CamposIdentificacion } from "./CamposCliente";

function SeccionFormulario({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <Card role="group" aria-labelledby={id}>
      <div className="space-y-5 px-5">
        <h2 id={id} className="text-base font-semibold text-foreground">
          {titulo}
        </h2>
        {children}
      </div>
    </Card>
  );
}

function AvisoConflicto({ alRecargar }: { alRecargar: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>Otra persona modificó este cliente</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Mientras usted editaba, alguien guardó cambios. Recargue los datos para ver la versión vigente y vuelva a
          intentar. Los cambios que no guardó se perderán.
        </p>
        <Button type="button" variant="outline" onClick={alRecargar}>
          <RefreshCw aria-hidden="true" />
          Recargar datos
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function AvisoError({ mensaje }: { mensaje: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudo guardar</AlertTitle>
      <AlertDescription>{mensaje}</AlertDescription>
    </Alert>
  );
}

type ErroresCliente = ReturnType<typeof useFormularioCliente>["formulario"]["formState"]["errors"];

export function atributosErrorCliente({ descripcion, idError, invalido }: {
  descripcion: string | null; idError: string; invalido: boolean;
}) {
  const ids = (descripcion ?? "").split(/\s+/).filter((id) => id && id !== idError);
  if (invalido) ids.push(idError);
  return { "aria-invalid": String(invalido), "aria-describedby": ids.join(" ") || undefined };
}

function useErroresCliente(referencia: RefObject<HTMLFormElement | null>, errores: ErroresCliente, prefijoError: string) {
  useLayoutEffect(() => {
    const campos = referencia.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input[name], textarea[name], select[name]",
    );
    campos?.forEach((campo) => {
      const nombre = campo.name as keyof typeof errores;
      const idError = `${prefijoError}-${nombre}-error`;
      const atributos = atributosErrorCliente({ descripcion: campo.getAttribute("aria-describedby"), idError,
        invalido: Boolean(errores[nombre]) });
      Object.entries(atributos).forEach(([atributo, valor]) => {
        if (valor === undefined) campo.removeAttribute(atributo);
        else campo.setAttribute(atributo, valor);
      });
    });
  }, [errores, prefijoError, referencia]);
}

export function enfocarResultadoCliente(elemento: HTMLFormElement | null) {
  if (!elemento?.isConnected) return;
  const campo = elemento.querySelector<HTMLElement>('[aria-invalid="true"]:not([type="hidden"])');
  const mensaje = elemento.querySelector<HTMLElement>('[role="alert"], [role="status"]');
  if (campo) campo.focus();
  else if (mensaje) {
    mensaje.tabIndex = -1;
    mensaje.focus();
  } else elemento.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
}

function useResultadoCliente(resultado: ReturnType<typeof useFormularioCliente>) {
  const referencia = useRef<HTMLFormElement>(null);
  const prefijoError = useId();
  const errores = resultado.formulario.formState.errors;
  useErroresCliente(referencia, errores, prefijoError);
  async function enviarConFoco(evento: SubmitEvent<HTMLFormElement>) {
    await resultado.enviar(evento);
    requestAnimationFrame(() => {
      enfocarResultadoCliente(referencia.current);
    });
  }
  return { referencia, prefijoError, errores, enviarConFoco };
}

export function FormularioCliente(propiedades: ModoFormulario) {
  const resultado = useFormularioCliente(propiedades);
  const { formulario, enviando, errorGeneral, conflicto, recargar } = resultado;
  const { referencia, prefijoError, errores, enviarConFoco } = useResultadoCliente(resultado);
  const hidratado = useHidratado();
  const editando = propiedades.modo === "editar";
  const cancelar = editando ? `/clientes/${propiedades.cliente.id}` : "/clientes";
  return (
    <form
      ref={referencia}
      onSubmit={enviarConFoco}
      noValidate
      aria-label={editando ? "Editar cliente" : "Nuevo cliente"}
      className="max-w-3xl space-y-5"
    >
      {conflicto ? <AvisoConflicto alRecargar={recargar} /> : null}
      {errorGeneral ? <AvisoError mensaje={errorGeneral} /> : null}
      {Object.entries(errores).map(([nombre, error]) => <span key={nombre}
        id={`${prefijoError}-${nombre}-error`} hidden>{error?.message}</span>)}
      <fieldset disabled={!hidratado} className="min-w-0 space-y-5">
        <SeccionFormulario id="seccion-identificacion" titulo="Identificación">
          <CamposIdentificacion formulario={formulario} />
        </SeccionFormulario>
        <SeccionFormulario id="seccion-contacto" titulo="Contacto">
          <CamposContacto formulario={formulario} />
        </SeccionFormulario>
        <SeccionFormulario id="seccion-adicional" titulo="Información adicional">
          <CamposAdicionales formulario={formulario} />
        </SeccionFormulario>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" aria-disabled={enviando}>
            {enviando ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {editando ? "Guardar cambios" : "Guardar cliente"}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={cancelar}>Cancelar</Link>
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
