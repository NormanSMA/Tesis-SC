"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { enviarApi } from "../api";
import type { ProductoDto } from "../tipos";

export function AccionesEstado({ producto }: { producto: ProductoDto }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const accion = producto.activo ? "Archivar" : "Reactivar";
  async function confirmar() {
    if (cargando) return;
    setCargando(true);
    const respuesta = await enviarApi(`/api/v1/productos/${producto.id}/${producto.activo ? "archivar" : "reactivar"}`, "POST", { version: producto.actualizadoEn });
    if ("error" in respuesta) toast.error(respuesta.error.mensaje);
    else toast.success(producto.activo ? "Producto archivado." : "Producto reactivado.");
    setCargando(false);
    setAbierto(false);
    router.refresh();
  }
  return <>
    <Button variant="outline" onClick={() => setAbierto(true)}>
      {producto.activo ? <Archive aria-hidden="true" /> : <ArchiveRestore aria-hidden="true" />}{accion}
    </Button>
    <ConfirmDialog abierto={abierto} alCambiarAbierto={setAbierto} titulo={`${accion} producto`}
      descripcion={producto.activo ? `«${producto.nombre}» conserva sus cotizaciones existentes y dejará de ofrecerse en cotizaciones nuevas.` : `«${producto.nombre}» volverá a ofrecerse en cotizaciones nuevas.`}
      etiquetaConfirmar={accion} tono={producto.activo ? "peligro" : "normal"} cargando={cargando} alConfirmar={confirmar} />
  </>;
}
