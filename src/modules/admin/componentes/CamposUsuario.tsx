"use client";

import type { UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERFILES } from "@/core/permisos";
import type { EntradaCrearUsuario } from "@/modules/admin/schema";

export function CamposUsuario({ formulario }: { formulario: UseFormReturn<EntradaCrearUsuario> }) {
  const errores = formulario.formState.errors;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="usuario-nombre">Nombre</Label>
        <Input id="usuario-nombre" className="min-h-10" autoComplete="name" maxLength={120} required
          {...formulario.register("nombre")} aria-invalid={Boolean(errores.nombre)}
          aria-describedby={errores.nombre ? "usuario-nombre-error" : undefined} />
        {errores.nombre ? <p id="usuario-nombre-error" role="alert" className="text-sm text-destructive">{errores.nombre.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="usuario-correo">Correo</Label>
        <Input id="usuario-correo" className="min-h-10" type="email" autoComplete="email" maxLength={254} required
          {...formulario.register("correo")} aria-invalid={Boolean(errores.correo)}
          aria-describedby={errores.correo ? "usuario-correo-error" : undefined} />
        {errores.correo ? <p id="usuario-correo-error" role="alert" className="text-sm text-destructive">{errores.correo.message}</p> : null}
      </div>
    </div>
  );
}

export function PerfilesUsuario({ formulario }: { formulario: UseFormReturn<EntradaCrearUsuario> }) {
  const seleccionados = formulario.watch("perfiles");
  const error = formulario.formState.errors.perfiles;
  const registro = formulario.register("perfiles");
  return (
    <fieldset className="min-w-0 space-y-3" aria-describedby={error ? "perfiles-ayuda perfiles-error" : "perfiles-ayuda"}>
      <legend className="font-medium">Perfiles</legend>
      <p id="perfiles-ayuda" className="text-sm text-muted-foreground">Asigne al menos un perfil.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PERFILES.map(({ codigo, nombre, descripcion }, indice) => (
          <div key={codigo} className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox id={`perfil-${codigo}`} className="size-10" checked={seleccionados.includes(codigo)}
              ref={indice === 0 ? registro.ref : undefined} aria-invalid={Boolean(error)}
              aria-describedby={error ? "perfiles-error" : undefined}
              onCheckedChange={(marcado) => formulario.setValue("perfiles", marcado === true
                ? [...seleccionados, codigo] : seleccionados.filter((perfil) => perfil !== codigo), { shouldValidate: true, shouldDirty: true })} />
            <Label htmlFor={`perfil-${codigo}`} className="min-h-10 flex-1 cursor-pointer flex-col items-start gap-1 leading-5">
              <span>{nombre}</span><span className="font-normal text-muted-foreground">{descripcion}</span>
            </Label>
          </div>
        ))}
      </div>
      {error ? <p id="perfiles-error" role="alert" className="text-sm text-destructive">{error.message}</p> : null}
    </fieldset>
  );
}
