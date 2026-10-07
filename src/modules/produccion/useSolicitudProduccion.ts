"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { CamposError } from "@/lib/errores";
import { enfocarError } from "@/modules/cotizaciones/useSolicitudCotizacion";

type Peticion = { url: string; metodo: "POST" | "PATCH"; cuerpo: object };
type Respuesta = { datos?: unknown; error?: { codigo?: string; mensaje?: string; campos?: CamposError } };

async function solicitar(peticion: Peticion): Promise<Respuesta> {
  try {
    const respuesta = await fetch(peticion.url, { method: peticion.metodo,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(peticion.cuerpo) });
    const cuerpo = await respuesta.json().catch(() => ({})) as Respuesta;
    return respuesta.ok && cuerpo.datos !== undefined ? cuerpo
      : { error: cuerpo.error ?? { mensaje: "No se pudo guardar." } };
  } catch {
    return { error: { mensaje: "No se pudo conectar. Revise su conexión e intente nuevamente." } };
  }
}

export function useSolicitudProduccion(idFormulario?: string) {
  const router = useRouter();
  const bloqueo = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<CamposError>({});
  const [conflicto, setConflicto] = useState(false);
  async function enviar(peticion: Peticion): Promise<boolean> {
    if (bloqueo.current) return false;
    bloqueo.current = true;
    setEnviando(true); setError(null); setCampos({}); setConflicto(false);
    const resultado = await solicitar(peticion);
    const guardado = resultado.datos !== undefined;
    if (guardado) {
      toast.success("Cambios guardados.");
      router.refresh();
    } else {
      setError(resultado.error?.mensaje ?? "No se pudo guardar.");
      setCampos(resultado.error?.campos ?? {});
      setConflicto(resultado.error?.codigo === "CONFLICTO_EDICION");
      if (idFormulario) enfocarError(idFormulario);
    }
    bloqueo.current = false; setEnviando(false);
    return guardado;
  }
  return { enviar, enviando, error, campos, conflicto, recargar: () => router.refresh() };
}
