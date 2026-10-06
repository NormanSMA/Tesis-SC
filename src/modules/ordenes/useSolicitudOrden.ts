"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { CamposError } from "@/lib/errores";
import { enfocarError } from "@/modules/cotizaciones/useSolicitudCotizacion";
import type { OrdenDto } from "./tipos";

type Peticion = { url: string; metodo: "POST" | "PATCH"; cuerpo: object };
type Respuesta = { datos?: OrdenDto; error?: { codigo?: string; mensaje?: string; campos?: CamposError } };

async function solicitar(peticion: Peticion): Promise<Respuesta> {
  try {
    const respuesta = await fetch(peticion.url, { method: peticion.metodo,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(peticion.cuerpo) });
    const cuerpo = await respuesta.json().catch(() => ({})) as Respuesta;
    return respuesta.ok && cuerpo.datos ? cuerpo : { error: cuerpo.error ?? { mensaje: "No se pudo guardar." } };
  } catch {
    return { error: { mensaje: "No se pudo conectar. Revise su conexión e intente nuevamente." } };
  }
}

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
    const resultado = await solicitar(peticion);
    if (resultado.datos) {
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
    return Boolean(resultado.datos);
  }
  return { enviar, enviando, error, campos, conflicto, ordenExistente, recargar: () => router.refresh() };
}
