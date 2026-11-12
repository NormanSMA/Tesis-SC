"use client";

import { useState } from "react";
import { Money } from "@/components/comunes/ValorFormateado";
import type { Moneda } from "@/core/moneda";
import { costoInstalacion } from "../instalacion";
import { CampoTexto } from "./CamposEditor";
import { MapaInstalacion, type PuntoInstalacion } from "./MapaInstalacion";

export type ValoresInstalacion = { manoObra: string; fuera: boolean; destino: string; km: string };
export const INSTALACION_VACIA: ValoresInstalacion = { manoObra: "", fuera: false, destino: "", km: "" };

export function entradaInstalacion(valores: ValoresInstalacion) {
  return { manoObra: valores.manoObra.trim() || "0", destino: valores.fuera ? valores.destino : null,
    km: valores.fuera ? valores.km.trim() : null };
}

async function buscarRuta([latitud, longitud]: PuntoInstalacion): Promise<{ km: string; trazado: [number, number][] }> {
  const respuesta = await fetch("/api/v1/cotizaciones/instalacion/ruta", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitud, longitud }) });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) throw new Error(cuerpo.error?.mensaje ?? "La ruta no está disponible.");
  return cuerpo.datos;
}

export function CamposInstalacion({ valores, alCambiar, moneda, tarifa, errores }: {
  valores: ValoresInstalacion; alCambiar: (valores: ValoresInstalacion) => void; moneda: Moneda;
  tarifa: string; errores: Record<string, string>;
}) {
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState("");
  const [mapaNoDisponible, setMapaNoDisponible] = useState(false);
  const [trazado, setTrazado] = useState<[number, number][]>([]);
  async function elegirPunto([latitud, longitud]: PuntoInstalacion) {
    if (consultando) return;
    const punto = { ...valores, destino: `${latitud.toFixed(6)}, ${longitud.toFixed(6)}`, km: "" };
    alCambiar(punto);
    setConsultando(true); setError(""); setTrazado([]);
    try {
      const ruta = await buscarRuta([latitud, longitud]);
      setTrazado(ruta.trazado);
      alCambiar({ ...punto, km: ruta.km });
    } catch (fallo) { setError(fallo instanceof Error ? fallo.message : "La ruta no está disponible."); }
    finally { setConsultando(false); }
  }
  return <fieldset disabled={consultando} className="space-y-3">
    <legend className="sr-only">Costos internos de instalación</legend>
    <CampoTexto id="instalacion-mano" etiqueta={`Costo de instalación (${moneda})`} decimal valor={valores.manoObra}
      error={errores["instalacion.manoObra"]} alCambiar={(manoObra) => alCambiar({ ...valores, manoObra })} />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary"
      checked={valores.fuera} onChange={(evento) => alCambiar({ ...valores, fuera: evento.target.checked })} /> Instalación fuera de la ciudad de Estelí</label>
    {valores.fuera ? <>
      <p id="ayuda-mapa-instalacion" className="text-sm text-muted-foreground">
        Seleccione el destino en el mapa. Con el teclado, mueva el mapa con las flechas y pulse Intro para elegir su centro.
      </p>
      <MapaInstalacion destino={valores.destino} trazado={trazado} alElegir={elegirPunto} alFallar={() => setMapaNoDisponible(true)} />
      {consultando ? <p role="status" className="text-sm">Calculando la ruta de ida…</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {error || mapaNoDisponible ? <p className="text-sm text-muted-foreground">Puede registrar la ubicación y una distancia comprobada manualmente.</p> : null}
      <CampoTexto id="instalacion-destino" etiqueta="Punto de instalación" requerido valor={valores.destino}
        deshabilitado={!error && !mapaNoDisponible} error={errores["instalacion.destino"]}
        alCambiar={(destino) => alCambiar({ ...valores, destino, km: "" })} />
      <CampoTexto id="instalacion-km" etiqueta="Kilómetros de ida" decimal requerido valor={valores.km}
        deshabilitado={!error && !mapaNoDisponible}
        error={errores["instalacion.km"]} alCambiar={(km) => alCambiar({ ...valores, km })} />
      <p className="text-sm">Tarifa por km: <Money valor={tarifa} moneda={moneda} /></p>
      <p className="text-xs text-muted-foreground">Rutas con <a className="underline" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> y OSRM.
        <a className="ml-1 underline" href="https://www.openstreetmap.org/fixthemap">Corregir el mapa</a></p>
    </> : null}
    <p className="text-sm font-medium">Total interno de instalación: <Money
      valor={costoInstalacion(valores.manoObra, valores.fuera ? valores.km : null, tarifa)} moneda={moneda} /></p>
  </fieldset>;
}
