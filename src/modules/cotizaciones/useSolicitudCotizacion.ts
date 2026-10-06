"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ZodType } from "zod";

import type { CamposError } from "@/lib/errores";
import type { CotizacionDto } from "./tipos";

type Respuesta = { datos?: CotizacionDto; error?: { codigo?: string; mensaje?: string; campos?: CamposError } };
type Peticion = { url: string; metodo: "POST" | "PATCH" | "PUT"; cuerpo: object; destino?: "editar" | "detalle" };

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

export function enfocarError(idFormulario: string) {
  requestAnimationFrame(() => {
    document.getElementById(idFormulario)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

export function erroresEsquema(esquema: ZodType, entrada: unknown): CamposError {
  const resultado = esquema.safeParse(entrada);
  if (resultado.success) return {};
  return Object.fromEntries(resultado.error.issues.map((error) => [error.path.join("."), error.message]));
}

export function useSolicitudCotizacion(idFormulario?: string) {
  const router = useRouter();
  const bloqueo = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<CamposError>({});
  const [conflicto, setConflicto] = useState(false);

  async function enviar(peticion: Peticion) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setEnviando(true); setError(null); setCampos({}); setConflicto(false);
    const resultado = await solicitar(peticion);
    if (resultado.datos) {
      toast.success("Cotización guardada.");
      resultado.datos.avisos?.forEach((aviso) => toast.warning(aviso));
      router.push(`/cotizaciones/${resultado.datos.id}${peticion.destino === "editar" ? "/editar" : ""}`);
      router.refresh();
    } else {
      setCampos(resultado.error?.campos ?? {});
      setError(resultado.error?.mensaje ?? "No se pudo guardar.");
      setConflicto(resultado.error?.codigo === "CONFLICTO_EDICION");
      if (idFormulario) enfocarError(idFormulario);
    }
    bloqueo.current = false; setEnviando(false);
  }

  return { enviar, enviando, error, campos, conflicto, recargar: () => router.refresh() };
}
