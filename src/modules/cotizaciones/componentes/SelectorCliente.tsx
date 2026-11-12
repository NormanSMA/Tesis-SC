"use client";

import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";

import type { AtributosCampo } from "@/components/comunes/FormField";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OpcionCliente = { id: string; nombre: string; detalle?: string };

type Propiedades = {
  atributos: AtributosCampo;
  valor: string;
  /** Identidad del cliente preseleccionado o recién creado. */
  opciones: OpcionCliente[];
  alCambiar: (id: string) => void;
  /** Sin coincidencias: ofrece crear el cliente con el texto escrito. */
  alCrear?: (nombre: string) => void;
};

function useClientesRemotos(texto: string): { remotos: OpcionCliente[]; cargando: boolean } {
  const [estado, setEstado] = useState<{ consulta: string; remotos: OpcionCliente[] }>({ consulta: "", remotos: [] });
  const consulta = texto.trim();
  useEffect(() => {
    if (!consulta) return;
    const controlador = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const respuesta = await fetch(`/api/v1/cotizaciones/clientes?q=${encodeURIComponent(consulta)}`, { signal: controlador.signal });
        if (!respuesta.ok) throw new Error("Búsqueda de clientes");
        const cuerpo = await respuesta.json() as { datos: { id: string; nombre: string; codigoCliente: string }[] };
        if (!controlador.signal.aborted) {
          setEstado({ consulta, remotos: cuerpo.datos.map(({ id, nombre, codigoCliente }) => ({ id, nombre, detalle: codigoCliente })) });
        }
      } catch {
        if (!controlador.signal.aborted) setEstado({ consulta, remotos: [] });
      }
    }, 250);
    return () => { clearTimeout(espera); controlador.abort(); };
  }, [consulta]);
  const vigente = Boolean(consulta) && estado.consulta === consulta;
  return { remotos: vigente ? estado.remotos : [], cargando: Boolean(consulta) && !vigente };
}

function ListaResultados({ idLista, resultados, valor, activo, alActivar, alElegir }: {
  idLista: string; resultados: OpcionCliente[]; valor: string; activo: number;
  alActivar: (indice: number) => void; alElegir: (opcion: OpcionCliente) => void;
}) {
  return (
    <ul id={idLista} role="listbox" aria-label="Clientes" className="max-h-72 overflow-y-auto p-1">
      {resultados.map((opcion, indice) => (
        <li key={opcion.id} id={`${idLista}-${opcion.id}`} role="option" aria-selected={opcion.id === valor}
          onMouseDown={(evento) => evento.preventDefault()} onClick={() => alElegir(opcion)} onMouseEnter={() => alActivar(indice)}
          className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm", indice === activo && "bg-slate-100")}>
          <Check aria-hidden="true" className={cn("size-4 shrink-0 text-primary", opcion.id !== valor && "invisible")} />
          <span className="min-w-0 flex-1 truncate">{opcion.nombre}</span>
          {/* El código va aria-hidden: el nombre accesible de la opción es solo el nombre del cliente. */}
          {opcion.detalle ? <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">{opcion.detalle}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function SinCoincidencias({ cargando, texto, alCrear }: { cargando: boolean; texto: string; alCrear?: (nombre: string) => void }) {
  return (
    <div className="border-t border-slate-100 p-2" role="status">
      <p className="px-2 py-1.5 text-sm text-muted-foreground">{cargando ? "Buscando…" : texto ? "Sin coincidencias." : "Escriba el nombre del cliente."}</p>
      {alCrear && texto && !cargando ? (
        <button type="button" onClick={() => alCrear(texto)}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-primary hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-ring">
          <Plus aria-hidden="true" className="size-4" />Crear cliente «{texto}»
        </button>
      ) : null}
    </div>
  );
}

/** Búsqueda por nombre con navegación por teclado. */
export function SelectorCliente({ atributos, valor, opciones, alCambiar, alCrear }: Propiedades) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const [elegidos, setElegidos] = useState<Record<string, string>>({});
  const idLista = useId();
  const { remotos: resultados, cargando } = useClientesRemotos(texto);
  const nombreElegido = opciones.find(({ id }) => id === valor)?.nombre ?? elegidos[valor];

  function elegir(opcion: OpcionCliente) {
    setElegidos((previos) => ({ ...previos, [opcion.id]: opcion.nombre }));
    alCambiar(opcion.id); setAbierto(false); setTexto("");
  }
  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") { evento.preventDefault(); setActivo((indice) => Math.min(indice + 1, resultados.length - 1)); }
    if (evento.key === "ArrowUp") { evento.preventDefault(); setActivo((indice) => Math.max(indice - 1, 0)); }
    if (evento.key === "Enter" && resultados[activo]) { evento.preventDefault(); elegir(resultados[activo]); }
  }

  return (
    <Popover open={abierto} onOpenChange={(valorAbierto) => { setAbierto(valorAbierto); setActivo(0); if (!valorAbierto) setTexto(""); }}>
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={abierto} aria-haspopup="listbox" aria-controls={idLista} {...atributos}
          className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive">
          <span className={cn("min-w-0 flex-1 truncate", !nombreElegido && "text-muted-foreground")}>{nombreElegido ?? "Buscar cliente…"}</span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input autoFocus maxLength={200} value={texto} onChange={(evento) => { setTexto(evento.target.value); setActivo(0); }} onKeyDown={alTeclear}
            aria-label="Buscar cliente por nombre" aria-controls={idLista} aria-autocomplete="list"
            aria-activedescendant={resultados[activo] ? `${idLista}-${resultados[activo].id}` : undefined}
            placeholder="Escriba el nombre" className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <ListaResultados idLista={idLista} resultados={resultados} valor={valor} activo={activo} alActivar={setActivo} alElegir={elegir} />
        {resultados.length === 0 ? (
          <SinCoincidencias cargando={cargando} texto={texto.trim()}
            alCrear={alCrear ? (nombre) => { setAbierto(false); alCrear(nombre); setTexto(""); } : undefined} />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
