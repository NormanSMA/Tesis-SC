"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatearFecha } from "@/lib/formato";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { TITULOS_REPORTES } from "../columnas";
import { NOMBRES_REPORTES, type ConsultaReporte, type NombreReporte } from "../schema";

type Propiedades = { nombre: NombreReporte; consulta: ConsultaReporte; areas: { id: string; nombre: string }[]; campos?: Record<string, string> };
const TODAS = "__todas__";
const LIMPIAR = { desde: null, hasta: null, texto: null, soloAlertas: null, area: null };

function FechaFiltro({ parametro, valor, error }: { parametro: "desde" | "hasta"; valor?: string; error?: string }) {
  const { navegar } = useParametrosUrl();
  const id = useId();
  const [fecha, setFecha] = useState(valor ?? "");
  const [previo, setPrevio] = useState(valor ?? "");
  if ((valor ?? "") !== previo) { setPrevio(valor ?? ""); setFecha(valor ?? ""); }
  return <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <Label htmlFor={id}>{parametro === "desde" ? "Desde" : "Hasta"}</Label>
      <Input id={id} name={parametro} type="date" lang="es" value={fecha} className="w-auto" aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(evento) => { setFecha(evento.target.value); navegar({ [parametro]: evento.target.value || null }); }} />
    </div>
    {error ? <p id={`${id}-error`} className="text-sm text-danger">{error}</p> : null}
  </div>;
}

function rotuloPeriodo(consulta: ConsultaReporte): string {
  if (!consulta.desde || !consulta.hasta) return "";
  return `Periodo consultado: del ${formatearFecha(consulta.desde)} al ${formatearFecha(consulta.hasta)}. `;
}

function MasFiltros({ nombre, consulta, areas }: Pick<Propiedades, "nombre" | "consulta" | "areas">) {
  const { navegar } = useParametrosUrl();
  const porAlertas = nombre === "existencias";
  const activos = porAlertas ? Number(consulta.soloAlertas === "true") : Number(Boolean(consulta.area));
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="h-10 gap-2">
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Más filtros
        {activos ? <span className="rounded bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
          {activos}<span className="sr-only"> activo</span></span> : null}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4">
      {porAlertas ? <div className="flex flex-col gap-1.5"><Label htmlFor="soloAlertas">Alertas</Label>
        <Select value={consulta.soloAlertas === "true" ? "true" : "false"} onValueChange={(valor) => navegar({ soloAlertas: valor === "true" ? "true" : null })}>
          <SelectTrigger id="soloAlertas"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="false">Todos los materiales activos</SelectItem>
            <SelectItem value="true">Solo materiales en alerta</SelectItem></SelectContent></Select></div> : null}
      {nombre === "ordenes-por-etapa" ? <div className="flex flex-col gap-1.5"><Label htmlFor="area">Área</Label>
        <Select value={consulta.area ?? TODAS} onValueChange={(valor) => navegar({ area: valor === TODAS ? null : valor })}>
          <SelectTrigger id="area"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={TODAS}>Todas las áreas</SelectItem>
            {areas.map((area) => <SelectItem key={area.id} value={area.id}>{area.nombre}</SelectItem>)}</SelectContent></Select></div> : null}
    </PopoverContent>
  </Popover>;
}

/** Barra de reportes en una fila: reporte, fechas o búsqueda y "Más filtros". Todo vive en la URL. */
export function FiltrosReportes({ nombre, consulta, areas, campos }: Propiedades) {
  const { navegar } = useParametrosUrl();
  const periodo = nombre === "cotizaciones-por-estado" || nombre === "carga-por-operario";
  const conExtras = nombre === "existencias" || nombre === "ordenes-por-etapa";
  const hayFiltros = Boolean(consulta.texto || consulta.area) || consulta.soloAlertas === "true";
  return <div role="group" aria-label="Filtros de reportes" className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="reporte">Reporte</Label>
        <Select value={nombre} onValueChange={(valor) => navegar({ ...LIMPIAR, nombre: valor })}>
          <SelectTrigger id="reporte" className="w-64 max-w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{NOMBRES_REPORTES.map((opcion) => <SelectItem key={opcion} value={opcion}>{TITULOS_REPORTES[opcion]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {periodo ? <>
        <FechaFiltro parametro="desde" valor={consulta.desde} error={campos?.desde} />
        <FechaFiltro parametro="hasta" valor={consulta.hasta} error={campos?.hasta} />
      </> : null}
      {nombre === "existencias" ? <BuscadorEnVivo etiqueta="Buscar material" parametro="texto" marcador="Buscar material"
        className="basis-full sm:max-w-xs sm:basis-64" /> : null}
      {conExtras ? <MasFiltros nombre={nombre} consulta={consulta} areas={areas} /> : null}
      {hayFiltros ? <Button type="button" variant="ghost" className="h-10" onClick={() => navegar(LIMPIAR)}>Limpiar filtros</Button> : null}
    </div>
    {periodo ? <p className="text-sm text-muted-foreground">{rotuloPeriodo(consulta)}Fechas inclusivas de Managua. Periodo máximo: cinco años. Las completadas usan su fecha de finalización.</p> : null}
  </div>;
}
