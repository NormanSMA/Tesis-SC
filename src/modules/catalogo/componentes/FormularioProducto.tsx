"use client";

import Link from "next/link";
import { CircleAlert, Loader2 } from "lucide-react";

import { CuerpoFormulario, PieFormulario, SeccionFormulario } from "@/components/comunes/SeccionFormulario";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { CategoriaDto, ProductoDto } from "../tipos";
import { useFormularioProducto, useHidratado } from "../useFormularioProducto";
import { CamposCobro, CamposIdentificacion } from "./CamposProducto";

export function FormularioProducto({ producto, categorias, puedeVerCosto }: { producto?: ProductoDto; categorias: CategoriaDto[]; puedeVerCosto: boolean }) {
  const { formulario, enviar, enviando, error, conflicto, recargar } = useFormularioProducto(producto);
  const hidratado = useHidratado();
  return <form noValidate onSubmit={enviar} aria-label={producto ? "Editar producto" : "Nuevo producto"}>
    <CuerpoFormulario>
      {error ? <Alert variant="destructive"><CircleAlert aria-hidden="true" />
        <AlertTitle>{conflicto ? "Otra persona modificó este producto" : "No se pudo guardar"}</AlertTitle>
        <AlertDescription>{error}{conflicto ? <Button type="button" variant="outline" onClick={recargar}>Recargar datos</Button> : null}</AlertDescription>
      </Alert> : null}
      <fieldset disabled={!hidratado || enviando} className="min-w-0 space-y-8">
        <SeccionFormulario titulo="Datos del producto" descripcion="Código, nombre, categoría y descripción.">
          <CamposIdentificacion formulario={formulario} categorias={categorias} />
        </SeccionFormulario>
        <SeccionFormulario titulo="Precio y unidad" descripcion="Unidad de cobro y precio base.">
          <CamposCobro formulario={formulario} puedeVerCosto={puedeVerCosto} />
        </SeccionFormulario>
        <PieFormulario>
          <Button asChild variant="outline"><Link href={producto ? `/catalogo/${producto.id}` : "/catalogo"}>Cancelar</Link></Button>
          <Button type="submit">{enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}{producto ? "Guardar cambios" : "Guardar producto"}</Button>
        </PieFormulario>
      </fieldset>
    </CuerpoFormulario>
  </form>;
}
