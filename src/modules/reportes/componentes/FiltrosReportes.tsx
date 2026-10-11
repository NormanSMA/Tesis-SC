"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearFecha } from "@/lib/formato";
import { TITULOS_REPORTES } from "../columnas";
import { NOMBRES_REPORTES, type ConsultaReporte, type NombreReporte } from "../schema";

const SELECTOR = "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
type Propiedades = { nombre: NombreReporte; consulta: ConsultaReporte; areas: { id: string; nombre: string }[]; campos?: Record<string, string> };
function FechaFiltro({ nombre, valor, error }: { nombre: "desde" | "hasta"; valor?: string; error?: string }) {
  return <div className="space-y-2"><Label htmlFor={nombre}>{nombre === "desde" ? "Desde" : "Hasta"}</Label>
    <Input id={nombre} name={nombre} type="date" lang="es" defaultValue={valor} aria-invalid={Boolean(error)} aria-describedby={error ? `${nombre}-error` : undefined} />
    {error ? <p id={`${nombre}-error`} className="text-sm text-danger">{error}</p> : null}</div>;
}
function rotuloPeriodo(consulta: ConsultaReporte): string {
  if (!consulta.desde || !consulta.hasta) return "";
  return `Periodo consultado: del ${formatearFecha(consulta.desde)} al ${formatearFecha(consulta.hasta)}. `;
}
export function FiltrosReportes({ nombre, consulta, areas, campos }: Propiedades) {
  const [seleccionado, setSeleccionado] = useState(nombre);
  const periodo = seleccionado === "cotizaciones-por-estado" || seleccionado === "carga-por-operario";
  return <form action="/reportes" method="get" aria-label="Filtros de reportes" className="grid min-w-0 items-end gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
    <div className="space-y-2"><Label htmlFor="reporte">Reporte</Label><select id="reporte" name="nombre" className={SELECTOR} value={seleccionado}
      onChange={(evento) => setSeleccionado(evento.target.value as NombreReporte)}>
      {NOMBRES_REPORTES.map((opcion) => <option key={opcion} value={opcion}>{TITULOS_REPORTES[opcion]}</option>)}</select></div>
    {periodo ? <><FechaFiltro nombre="desde" valor={consulta.desde} error={campos?.desde} />
      <FechaFiltro nombre="hasta" valor={consulta.hasta} error={campos?.hasta} /></> : null}
    {seleccionado === "existencias" ? <><div className="space-y-2"><Label htmlFor="texto">Buscar material</Label>
      <Input id="texto" name="texto" defaultValue={consulta.texto} maxLength={200} /></div>
      <div className="space-y-2"><Label htmlFor="soloAlertas">Alertas</Label><select id="soloAlertas" name="soloAlertas" className={SELECTOR} defaultValue={consulta.soloAlertas}>
        <option value="false">Todos los materiales activos</option><option value="true">Solo materiales en alerta</option></select></div></> : null}
    {seleccionado === "ordenes-por-etapa" ? <div className="space-y-2"><Label htmlFor="area">Área</Label>
      <select id="area" name="area" className={SELECTOR} defaultValue={consulta.area ?? ""}><option value="">Todas las áreas</option>
        {areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></div> : null}
    <Button type="submit">Aplicar filtros</Button>
    {periodo ? <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">{rotuloPeriodo(consulta)}Fechas inclusivas de Managua. Periodo máximo: cinco años. Las completadas usan su fecha de finalización.</p> : null}
  </form>;
}
