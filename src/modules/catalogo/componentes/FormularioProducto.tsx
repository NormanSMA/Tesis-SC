"use client";

import Link from "next/link";
import { CircleAlert, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CategoriaDto, ProductoDto } from "../tipos";
import { useFormularioProducto, useHidratado } from "../useFormularioProducto";
import { CamposCobro, CamposIdentificacion } from "./CamposProducto";

export function FormularioProducto({ producto, categorias }: { producto?: ProductoDto; categorias: CategoriaDto[] }) {
  const { formulario, enviar, enviando, error, conflicto, recargar } = useFormularioProducto(producto);
  const hidratado = useHidratado();
  return <form noValidate onSubmit={enviar} aria-label={producto ? "Editar producto" : "Nuevo producto"} className="flex max-w-3xl flex-col gap-5">
    {error ? <Alert variant="destructive"><CircleAlert aria-hidden="true" />
      <AlertTitle>{conflicto ? "Otra persona modificó este producto" : "No se pudo guardar"}</AlertTitle>
      <AlertDescription>{error}{conflicto ? <Button type="button" variant="outline" onClick={recargar}>Recargar datos</Button> : null}</AlertDescription>
    </Alert> : null}
    <fieldset disabled={!hidratado || enviando} className="flex min-w-0 flex-col gap-5">
      <Card><CardHeader><CardTitle><h2>Identificación</h2></CardTitle></CardHeader>
        <CardContent><CamposIdentificacion formulario={formulario} /></CardContent>
      </Card>
      <Card><CardHeader><CardTitle><h2>Categoría y cobro</h2></CardTitle></CardHeader>
        <CardContent><CamposCobro formulario={formulario} categorias={categorias} /></CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">{enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}{producto ? "Guardar cambios" : "Guardar producto"}</Button>
        <Button asChild variant="outline"><Link href={producto ? `/catalogo/${producto.id}` : "/catalogo"}>Cancelar</Link></Button>
      </div>
    </fieldset>
  </form>;
}
