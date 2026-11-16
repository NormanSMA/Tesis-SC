"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/comunes/ValorFormateado";
import type { Moneda } from "@/core/moneda";
import { leerCoordenadas, type PuntoInstalacion } from "../coordenadas";
import { costoInstalacion, kilometrosCobrados, type ValoresInstalacion } from "../instalacion";
import { CampoTexto } from "./CamposEditor";
import { MapaInstalacion } from "./MapaInstalacion";
import { useRutaInstalacion } from "./useRutaInstalacion";

export type { ValoresInstalacion } from "../instalacion";
export const INSTALACION_VACIA: ValoresInstalacion = { manoObra: "", fuera: false, destino: "", km: "", tarifa: "", idaVuelta: true };
export function entradaInstalacion(valores: ValoresInstalacion, tarifaBase?: string) {
  return { manoObra: valores.manoObra.trim() || "0", destino: valores.fuera ? valores.destino : null,
    tarifa: valores.tarifa.trim() || tarifaBase, idaVuelta: valores.idaVuelta, km: valores.fuera ? valores.km.trim() : null };
}
type Props = { valores: ValoresInstalacion; alCambiar: (v: ValoresInstalacion) => void; moneda: Moneda; tarifa: string; errores: Record<string, string> };
export function CamposInstalacion({ valores, alCambiar, moneda, tarifa, errores }: Props) {
  const ruta = useRutaInstalacion({ valores, alCambiar });
  const [mapaNoDisponible, setMapaNoDisponible] = useState(false);
  const tarifaAplicada = valores.tarifa || tarifa;
  const km = kilometrosCobrados(valores.fuera ? valores.km : null, valores.idaVuelta);
  return <fieldset disabled={ruta.consultando} className="min-w-0 space-y-4">
    <legend className="sr-only">Costos internos de instalación</legend>
    <CampoTexto id="instalacion-mano" etiqueta={`Mano de obra y otros costos de instalación (${moneda})`} decimal valor={valores.manoObra}
      error={errores["instalacion.manoObra"]} alCambiar={manoObra => alCambiar({ ...valores, manoObra })} />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary"
      checked={valores.fuera} onChange={e => alCambiar({ ...valores, fuera: e.target.checked })} />Instalación fuera de la ciudad de Estelí</label>
    {valores.fuera ? <>
      <BuscarCoordenadas alElegir={ruta.elegirPunto} />
      <p id="ayuda-mapa-instalacion" className="text-sm text-muted-foreground">Seleccione también con un clic en el mapa. Con el teclado, use las flechas e Intro. La ruta sale del centro de Estelí.</p>
      <MapaInstalacion destino={valores.destino} trazado={ruta.trazado} alElegir={ruta.elegirPunto} alFallar={() => setMapaNoDisponible(true)} />
      {ruta.consultando ? <p role="status">Calculando ruta y costo de ida y vuelta…</p> : null}
      {ruta.error ? <p role="alert" className="text-destructive">{ruta.error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto id="instalacion-destino" etiqueta="Coordenadas del punto seleccionado" valor={valores.destino} deshabilitado error={errores["instalacion.destino"]} alCambiar={() => {}} />
        <CampoTexto id="instalacion-tarifa" etiqueta={`Tarifa por kilómetro (${moneda})`} decimal valor={tarifaAplicada}
          ayuda="Se toma de Configuración. Puede ajustar el precio para esta cotización." error={errores["instalacion.tarifa"]} alCambiar={tarifa => alCambiar({ ...valores, tarifa })} />
      </div>
      <dl className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-3"><div><dt>Distancia de ida</dt><dd>{valores.km || "—"} km</dd></div><div><dt>{valores.idaVuelta ? "Ida y vuelta" : "Distancia histórica cobrada"}</dt><dd>{km || "—"} km</dd></div><div><dt>Costo de traslado</dt><dd><Money valor={costoInstalacion("0", km, tarifaAplicada)} moneda={moneda} /></dd></div></dl>
      {!valores.idaVuelta && valores.km ? <p role="status">La cotización conserva su cálculo histórico. Seleccione el destino de nuevo para aplicar ida y vuelta.</p> : null}
      {ruta.error || mapaNoDisponible ? <DistanciaManual {...{ valores, alCambiar, errores }} /> : null}
      <p className="text-xs text-muted-foreground">Rutas con <a className="underline" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> y OSRM. Distancia estimada según las vías disponibles.</p>
    </> : null}
    <p className="font-medium">Total interno de instalación: <Money valor={costoInstalacion(valores.manoObra, km, tarifaAplicada)} moneda={moneda} /></p>
  </fieldset>;
}
function BuscarCoordenadas({ alElegir }: { alElegir: (punto: PuntoInstalacion) => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  function buscar() { const punto = leerCoordenadas(texto); if (!punto) { setError("Pegue latitud, longitud (ejemplo: 13.30, -86.49) o un enlace que contenga esas coordenadas. Los enlaces cortos requieren copiar las coordenadas del mapa."); return; } setError(""); void alElegir(punto); }
  return <div className="space-y-3 rounded-lg border p-4" onKeyDown={e => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) { e.preventDefault(); buscar(); } }}>
    <CampoTexto id="buscar-coordenadas" etiqueta="Buscar ubicación por coordenadas o enlace de mapa" valor={texto} alCambiar={setTexto} error={error} ayuda="Latitud, longitud de Google Maps u otro mapa. También admite enlaces con coordenadas visibles." />
    <Button type="button" variant="outline" onClick={buscar}>Ubicar y calcular ruta</Button>
  </div>;
}
function DistanciaManual({ valores, alCambiar, errores }: Pick<Props,"valores"|"alCambiar"|"errores">) {
  return <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">Registrar una distancia verificada manualmente</summary><p className="my-3 text-sm">Use esta alternativa si el proveedor del mapa o de rutas no está disponible. Registre únicamente los kilómetros de ida.</p>
    <CampoTexto id="instalacion-km" etiqueta="Kilómetros de ida verificados" decimal requerido valor={valores.km} error={errores["instalacion.km"]} alCambiar={km => alCambiar({ ...valores, km, idaVuelta: true })} /></details>;
}
