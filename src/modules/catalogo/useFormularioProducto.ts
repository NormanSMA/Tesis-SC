"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { enviarApi } from "./api";
import { esquemaCrearProducto, type EntradaCrearProducto } from "./schema";
import type { ProductoDto } from "./tipos";

export type ValoresProducto = z.input<typeof esquemaCrearProducto>;
export type FormularioProducto = UseFormReturn<ValoresProducto, unknown, EntradaCrearProducto>;
const sinSuscripcion = () => () => {};
export function useHidratado() { return useSyncExternalStore(sinSuscripcion, () => true, () => false); }

function valoresIniciales(producto?: ProductoDto): ValoresProducto {
  return { codigo: producto?.codigo ?? "", nombre: producto?.nombre ?? "", descripcion: producto?.descripcion ?? "",
    categoriaId: producto?.categoriaId ?? "", unidadCobro: producto?.unidadCobro ?? "UNIDAD", precioBase: producto?.precioBase ?? "" };
}
export function useFormularioProducto(producto?: ProductoDto) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);
  const formulario: FormularioProducto = useForm<ValoresProducto, unknown, EntradaCrearProducto>({
    resolver: zodResolver(esquemaCrearProducto), defaultValues: valoresIniciales(producto),
  });
  async function guardar(valores: EntradaCrearProducto) {
    if (enviando) return;
    setEnviando(true); setError(null); setConflicto(false);
    const respuesta = await enviarApi<ProductoDto>(producto ? `/api/v1/productos/${producto.id}` : "/api/v1/productos",
      producto ? "PATCH" : "POST", producto ? { ...valores, version: producto.actualizadoEn } : valores);
    if ("datos" in respuesta) {
      toast.success(producto ? "Cambios guardados." : "Producto creado.");
      router.push(`/catalogo/${respuesta.datos.id}`); router.refresh();
      return;
    }
    const fallo = respuesta.error;
    setConflicto(fallo.codigo === "CONFLICTO_EDICION");
    setError(fallo.mensaje);
    const campos = Object.keys(fallo.campos ?? {}) as (keyof ValoresProducto)[];
    for (const campo of campos) formulario.setError(campo, { message: fallo.campos?.[campo] });
    if (campos.length) formulario.setFocus(campos[0]);
    setEnviando(false);
  }
  return { formulario, enviando, error, conflicto, enviar: formulario.handleSubmit(guardar), recargar: () => router.refresh() };
}
