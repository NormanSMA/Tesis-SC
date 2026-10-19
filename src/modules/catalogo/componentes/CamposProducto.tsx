"use client";

import { Controller } from "react-hook-form";

import { FormField } from "@/components/comunes/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { CategoriaDto } from "../tipos";
import type { FormularioProducto } from "../useFormularioProducto";
import { SelectorCatalogo } from "./SelectorCatalogo";

export function CamposIdentificacion({ formulario, categorias }: { formulario: FormularioProducto; categorias: CategoriaDto[] }) {
  const { register, control, formState: { errors } } = formulario;
  return <div className="grid gap-5 sm:grid-cols-2">
    <FormField id="codigo" etiqueta="Código" requerido error={errors.codigo?.message}>
      {(atributos) => <Input {...atributos} {...register("codigo")} maxLength={30} autoComplete="off" />}
    </FormField>
    <FormField id="nombre" etiqueta="Nombre del producto" requerido error={errors.nombre?.message}>
      {(atributos) => <Input {...atributos} {...register("nombre")} maxLength={160} />}
    </FormField>
    <FormField id="categoriaId" etiqueta="Categoría" requerido error={errors.categoriaId?.message} className="sm:col-span-2">
      {(atributos) => <Controller name="categoriaId" control={control} render={({ field }) =>
        <SelectorCatalogo {...atributos} valor={field.value} alCambiar={field.onChange}
          opciones={categorias.map((categoria) => ({ valor: categoria.id, etiqueta: categoria.nombre, categoria: categoria.nombre }))} />} />}
    </FormField>
    <FormField id="descripcion" etiqueta="Descripción" error={errors.descripcion?.message} className="sm:col-span-2">
      {(atributos) => <Textarea {...atributos} {...register("descripcion")} rows={3} />}
    </FormField>
  </div>;
}
export function CamposCobro({ formulario, puedeVerCosto }: { formulario: FormularioProducto; puedeVerCosto: boolean }) {
  const { register, control, formState: { errors } } = formulario;
  return <div className="grid gap-5 sm:grid-cols-2">
    <FormField id="unidadCobro" etiqueta="Unidad de cobro" requerido error={errors.unidadCobro?.message}>
      {(atributos) => <Controller name="unidadCobro" control={control} render={({ field }) =>
        <SelectorCatalogo {...atributos} valor={field.value} alCambiar={field.onChange} opciones={[
          { valor: "UNIDAD", etiqueta: "Unidad" }, { valor: "M2", etiqueta: "m²" },
        ]} />} />}
    </FormField>
    <FormField id="precioBase" etiqueta="Precio base (C$)" requerido ayuda="Precio por unidad de cobro. Use punto decimal." error={errors.precioBase?.message}>
      {(atributos) => <Input {...atributos} {...register("precioBase")} inputMode="decimal" />}
    </FormField>
    {puedeVerCosto ? <FormField id="costoUnitario" etiqueta="Costo de referencia (C$)" ayuda="Opcional, por unidad de cobro. Use punto y hasta 4 decimales." error={errors.costoUnitario?.message}>
      {(atributos) => <Input {...atributos} {...register("costoUnitario")} inputMode="decimal" />}
    </FormField> : null}
  </div>;
}
