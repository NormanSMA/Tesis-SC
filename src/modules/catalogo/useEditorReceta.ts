"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { enviarApi } from "./api";
import { esquemaReceta, type EntradaReceta } from "./schema";
import type { FichaProducto } from "./tipos";

export type ValoresReceta = z.input<typeof esquemaReceta>;
export type FormularioReceta = UseFormReturn<ValoresReceta, unknown, EntradaReceta>;

export function useEditorReceta(producto: FichaProducto) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);
  const formulario: FormularioReceta = useForm<ValoresReceta, unknown, EntradaReceta>({
    resolver: zodResolver(esquemaReceta), defaultValues: {
      version: producto.actualizadoEn,
      materiales: producto.receta.map((fila) => ({ materialId: fila.materialId, cantidad: fila.cantidad })),
    },
  });
  const filas = useFieldArray({ control: formulario.control, name: "materiales" });
  async function guardar(valores: EntradaReceta) {
    if (enviando) return;
    setEnviando(true); setError(null); setConflicto(false);
    const respuesta = await enviarApi<FichaProducto>(`/api/v1/productos/${producto.id}/receta`, "PUT", valores);
    if ("datos" in respuesta) {
      formulario.reset({
        version: respuesta.datos.actualizadoEn,
        materiales: respuesta.datos.receta.map((fila) => ({ materialId: fila.materialId, cantidad: fila.cantidad })),
      });
      toast.success("Receta guardada."); router.refresh();
    } else {
      setError(respuesta.error.mensaje);
      setConflicto(respuesta.error.codigo === "CONFLICTO_EDICION");
      for (const [campo, mensaje] of Object.entries(respuesta.error.campos ?? {})) {
        formulario.setError(campo as `materiales.${number}.materialId`, { message: mensaje });
      }
    }
    setEnviando(false);
  }
  return { formulario, filas, enviando, error, conflicto, enviar: formulario.handleSubmit(guardar), recargar: () => router.refresh() };
}
