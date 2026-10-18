"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z, type ZodType } from "zod";

import { solicitarApi } from "@/lib/cliente-api";
import type { CamposError } from "@/lib/errores";

type Peticion = { url: string; metodo: "POST" | "PATCH" | "PUT"; cuerpo: object; destino?: "editar" | "detalle" };
const esquemaSolicitud = z.object({ id: z.string(), numero: z.string().optional(), avisos: z.array(z.string()).optional() });

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

export function useSolicitudCotizacion(idFormulario?: string, alGuardar?: (id: string, numero?: string) => void) {
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
    const resultado = await solicitarApi({ ...peticion, esquema: esquemaSolicitud });
    if ("datos" in resultado) {
      if (alGuardar) alGuardar(resultado.datos.id, resultado.datos.numero);
      else {
        toast.success("Cotización guardada.");
        router.push(`/cotizaciones/${resultado.datos.id}${peticion.destino === "editar" ? "/editar" : ""}`);
        router.refresh();
      }
      resultado.datos.avisos?.forEach((aviso) => toast.warning(aviso));
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
