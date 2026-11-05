"use client";

import { CircleAlert, Loader2 } from "lucide-react";
import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BotonVerClave } from "@/modules/auth/componentes/BotonVerClave";

import { useFormularioLogin } from "./useFormularioLogin";

function CampoContrasena({ error, registro }: { error?: string; registro: UseFormRegisterReturn }) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField id="contrasena" etiqueta="Contraseña" error={error} requerido>
      {(atributos) => (
        <div className="relative">
          <Input
            {...atributos}
            {...registro}
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            className="rounded-lg pr-12"
          />
          <BotonVerClave etiqueta="contraseña" visible={visible} alternar={() => setVisible((valor) => !valor)} />
        </div>
      )}
    </FormField>
  );
}

function AlertaLogin({ mensaje }: { mensaje: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="font-medium">{mensaje}</p>
    </div>
  );
}

export function FormularioLogin() {
  const { formulario, enviando, errorGeneral, enviar } = useFormularioLogin();
  const { register, formState } = formulario;
  return (
    <form method="post" onSubmit={enviar} noValidate className="space-y-5" aria-label="Inicio de sesión">
      {errorGeneral ? <AlertaLogin mensaje={errorGeneral} /> : null}
      <FormField id="correo" etiqueta="Correo electrónico" error={formState.errors.correo?.message} requerido>
        {(atributos) => (
          <Input
            {...atributos}
            {...register("correo")}
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            className="rounded-lg"
          />
        )}
      </FormField>
      <CampoContrasena error={formState.errors.contrasena?.message} registro={register("contrasena")} />
      <Button type="submit" size="lg" className="w-full rounded-xl" aria-disabled={enviando}>
        {enviando ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
      <p role="status" className="sr-only">
        {enviando ? "Verificando credenciales" : ""}
      </p>
    </form>
  );
}
