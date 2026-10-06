"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { CamposError } from "@/lib/errores";
import { enfocarError } from "@/modules/cotizaciones/useSolicitudCotizacion";

type Peticion = { url: string; metodo?: "POST" | "PATCH"; cuerpo: object; libro?: boolean; destino?: string };
type ErrorSolicitud = { codigo?: string; mensaje?: string; campos?: CamposError };
export function useSolicitudInventario(idFormulario: string) {
  const router = useRouter();
  const bloqueo = useRef(false);
  const clave = useRef<{ cuerpo: string; uuid: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorSolicitud | null>(null);
  const [exito, setExito] = useState(false);
  const [existencias, setExistencias] = useState<Record<string, string>>({});
  function cambiarContenido() { clave.current = null; setExito(false); setError(null); }
  async function enviar(peticion: Peticion) {
    if (bloqueo.current) return false;
    bloqueo.current = true; setEnviando(true); setError(null); setExito(false);
    const cuerpo = JSON.stringify(peticion.cuerpo);
    const contenido = `${peticion.url}:${cuerpo}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (peticion.libro) {
      if (clave.current?.cuerpo !== contenido) clave.current = { cuerpo: contenido, uuid: crypto.randomUUID() };
      headers["Idempotency-Key"] = clave.current.uuid;
    }
    try {
      const respuesta = await fetch(peticion.url, { method: peticion.metodo ?? "POST", headers, body: cuerpo });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.error ?? { mensaje: "No se pudo guardar." }); enfocarError(idFormulario); return false;
      }
      if (datos.datos?.material?.id && typeof datos.datos.existenciaResultante === "string") {
        setExistencias((actuales) => ({ ...actuales, [datos.datos.material.id]: datos.datos.existenciaResultante }));
      }
      setExito(true); toast.success("Registro guardado.");
      if (datos.datos?.resumen?.some((material: { excedeEstimado: boolean }) => material.excedeEstimado)) {
        toast.warning("El consumo neto supera el estimado de la orden.");
      }
      if (peticion.destino) router.push(peticion.destino);
      router.refresh(); return true;
    } catch { setError({ mensaje: "No se pudo conectar. Revise su conexión e intente nuevamente." }); return false; }
    finally { bloqueo.current = false; setEnviando(false); }
  }
  return { enviar, enviando, error, campos: error?.campos ?? {}, exito, existencias, cambiarContenido,
    recargar: () => router.refresh() };
}
