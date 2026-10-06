"use client";

import { CircleAlert, Plus, Trash2 } from "lucide-react";
import { Controller } from "react-hook-form";

import { FormField } from "@/components/comunes/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { FichaProducto, MaterialDto } from "../tipos";
import { useEditorReceta, type FormularioReceta } from "../useEditorReceta";
import { useHidratado } from "../useFormularioProducto";
import { SelectorCatalogo } from "./SelectorCatalogo";

function FilaReceta({ formulario, indice, materiales, quitar }: {
  formulario: FormularioReceta; indice: number; materiales: MaterialDto[]; quitar: () => void;
}) {
  const errores = formulario.formState.errors.materiales?.[indice];
  const elegido = formulario.watch(`materiales.${indice}.materialId`);
  const seleccionados = formulario.watch("materiales").map((fila) => fila.materialId);
  const opciones = materiales.filter((material) => material.id === elegido || (material.activo && !seleccionados.includes(material.id)))
    .map((material) => ({ valor: material.id, etiqueta: `${material.codigo} · ${material.nombre} (${material.unidad.toLowerCase()})${material.activo ? "" : " — archivado"}` }));
  return <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
    <FormField id={`material-${indice}`} etiqueta={`Material ${indice + 1}`} requerido error={errores?.materialId?.message}>
      {(atributos) => <Controller control={formulario.control} name={`materiales.${indice}.materialId`} render={({ field }) =>
        <SelectorCatalogo {...atributos} valor={field.value} alCambiar={field.onChange} opciones={opciones} />} />}
    </FormField>
    <FormField id={`cantidad-${indice}`} etiqueta="Cantidad" requerido error={errores?.cantidad?.message}>
      {(atributos) => <Input {...atributos} {...formulario.register(`materiales.${indice}.cantidad`)} inputMode="decimal" />}
    </FormField>
    <Button type="button" variant="outline" className="self-end mb-2" onClick={quitar} aria-label={`Quitar material ${indice + 1}`}><Trash2 aria-hidden="true" /></Button>
  </div>;
}
export function EditorReceta({ producto, materiales, puedeVerMateriales }: { producto: FichaProducto; materiales: MaterialDto[]; puedeVerMateriales: boolean }) {
  const { formulario, filas, enviando, error, conflicto, enviar, recargar } = useEditorReceta(producto);
  const hidratado = useHidratado();
  const disponibles = [...materiales, ...producto.receta.map((fila) => fila.material).filter((material) => !materiales.some((otro) => otro.id === material.id))];
  return <form noValidate onSubmit={enviar} aria-label="Editar receta" className="max-w-3xl">
    <Card><CardHeader><CardTitle><h2>Receta de materiales</h2></CardTitle>
      <CardDescription>Cantidades por {producto.unidadCobro === "M2" ? "m²" : "unidad"} de cobro. Guarde la receta por separado.</CardDescription>
    </CardHeader><CardContent className="flex flex-col gap-4">
      {error ? <Alert variant="destructive"><CircleAlert aria-hidden="true" /><AlertTitle>No se pudo guardar la receta</AlertTitle>
        <AlertDescription>{error}{conflicto ? <Button type="button" variant="outline" onClick={recargar}>Recargar datos</Button> : null}</AlertDescription>
      </Alert> : null}
      {!puedeVerMateriales ? <p>Necesita inventario:ver para consultar materiales nuevos.</p> : null}
      <fieldset disabled={!hidratado || enviando} className="flex min-w-0 flex-col gap-4">
        {filas.fields.map((fila, indice) => <FilaReceta key={fila.id} formulario={formulario} indice={indice} materiales={disponibles} quitar={() => filas.remove(indice)} />)}
        {!filas.fields.length ? <p className="text-sm text-muted-foreground">Sin materiales. La receta es opcional.</p> : null}
        <div className="flex flex-wrap gap-3">
          {puedeVerMateriales ? <Button type="button" variant="outline" onClick={() => filas.append({ materialId: "", cantidad: "1" })}><Plus aria-hidden="true" />Agregar material</Button> : null}
          <Button type="submit">Guardar receta</Button>
        </div>
      </fieldset>
    </CardContent></Card>
  </form>;
}
