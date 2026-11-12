"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { Map as Mapa, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export type PuntoInstalacion = [latitud: number, longitud: number];
export const CENTRO_ESTELI: PuntoInstalacion = [13.09289, -86.35629];

export function leerPunto(destino: string): PuntoInstalacion | null {
  const partes = destino.split(",").map((parte) => parte.trim());
  if (partes.length !== 2 || partes.some((parte) => !/^-?\d+(\.\d+)?$/.test(parte))) return null;
  const [latitud, longitud] = partes.map(Number);
  return Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180 ? [latitud, longitud] : null;
}

type Props = {
  destino: string; trazado: [number, number][]; alElegir: (punto: PuntoInstalacion) => void;
  alFallar: () => void;
};

export function MapaInstalacion({ destino, trazado, alElegir, alFallar }: Props) {
  const nodo = useRef<HTMLDivElement>(null);
  const mapa = useRef<Mapa | null>(null);
  const capa = useRef<LayerGroup | null>(null);
  const biblioteca = useRef<typeof import("leaflet") | null>(null);
  const seleccionar = useEffectEvent(alElegir);
  const informarFallo = useEffectEvent(alFallar);
  const dibujar = useEffectEvent(() => {
    const L = biblioteca.current;
    if (!L || !capa.current || !mapa.current) return;
    capa.current.clearLayers();
    L.circleMarker(CENTRO_ESTELI, { radius: 7, color: "#fff", fillColor: "#2d264f", fillOpacity: 1 })
      .bindTooltip("Parque Central de Estelí").addTo(capa.current);
    const punto = leerPunto(destino);
    if (punto) L.circleMarker(punto, { radius: 8, color: "#2d264f", fillColor: "#f3a320", fillOpacity: 1 })
      .bindTooltip("Lugar de instalación").addTo(capa.current);
    if (trazado.length) {
      const ruta = L.polyline(trazado.map(([lon, lat]) => [lat, lon]), { color: "#245ad8", weight: 5 }).addTo(capa.current);
      mapa.current.fitBounds(ruta.getBounds(), { padding: [28, 28], maxZoom: 15 });
    }
  });
  const centroInicial = useEffectEvent(() => leerPunto(destino) ?? CENTRO_ESTELI);
  useEffect(() => {
    let desmontado = false;
    void import("leaflet").then((L) => {
      if (desmontado || !nodo.current) return;
      biblioteca.current = L;
      const instancia = L.map(nodo.current, { scrollWheelZoom: false }).setView(centroInicial(), 13);
      mapa.current = instancia;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, referrerPolicy: "strict-origin-when-cross-origin",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).once("tileerror", () => informarFallo()).addTo(instancia);
      capa.current = L.layerGroup().addTo(instancia);
      instancia.on("click", ({ latlng }) => seleccionar([latlng.lat, latlng.lng]));
      instancia.on("keypress", ({ originalEvent }) => {
        if (originalEvent.key === "Enter") {
          const centro = instancia.getCenter();
          seleccionar([centro.lat, centro.lng]);
        }
      });
      dibujar();
    }).catch(() => { if (!desmontado) informarFallo(); });
    return () => { desmontado = true; mapa.current?.remove(); mapa.current = null; capa.current = null; };
  }, []);
  useEffect(() => { dibujar(); }, [destino, trazado]);
  return <div ref={nodo} role="region" aria-label="Mapa de instalación" aria-describedby="ayuda-mapa-instalacion"
    className="isolate h-80 w-full overflow-hidden rounded-lg border bg-muted" />;
}
