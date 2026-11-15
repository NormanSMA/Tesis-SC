"use client";
import { useRef, useState } from "react";
import type { PuntoInstalacion } from "../coordenadas";
import type { ValoresInstalacion } from "../instalacion";

async function buscarRuta([latitud, longitud]: PuntoInstalacion) {
  const respuesta = await fetch("/api/v1/cotizaciones/instalacion/ruta", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitud, longitud }) });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) throw new Error(cuerpo.error?.mensaje ?? "La ruta no está disponible.");
  return cuerpo.datos as { km: string; trazado: [number, number][] };
}
export function useRutaInstalacion({ valores, alCambiar }: { valores: ValoresInstalacion; alCambiar: (v: ValoresInstalacion) => void }) {
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState("");
  const [trazado, setTrazado] = useState<[number, number][]>([]);
  const solicitud = useRef(0);
  async function elegirPunto([latitud, longitud]: PuntoInstalacion) {
    const numero = ++solicitud.current;
    const punto = { ...valores, destino: `${latitud.toFixed(6)}, ${longitud.toFixed(6)}`, km: "", idaVuelta: true };
    alCambiar(punto); setConsultando(true); setError(""); setTrazado([]);
    try {
      const ruta = await buscarRuta([latitud, longitud]);
      if (numero !== solicitud.current) return;
      setTrazado(ruta.trazado); alCambiar({ ...punto, km: ruta.km });
    } catch (fallo) { if (numero === solicitud.current) setError(fallo instanceof Error ? fallo.message : "La ruta no está disponible."); }
    finally { if (numero === solicitud.current) setConsultando(false); }
  }
  return { consultando, error, trazado, elegirPunto };
}
