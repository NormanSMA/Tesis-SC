"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { solicitarApi } from "@/lib/cliente-api";
import type { CamposError } from "@/lib/errores";
import { enfocarError } from "@/modules/cotizaciones/useSolicitudCotizacion";

type Peticion = { url: string; metodo: "POST" | "PATCH"; cuerpo: object };
const esquemaSolicitud = z.object({
  id: z.string(), advertencias: z.array(z.object({ mensaje: z.string() })).optional(),
});

export function useSolicitudOrden(idFormulario?: string) {
  const router = useRouter();
  const bloqueo = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<CamposError>({});
  const [conflicto, setConflicto] = useState(false);
  const [ordenExistente, setOrdenExistente] = useState<{ id: string; numero: string } | null>(null);

  async function enviar(peticion: Peticion): Promise<boolean> {
    if (bloqueo.current) return false;
    bloqueo.current = true;
    setEnviando(true); setError(null); setCampos({}); setConflicto(false); setOrdenExistente(null);
    const resultado = await solicitarApi({ ...peticion, esquema: esquemaSolicitud });
    if ("datos" in resultado) {
      toast.success("Orden guardada.");
      resultado.datos.advertencias?.forEach((advertencia) => toast.warning(advertencia.mensaje));
      router.push(`/ordenes/${resultado.datos.id}`);
      router.refresh();
    } else {
      setCampos(resultado.error?.campos ?? {});
      setError(resultado.error?.mensaje ?? "No se pudo guardar.");
      setConflicto(resultado.error?.codigo === "CONFLICTO_EDICION");
      const existente = resultado.error?.campos;
      if (resultado.error?.codigo === "ORDEN_EXISTENTE" && existente?.ordenId && existente?.numero) {
        setOrdenExistente({ id: existente.ordenId, numero: existente.numero });
      }
      if (idFormulario) enfocarError(idFormulario);
    }
    bloqueo.current = false; setEnviando(false);
    return "datos" in resultado;
  }
  return { enviar, enviando, error, campos, conflicto, ordenExistente, recargar: () => router.refresh() };
}
