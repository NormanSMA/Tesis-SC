"use client";

import { CircleAlert, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

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

export function FormularioCliente(propiedades: ModoFormulario) {
  const { formulario, enviar, enviando, errorGeneral, conflicto, recargar } = useFormularioCliente(propiedades);
  const hidratado = useHidratado();
  const editando = propiedades.modo === "editar";
  const cancelar = editando ? `/clientes/${propiedades.cliente.id}` : "/clientes";
  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label={editando ? "Editar cliente" : "Nuevo cliente"}
      className="max-w-3xl space-y-5"
    >
      {conflicto ? <AvisoConflicto alRecargar={recargar} /> : null}
      {errorGeneral ? <AvisoError mensaje={errorGeneral} /> : null}
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
