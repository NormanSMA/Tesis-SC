"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const clave = (usuarioId: string) => `tracore-sonido-${usuarioId}`;

function leerPreferencia(usuarioId: string): boolean {
  try { return localStorage.getItem(clave(usuarioId)) !== "0"; } catch { return true; }
}
function suscribir(alCambiar: () => void) {
  window.addEventListener("storage", alCambiar);
  return () => window.removeEventListener("storage", alCambiar);
}

/**
 * El sonido queda activado por defecto y la elección se recuerda por usuario en este navegador.
 * Los navegadores exigen un gesto para reproducir audio: el contexto se crea con el primer clic o tecla
 * de cada visita, sin pedirle al usuario que vuelva a activarlo.
 */
export function useSonidoAvisos(usuarioId: string) {
  const contexto = useRef<AudioContext | null>(null);
  // La preferencia guardada se lee sin desajustar la hidratación; la elección de esta visita la sustituye.
  const guardada = useSyncExternalStore(suscribir, () => leerPreferencia(usuarioId), () => true);
  const [eleccion, setEleccion] = useState<boolean | null>(null);
  const activo = eleccion ?? guardada;
  const [listo, setListo] = useState(false);

  const desbloquear = useCallback(async () => {
    try {
      contexto.current ??= new AudioContext();
      await contexto.current.resume();
      setListo(contexto.current.state === "running");
    } catch { setListo(false); }
  }, []);

  useEffect(() => {
    if (!activo || listo) return;
    const alInteractuar = () => { void desbloquear(); };
    window.addEventListener("pointerdown", alInteractuar, { once: true });
    window.addEventListener("keydown", alInteractuar, { once: true });
    return () => {
      window.removeEventListener("pointerdown", alInteractuar);
      window.removeEventListener("keydown", alInteractuar);
    };
  }, [activo, listo, desbloquear]);

  useEffect(() => () => { void contexto.current?.close(); contexto.current = null; }, []);

  const cambiar = useCallback((valor: boolean) => {
    setEleccion(valor);
    try { localStorage.setItem(clave(usuarioId), valor ? "1" : "0"); } catch { /* La preferencia dura esta visita. */ }
    if (valor) void desbloquear();
  }, [usuarioId, desbloquear]);

  const sonar = useCallback(() => {
    const audio = contexto.current;
    if (!activo || !audio || audio.state !== "running") return;
    const tono = audio.createOscillator();
    const volumen = audio.createGain();
    tono.frequency.value = 880;
    volumen.gain.setValueAtTime(0.08, audio.currentTime);
    volumen.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
    tono.connect(volumen);
    volumen.connect(audio.destination);
    tono.start();
    tono.stop(audio.currentTime + 0.4);
  }, [activo]);

  return { activo, listo, cambiar, sonar };
}
