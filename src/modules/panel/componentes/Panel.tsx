"use client";

import { useState } from "react";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { formatearFechaHora } from "@/lib/formato";
import type { PanelDto } from "../service";
import { CargaPanel, CotizacionesPanel, MaterialesPanel, ResumenPanel } from "./BloquesPanel";

export function Panel({ inicial }: { inicial: PanelDto }) {
  const [datos, setDatos] = useState(inicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  async function actualizar() {
    setCargando(true); setError("");
    try {
      const respuesta = await fetch("/api/v1/panel", { cache: "no-store" });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error?.mensaje ?? "No se pudo actualizar el panel.");
      setDatos(cuerpo.datos);
    } catch (fallo) { setError(fallo instanceof Error ? fallo.message : "No se pudo actualizar el panel."); }
    finally { setCargando(false); }
  }
  return <><PageHeader titulo="Panel" descripcion="Resumen de la operación de Soluciones Creativas." acciones={
    <Button onClick={actualizar} disabled={cargando}>{cargando ? "Actualizando…" : "Actualizar"}</Button>} />
    <div aria-busy={cargando} className="min-w-0 space-y-6">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{cargando ? "Cargando indicadores…" : `Actualizado: ${formatearFechaHora(datos.generadoEn)}`}</p>
      {error ? <p role="alert" aria-live="assertive" className="text-danger">{error}</p> : null}
      {datos.resumen ? <ResumenPanel datos={datos.resumen} /> : null}
      {datos.cotizaciones ? <CotizacionesPanel datos={datos.cotizaciones} /> : null}
      {datos.materiales ? <MaterialesPanel datos={datos.materiales} /> : null}
      {datos.carga ? <CargaPanel datos={datos.carga} /> : null}
      {!datos.resumen && !datos.cotizaciones && !datos.materiales && !datos.carga ? <p>Sin bloques disponibles con sus permisos.</p> : null}
    </div></>;
}
