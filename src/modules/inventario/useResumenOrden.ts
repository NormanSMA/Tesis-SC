"use client";

import { useEffect, useState } from "react";
import type { ResumenOrdenInventario } from "./contrato-orden";

export function useResumenOrden(ordenId: string) {
  const [resumen, setResumen] = useState<ResumenOrdenInventario | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controlador = new AbortController();
    fetch(`/api/v1/ordenes/${ordenId}/consumos`, { signal: controlador.signal, cache: "no-store" })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error?.mensaje ?? "No se pudieron cargar los materiales.");
        return cuerpo.datos as ResumenOrdenInventario;
      }).then((datos) => { setResumen(datos); setError(""); })
      .catch((causa) => { if (!controlador.signal.aborted) setError(causa.message ?? "No se pudieron cargar los materiales."); });
    return () => controlador.abort();
  }, [ordenId, revision]);
  return { resumen: resumen?.ordenId === ordenId ? resumen : null, error,
    recargar: () => setRevision((actual) => actual + 1) };
}
