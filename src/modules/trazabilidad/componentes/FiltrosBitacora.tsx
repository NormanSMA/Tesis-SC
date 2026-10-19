"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { FiltroBuscable } from "@/components/comunes/SelectorBuscable";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { SelectorOrden } from "@/components/comunes/SelectorOrden";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { ACCION_TEXTO, ENTIDAD_TEXTO } from "../etiquetas";
import { ACCIONES, ENTIDADES, type ConsultaBitacora } from "../schema";

const TODOS = "__todos__";
const OPCIONES_ORDEN = [{ valor: "creadoEn:desc", etiqueta: "Más recientes" }, { valor: "creadoEn:asc", etiqueta: "Más antiguos" }];
const PARAMETROS = { texto: null, entidad: null, accion: null, usuario: null, orden: null, cotizacion: null, desde: null, hasta: null };

function Seleccion({ parametro, etiqueta, valor, opciones }: {
  parametro: "entidad" | "accion" | "usuario"; etiqueta: string; valor?: string; opciones: { id: string; nombre: string }[];
}) {
  // valor llega del servidor; FiltroBuscable lo lee de la misma URL.
  void valor;
  return <FiltroBuscable etiqueta={etiqueta} parametro={parametro} opciones={opciones} valorTodos={TODOS} className="min-w-0" />;
}

/** Campo con texto local: aplica el valor a la URL al pulsar Enter o al salir del campo. */
function CampoTexto({ parametro, etiqueta, valor }: { parametro: "orden" | "cotizacion"; etiqueta: string; valor?: string }) {
  const { navegar } = useParametrosUrl();
  const [texto, setTexto] = useState(valor ?? "");
  const [previo, setPrevio] = useState(valor ?? "");
  if ((valor ?? "") !== previo) { setPrevio(valor ?? ""); setTexto(valor ?? ""); }
  const aplicar = () => { if (texto.trim() !== previo) navegar({ [parametro]: texto.trim() || null }); };
  return <FormField id={`filtro-${parametro}`} etiqueta={etiqueta} className="min-w-0 [&_label]:text-sm [&_label]:font-medium">
    {(atributos) => <Input {...atributos} type="search" value={texto} maxLength={20} autoComplete="off"
      onChange={(evento) => setTexto(evento.target.value)} onBlur={aplicar}
      onKeyDown={(evento) => { if (evento.key === "Enter") { evento.preventDefault(); aplicar(); } }} />}
  </FormField>;
}

function CampoFecha({ parametro, etiqueta, valor }: { parametro: "desde" | "hasta"; etiqueta: string; valor?: string }) {
  const { navegar } = useParametrosUrl();
  const id = useId();
  const [fecha, setFecha] = useState(valor ?? "");
  const [previo, setPrevio] = useState(valor ?? "");
  if ((valor ?? "") !== previo) { setPrevio(valor ?? ""); setFecha(valor ?? ""); }
  return <div className="flex items-center gap-2">
    <label htmlFor={id} className="text-sm font-medium">{etiqueta}</label>
    <Input id={id} type="date" lang="es" value={fecha} className="w-auto"
      onChange={(evento) => { setFecha(evento.target.value); navegar({ [parametro]: evento.target.value || null }); }} />
  </div>;
}

/** Barra de la bitácora: búsqueda en vivo, fechas y "Más filtros". Todo vive en la URL. */
export function FiltrosBitacora({ consulta, usuarios }: { consulta: ConsultaBitacora; usuarios: { id: string; nombre: string }[] }) {
  const { navegar } = useParametrosUrl();
  const avanzados = [consulta.entidad, consulta.accion, consulta.usuario, consulta.orden, consulta.cotizacion].filter(Boolean).length;
  const hayFiltros = avanzados > 0 || Boolean(consulta.texto || consulta.desde || consulta.hasta);
  return <div role="group" aria-label="Filtrar bitácora" className="mb-4 flex flex-wrap items-center gap-3">
    <BuscadorEnVivo etiqueta="Buscar en la bitácora" parametro="texto" marcador="Buscar por detalle"
      className="basis-full sm:max-w-md lg:min-w-64 lg:basis-auto lg:flex-1" />
    <CampoFecha parametro="desde" etiqueta="Desde" valor={consulta.desde} />
    <CampoFecha parametro="hasta" etiqueta="Hasta" valor={consulta.hasta} />
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Más filtros
          {avanzados ? <span className="rounded bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
            {avanzados}<span className="sr-only"> activos</span></span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4">
        <Seleccion parametro="entidad" etiqueta="Entidad" valor={consulta.entidad}
          opciones={ENTIDADES.map((id) => ({ id, nombre: ENTIDAD_TEXTO[id] }))} />
        <Seleccion parametro="accion" etiqueta="Acción" valor={consulta.accion}
          opciones={ACCIONES.map((id) => ({ id, nombre: ACCION_TEXTO[id] }))} />
        <Seleccion parametro="usuario" etiqueta="Usuario" valor={consulta.usuario} opciones={usuarios} />
        <CampoTexto parametro="orden" etiqueta="Número de orden" valor={consulta.orden} />
        <CampoTexto parametro="cotizacion" etiqueta="Número de cotización" valor={consulta.cotizacion} />
      </PopoverContent>
    </Popover>
    <SelectorOrden parametro="ordenar" opciones={OPCIONES_ORDEN} valorPorDefecto="creadoEn:desc" />
    {hayFiltros ? <Button type="button" variant="ghost" className="h-10" onClick={() => navegar(PARAMETROS)}>Limpiar filtros</Button> : null}
  </div>;
}

export function BuscarTrabajo() {
  return <form action="/trazabilidad" method="get" role="search" aria-label="Buscar trazabilidad completa"
    className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm">
    <FormField id="buscar-trabajo" etiqueta="Número de orden o cotización" className="min-w-0 flex-1 basis-60 [&_label]:text-sm [&_label]:font-medium">
      {(atributos) => <Input {...atributos} name="trabajo" type="search" required maxLength={20} placeholder="OT-2026-0001 o COT-2026-0001" />}
    </FormField><Button type="submit">Abrir trazabilidad completa</Button>
  </form>;
}
