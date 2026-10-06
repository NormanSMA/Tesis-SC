"use client";

import { FormField } from "@/components/comunes/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { ETIQUETA_TIPO, TIPOS_CLIENTE } from "../schema";
import type { FormularioCliente } from "../useFormularioCliente";
import { SelectNativo } from "./SelectNativo";

type PropiedadesCampos = { formulario: FormularioCliente };

export function CamposIdentificacion({ formulario }: PropiedadesCampos) {
  const { register, formState } = formulario;
  const { errors } = formState;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <FormField id="nombre" etiqueta="Nombre" error={errors.nombre?.message} requerido className="md:col-span-2">
        {(atributos) => <Input {...atributos} {...register("nombre")} autoComplete="off" />}
      </FormField>
      <FormField id="tipo" etiqueta="Tipo de cliente" error={errors.tipo?.message} requerido>
        {(atributos) => (
          <SelectNativo {...atributos} {...register("tipo")}>
            {TIPOS_CLIENTE.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETA_TIPO[tipo]}
              </option>
            ))}
          </SelectNativo>
        )}
      </FormField>
      <FormField id="ruc" etiqueta="RUC" ayuda="Opcional. Se guarda en mayúsculas y sin espacios." error={errors.ruc?.message}>
        {(atributos) => <Input {...atributos} {...register("ruc")} autoComplete="off" autoCapitalize="characters" />}
      </FormField>
    </div>
  );
}

export function CamposContacto({ formulario }: PropiedadesCampos) {
  const { register, formState } = formulario;
  const { errors } = formState;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <FormField
        id="contactoPrincipal"
        etiqueta="Contacto principal"
        ayuda="Persona con quien se trata."
        error={errors.contactoPrincipal?.message}
        className="md:col-span-2"
      >
        {(atributos) => <Input {...atributos} {...register("contactoPrincipal")} autoComplete="off" />}
      </FormField>
      <FormField
        id="telefono"
        etiqueta="Teléfono"
        ayuda="Obligatorio si no indica un correo."
        error={errors.telefono?.message}
      >
        {(atributos) => <Input {...atributos} {...register("telefono")} type="tel" autoComplete="off" inputMode="tel" />}
      </FormField>
      <FormField
        id="correo"
        etiqueta="Correo electrónico"
        ayuda="Obligatorio si no indica un teléfono."
        error={errors.correo?.message}
      >
        {(atributos) => (
          <Input
            {...atributos}
            {...register("correo")}
            type="email"
            autoComplete="off"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </FormField>
    </div>
  );
}

export function CamposAdicionales({ formulario }: PropiedadesCampos) {
  const { register, formState } = formulario;
  const { errors } = formState;
  return (
    <div className="grid gap-5">
      <FormField id="direccion" etiqueta="Dirección" error={errors.direccion?.message}>
        {(atributos) => <Textarea {...atributos} {...register("direccion")} rows={2} />}
      </FormField>
      <FormField id="notas" etiqueta="Notas" error={errors.notas?.message}>
        {(atributos) => <Textarea {...atributos} {...register("notas")} rows={3} />}
      </FormField>
    </div>
  );
}
