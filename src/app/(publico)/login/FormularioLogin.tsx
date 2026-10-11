"use client";

import { CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
            className="pr-12"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0"
            aria-label="Mostrar contraseña"
            aria-pressed={visible}
            onClick={() => setVisible((valor) => !valor)}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
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
    <form onSubmit={enviar} noValidate className="space-y-5" aria-label="Inicio de sesión">
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
          />
        )}
      </FormField>
      <CampoContrasena error={formState.errors.contrasena?.message} registro={register("contrasena")} />
      <Button type="submit" size="lg" className="w-full" aria-disabled={enviando}>
        {enviando ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
      <p role="status" className="sr-only">
        {enviando ? "Verificando credenciales" : ""}
      </p>
    </form>
  );
}
