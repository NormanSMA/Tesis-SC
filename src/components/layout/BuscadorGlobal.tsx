"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClienteFila } from "@/modules/clientes/tipos";
import type { CotizacionFila } from "@/modules/cotizaciones/tipos";
import type { OrdenFila } from "@/modules/ordenes/tipos";

type Propiedades = { permisos: string[]; modo: "amplio" | "icono" };
type Resultado = { id: string; codigo: string; nombre: string; destino: string };
type Grupo = { titulo: string; resultados: Resultado[]; fallo: boolean };
type Recurso = "clientes" | "cotizaciones" | "ordenes";
const RECURSOS: { recurso: Recurso; permiso: string; titulo: string }[] = [
  { recurso: "clientes", permiso: "cliente:ver", titulo: "Clientes" },
  { recurso: "cotizaciones", permiso: "cotizacion:ver", titulo: "Cotizaciones" },
  { recurso: "ordenes", permiso: "orden:ver", titulo: "Órdenes" },
];

async function buscarGrupo(entrada: { recurso: Recurso; titulo: string; consulta: string; signal: AbortSignal }): Promise<Grupo> {
  const { recurso, titulo, consulta, signal } = entrada;
  try {
    const parametros = new URLSearchParams({ q: consulta, porPagina: "5" });
    const respuesta = await fetch(`/api/v1/${recurso}?${parametros}`, { signal, cache: "no-store" });
    if (!respuesta.ok) throw new Error("No se pudo completar la búsqueda.");
    const cuerpo: { datos: (ClienteFila | CotizacionFila | OrdenFila)[] } = await respuesta.json();
    const resultados = cuerpo.datos.map((fila) => ({
      id: fila.id, destino: `/${recurso}/${encodeURIComponent(fila.id)}`,
      codigo: "codigoCliente" in fila ? fila.codigoCliente : fila.numero,
      nombre: "nombre" in fila ? fila.nombre : fila.cliente.nombre,
    }));
    return { titulo, resultados, fallo: false };
  } catch {
    return { titulo, resultados: [], fallo: true };
  }
}

function useBusqueda(consulta: string, permisos: string[]) {
  const clave = RECURSOS.filter(({ permiso }) => permisos.includes(permiso)).map(({ recurso }) => recurso).join(",");
  const [respuesta, establecerRespuesta] = useState({ consulta: "", clave: "", grupos: [] as Grupo[] });
  useEffect(() => {
    if (consulta.length < 2) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      const grupos = await Promise.all(RECURSOS.filter(({ recurso }) => clave.split(",").includes(recurso))
        .map(({ recurso, titulo }) => buscarGrupo({ recurso, titulo, consulta, signal: controlador.signal })));
      if (!controlador.signal.aborted) establecerRespuesta({ consulta, clave, grupos });
    }, 250);
    return () => { window.clearTimeout(temporizador); controlador.abort(); };
  }, [consulta, clave]);
  const cargando = consulta.length >= 2 && (respuesta.consulta !== consulta || respuesta.clave !== clave);
  return { cargando, grupos: consulta.length < 2 || cargando ? [] : respuesta.grupos };
}

function EstadoBusqueda({ consulta, cargando, grupos }: { consulta: string; cargando: boolean; grupos: Grupo[] }) {
  if (consulta.length < 2) return <p className="p-6 text-center text-sm text-slate-500">Escriba al menos 2 caracteres</p>;
  if (cargando) return (
    <div role="status" className="space-y-3 p-4">
      <span className="sr-only">Buscando</span>
      {[0, 1, 2].map((indice) => <Skeleton key={indice} className="h-9 rounded-lg bg-slate-100 motion-reduce:animate-none" aria-hidden="true" />)}
    </div>
  );
  if (grupos.some(({ fallo }) => fallo)) return (
    <p role="status" className="px-4 py-3 text-sm text-slate-500">No se pudieron consultar algunos módulos.</p>
  );
  if (grupos.every(({ resultados }) => resultados.length === 0)) return (
    <p role="status" className="p-6 text-center text-sm text-slate-500">Sin resultados</p>
  );
  return null;
}

function ListaResultados(entrada: {
  grupos: Grupo[]; listaId: string; activo?: string; seleccionar: (id: string) => void; cerrar: () => void;
}) {
  const { grupos, listaId, activo, seleccionar, cerrar } = entrada;
  return (
    <div id={listaId} role="listbox" aria-label="Resultados de búsqueda" className="max-h-[50vh] overflow-y-auto p-2">
      {grupos.filter(({ resultados }) => resultados.length > 0).map(({ titulo, resultados }, indice) => (
        <div key={titulo} role="group" aria-labelledby={`${listaId}-grupo-${indice}`}>
          <h3 id={`${listaId}-grupo-${indice}`} className="px-3 py-2 text-xs font-medium text-slate-500">{titulo}</h3>
          {resultados.map((fila) => {
            const id = `${listaId}-${fila.destino}`;
            return (
              <Link key={fila.id} id={id} href={fila.destino} role="option" aria-selected={activo === id}
                tabIndex={-1} prefetch={false} onClick={cerrar} onMouseEnter={() => seleccionar(id)}
                className={`flex gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500 ${activo === id ? "bg-slate-100" : ""}`}>
                <strong className="shrink-0 font-semibold text-slate-900">{fila.codigo}</strong>
                <span className="truncate text-slate-500">{fila.nombre}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function useSeleccion(entrada: { filas: Resultado[]; listaId: string; cerrar: () => void }) {
  const { filas, listaId, cerrar } = entrada;
  const router = useRouter();
  const [seleccion, seleccionar] = useState(0);
  const indice = Math.min(seleccion, Math.max(0, filas.length - 1));
  const fila = filas[indice];
  const activo = fila ? `${listaId}-${fila.destino}` : undefined;
  useEffect(() => { if (activo) document.getElementById(activo)?.scrollIntoView({ block: "nearest" }); }, [activo]);
  function manejarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.nativeEvent.isComposing || filas.length === 0) return;
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      seleccionar((indice + (evento.key === "ArrowDown" ? 1 : filas.length - 1)) % filas.length);
    }
    if (evento.key === "Enter" && fila) {
      evento.preventDefault();
      router.push(fila.destino);
      cerrar();
    }
  }
  return { activo, manejarTecla, reiniciar: () => seleccionar(0),
    seleccionar: (id: string) => seleccionar(filas.findIndex((fila) => `${listaId}-${fila.destino}` === id)) };
}

function ContenidoBusqueda({ permisos, cerrar }: { permisos: string[]; cerrar: () => void }) {
  const [texto, establecerTexto] = useState("");
  const consulta = texto.trim();
  const listaId = useId();
  const { cargando, grupos } = useBusqueda(consulta, permisos);
  const filas = grupos.flatMap(({ resultados }) => resultados);
  const seleccion = useSeleccion({ filas, listaId, cerrar });
  return (
    <>
      <DialogTitle className="sr-only">Buscar en TRACORE</DialogTitle>
      <DialogDescription className="sr-only">Busque clientes, cotizaciones y órdenes mediante su código o nombre.</DialogDescription>
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 pr-12">
        <Search className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
        <input value={texto} onChange={(evento) => { establecerTexto(evento.target.value); seleccion.reiniciar(); }}
          onKeyDown={seleccion.manejarTecla} placeholder="Buscar en TRACORE" aria-label="Buscar en TRACORE"
          role="combobox" aria-expanded="true" aria-controls={listaId} aria-autocomplete="list"
          aria-activedescendant={seleccion.activo} autoComplete="off" maxLength={200}
          className="h-10 min-w-0 flex-1 rounded text-lg text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-slate-400" />
      </div>
      <EstadoBusqueda consulta={consulta} cargando={cargando} grupos={grupos} />
      <ListaResultados grupos={grupos} listaId={listaId} activo={seleccion.activo}
        seleccionar={seleccion.seleccionar} cerrar={cerrar} />
      {filas.length > 0 && <p role="status" className="sr-only">{filas.length} resultados</p>}
    </>
  );
}

// atajo: solo una instancia visible escucha Ctrl+K (el menú puede montar la versión de riel y la ancha a la vez).
export function BuscadorGlobal({ permisos, modo, atajo = true }: Propiedades & { atajo?: boolean }) {
  const [abierto, establecerAbierto] = useState(false);
  useEffect(() => {
    if (!atajo) return;
    function abrirConTeclado(evento: globalThis.KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        establecerAbierto(true);
      }
    }
    window.addEventListener("keydown", abrirConTeclado);
    return () => window.removeEventListener("keydown", abrirConTeclado);
  }, [atajo]);
  return (
    <Dialog open={abierto} onOpenChange={establecerAbierto}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Buscar en TRACORE" title="Buscar"
          className={`flex items-center rounded-xl border border-slate-200 bg-card text-sm text-slate-600 shadow-xs transition-colors duration-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-ring ${modo === "amplio" ? "h-10 w-full gap-2 px-3" : "size-10 justify-center"}`}>
          <Search className="size-4" aria-hidden="true" />
          {modo === "amplio" && <><span>Buscar</span><kbd aria-hidden="true" className="ml-auto hidden rounded-md border border-slate-200 bg-card px-1.5 text-[11px] text-slate-500 [@media(pointer:fine)]:inline">Ctrl K</kbd></>}
        </button>
      </DialogTrigger>
      <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-xl bg-white p-0 sm:max-w-xl [&>button]:transition-[opacity,transform] [&>button]:duration-150 motion-reduce:animate-none">
        <ContenidoBusqueda permisos={permisos} cerrar={() => establecerAbierto(false)} />
      </DialogContent>
    </Dialog>
  );
}
