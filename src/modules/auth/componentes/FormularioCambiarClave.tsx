"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { redirect, usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import { FormField } from "@/components/comunes/FormField";
import { Marca } from "@/components/layout/Marca";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { destinoPorPerfil, type PerfilCodigo } from "@/core/permisos";
import type { CamposError } from "@/lib/errores";
import { esquemaFormularioCambiarClave, type EntradaCambiarClave, type ValoresCambiarClave } from "@/modules/auth/schema";

type ErrorCambioClave = { codigo?: string; mensaje: string; campos?: CamposError };
type ResultadoCambioClave = { datos: { debeCambiarClave: false }; error?: never } | { datos?: never; error: ErrorCambioClave };

export async function solicitarCambioClave(entrada: EntradaCambiarClave): Promise<ResultadoCambioClave> {
  try {
    const respuesta = await fetch("/api/v1/auth/cambiar-clave", {
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claveActual: entrada.claveActual, claveNueva: entrada.claveNueva }),
    });
    const cuerpo = await respuesta.json().catch(() => ({})) as {
      datos?: { debeCambiarClave?: boolean }; error?: ErrorCambioClave;
    };
    if (respuesta.ok && cuerpo.datos?.debeCambiarClave === false) return { datos: { debeCambiarClave: false } };
    const error = cuerpo.error ?? { mensaje: "No se pudo cambiar la clave. Intente de nuevo." };
    if (error.codigo === "CREDENCIALES_INVALIDAS") {
      return { error: { ...error, campos: { ...error.campos, claveActual: "La clave actual es incorrecta." } } };
    }
    return { error };
  } catch {
    return { error: { mensaje: "No se pudo conectar con el servidor. Revise su conexión." } };
  }
}

export function CampoClave({ registro, etiqueta, error }: {
  registro: UseFormRegisterReturn; etiqueta: string; error?: string;
}) {
  const nueva = registro.name !== "claveActual";
  const idError = `${registro.name}-error`;
  return (
    <FormField id={registro.name} etiqueta={etiqueta} ayuda={nueva ? "Mínimo 14 caracteres." : undefined} requerido>
      {(atributos) => <>
        <Input {...atributos} {...registro} type="password" required maxLength={256}
          minLength={nueva ? 14 : undefined} autoComplete={nueva ? "new-password" : "current-password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={[atributos["aria-describedby"], error ? idError : undefined].filter(Boolean).join(" ") || undefined} />
        {error ? <p id={idError} role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      </>}
    </FormField>
  );
}

function useCambioClave(perfil: PerfilCodigo) {
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const formulario = useForm<ValoresCambiarClave>({
    resolver: zodResolver(esquemaFormularioCambiarClave),
    defaultValues: { claveActual: "", claveNueva: "", confirmacion: "" },
  });
  async function enviar(valores: ValoresCambiarClave) {
    setErrorGeneral(null);
    const resultado = await solicitarCambioClave(valores);
    if (resultado.error) {
      const campos = ["claveActual", "claveNueva", "confirmacion"] as const;
      let primerCampo: typeof campos[number] | undefined;
      for (const campo of campos) {
        const mensaje = resultado.error.campos?.[campo];
        if (mensaje) {
          formulario.setError(campo, { message: mensaje });
          primerCampo ??= campo;
        }
      }
      if (primerCampo) formulario.setFocus(primerCampo);
      setErrorGeneral(resultado.error.mensaje);
      return;
    }
    formulario.reset();
    // Recarga la sesión y descarta los layouts conservados con la clave pendiente.
    window.location.replace(destinoPorPerfil[perfil]);
  }
  return { formulario, errorGeneral, enviar: formulario.handleSubmit(enviar) };
}

export function FormularioCambiarClave({ perfil }: { perfil: PerfilCodigo }) {
  const { formulario, errorGeneral, enviar } = useCambioClave(perfil);
  const { register, formState: { errors, isSubmitting } } = formulario;
  return (
    <form method="post" onSubmit={enviar} noValidate className="space-y-5" aria-label="Cambiar clave" aria-busy={isSubmitting}>
      <Card className="p-5">
        {errorGeneral ? <p role="alert" className="rounded-md border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger">{errorGeneral}</p> : null}
        <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
          <legend className="sr-only">Claves</legend>
          <CampoClave registro={register("claveActual")} etiqueta="Clave actual" error={errors.claveActual?.message} />
          <CampoClave registro={register("claveNueva")} etiqueta="Clave nueva" error={errors.claveNueva?.message} />
          <CampoClave registro={register("confirmacion")} etiqueta="Confirmación de clave" error={errors.confirmacion?.message} />
          <Button type="submit" className="min-h-10 w-full">{isSubmitting ? "Cambiando clave…" : "Cambiar clave"}</Button>
        </fieldset>
        <p role="status" className="sr-only">{isSubmitting ? "Cambiando clave" : ""}</p>
      </Card>
    </form>
  );
}

function CerrarSesion() {
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cerrar() {
    if (cerrando) return;
    setCerrando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!respuesta.ok) throw new Error("logout");
      window.location.replace("/login");
    } catch {
      setError("No se pudo cerrar la sesión. Intente de nuevo.");
      setCerrando(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={cerrando} onClick={cerrar}>
        {cerrando ? "Cerrando sesión…" : "Cerrar sesión"}
      </Button>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function GuardiaCambioClave({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  if (ruta !== "/cambiar-clave") redirect("/cambiar-clave");
  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-card px-4 py-4 xl:px-6">
        <Marca />
        <CerrarSesion />
      </header>
      <main id="contenido" tabIndex={-1} className="px-4 py-6 outline-none xl:px-6">{children}</main>
    </div>
  );
}
