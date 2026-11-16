"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CentroNotificaciones } from "../tipos";

const INTERVALO_MS = 15000;
const MAXIMO_EMERGENTES = 3;

function leerVistos(clave: string): Set<string> {
  try { return new Set<string>(JSON.parse(localStorage.getItem(clave) ?? "[]")); } catch { return new Set(); }
}

/** Consulta los avisos, muestra emergentes de los nuevos y suena una vez por lote. */
export function useNotificaciones(usuarioId: string, sonar: () => void) {
  const router = useRouter();
  const [centro, setCentro] = useState<CentroNotificaciones>({ datos: [], noLeidas: 0, leidasHasta: null });
  const sonarActual = useRef(sonar);
  useEffect(() => { sonarActual.current = sonar; }, [sonar]);

  useEffect(() => {
    let cerrado = false;
    let consultando = false;
    const clave = `tracore-avisos-${usuarioId}`;
    const vistos = leerVistos(clave);
    async function consultar() {
      if (consultando) return;
      consultando = true;
      try {
        const respuesta = await fetch("/api/v1/notificaciones", { cache: "no-store" });
        if (!respuesta.ok || cerrado) return;
        const { datos }: { datos: CentroNotificaciones } = await respuesta.json();
        if (cerrado) return;
        setCentro(datos);
        const nuevas = datos.datos.filter((aviso) => !vistos.has(aviso.id)
          && (!datos.leidasHasta || aviso.fecha > datos.leidasHasta));
        for (const aviso of datos.datos) vistos.add(aviso.id);
        if (!nuevas.length) return;
        for (const aviso of nuevas.slice(0, MAXIMO_EMERGENTES)) {
          toast(aviso.titulo, { description: aviso.detalle, duration: 15000,
            action: { label: "Abrir", onClick: () => router.push(aviso.destino) } });
        }
        sonarActual.current();
        if (nuevas.some((aviso) => aviso.tipo.startsWith("ETAPA"))) router.refresh();
        try { localStorage.setItem(clave, JSON.stringify([...vistos].slice(-1000))); } catch { /* El aviso permanece visible. */ }
      } catch { /* Se reintenta cuando vuelva la conexión. */ }
      finally { consultando = false; }
    }
    void consultar();
    const intervalo = setInterval(() => void consultar(), INTERVALO_MS);
    return () => { cerrado = true; clearInterval(intervalo); };
  }, [usuarioId, router]);

  const marcarLeidas = useCallback(async () => {
    setCentro((actual) => ({ ...actual, noLeidas: 0 }));
    try {
      const respuesta = await fetch("/api/v1/notificaciones/leidas", { method: "POST" });
      if (!respuesta.ok) return;
      const { datos }: { datos: { leidasHasta: string } } = await respuesta.json();
      setCentro((actual) => ({ ...actual, noLeidas: 0, leidasHasta: datos.leidasHasta }));
    } catch { /* El contador vuelve en la próxima consulta. */ }
  }, []);

  return { centro, marcarLeidas };
}
