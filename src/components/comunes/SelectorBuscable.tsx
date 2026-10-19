"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { cn } from "@/lib/utils";

export type OpcionBuscable = { id: string; nombre: string; /** Código u otro dato corto a la derecha; también se busca. */ detalle?: string };

type PropiedadesSelector = {
  id: string;
  valor: string;
  opciones: OpcionBuscable[];
  alCambiar: (id: string) => void;
  /** Texto de la búsqueda, ej. "Buscar cliente". */
  marcador: string;
  /** Texto atenuado cuando no hay valor elegido (formularios). Sin él se muestra la primera opción. */
  vacio?: string;
  /** aria-describedby, aria-invalid y aria-required que entrega FormField. */
  atributos?: { "aria-describedby"?: string; "aria-invalid"?: true; "aria-required"?: true };
  deshabilitado?: boolean;
  className?: string;
};

/** A partir de cuántas opciones un campo de datos pasa de lista simple a lista con búsqueda. */
export const OPCIONES_PARA_BUSCAR = 7;

const MAXIMO_RESULTADOS = 60;
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * Lista desplegable en la que también se escribe para filtrar. Para elegir datos (clientes, materiales,
 * usuarios, órdenes, áreas); los estados cortos siguen en Select o pastillas. Teclado: flechas, Enter, Escape.
 */
export function SelectorBuscable({ id, valor, opciones, alCambiar, marcador, vacio, atributos, deshabilitado, className }: PropiedadesSelector) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const idLista = useId();
  const resultados = useMemo(() => {
    const busqueda = normalizar(texto);
    const filtradas = busqueda ? opciones.filter(({ nombre, detalle }) => normalizar(`${nombre} ${detalle ?? ""}`).includes(busqueda)) : opciones;
    return filtradas.slice(0, MAXIMO_RESULTADOS);
  }, [opciones, texto]);
  const elegida = opciones.find((opcion) => opcion.id === valor);

  function elegir(opcion: OpcionBuscable) { alCambiar(opcion.id); setAbierto(false); setTexto(""); }
  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") { evento.preventDefault(); setActivo((indice) => Math.min(indice + 1, resultados.length - 1)); }
    if (evento.key === "ArrowUp") { evento.preventDefault(); setActivo((indice) => Math.max(indice - 1, 0)); }
    if (evento.key === "Enter" && resultados[activo]) { evento.preventDefault(); elegir(resultados[activo]); }
  }

  return (
    <Popover open={abierto} onOpenChange={(siguiente) => { setAbierto(siguiente); setActivo(0); if (!siguiente) setTexto(""); }}>
      <PopoverTrigger asChild>
        <button id={id} type="button" role="combobox" aria-expanded={abierto} aria-haspopup="listbox" aria-controls={idLista} disabled={deshabilitado} {...atributos}
          className={cn("flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className)}>
          <span className={cn("min-w-0 flex-1 truncate", !elegida && vacio && "text-muted-foreground")}>{elegida?.nombre ?? vacio ?? opciones[0]?.nombre}</span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[max(var(--radix-popover-trigger-width),22rem)] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={texto} onChange={(evento) => { setTexto(evento.target.value); setActivo(0); }} onKeyDown={alTeclear}
            aria-label={marcador} aria-controls={idLista} aria-autocomplete="list"
            aria-activedescendant={resultados[activo] ? `${idLista}-${activo}` : undefined}
            placeholder={`${marcador}…`} className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <ul id={idLista} role="listbox" aria-label={marcador} className="max-h-72 overflow-y-auto p-1">
          {resultados.map((opcion, indice) => (
            <li key={opcion.id} id={`${idLista}-${indice}`} role="option" aria-selected={opcion.id === valor}
              onMouseDown={(evento) => evento.preventDefault()} onClick={() => elegir(opcion)} onMouseEnter={() => setActivo(indice)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm", indice === activo && "bg-slate-100")}>
              <Check aria-hidden="true" className={cn("size-4 shrink-0 text-primary", opcion.id !== valor && "invisible")} />
              <span className="min-w-0 flex-1 truncate">{opcion.nombre}</span>
              {opcion.detalle ? <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">{opcion.detalle}</span> : null}
            </li>
          ))}
        </ul>
        {resultados.length === 0 ? <p role="status" className="border-t border-slate-100 px-4 py-3 text-sm text-muted-foreground">Sin coincidencias.</p> : null}
      </PopoverContent>
    </Popover>
  );
}

type PropiedadesFiltro = {
  etiqueta: string;
  parametro: string;
  opciones: OpcionBuscable[];
  /** Primera opción, que quita el parámetro de la URL. */
  textoTodos?: string;
  /** Valor interno de la opción "todos"; "" por defecto. */
  valorTodos?: string;
  marcador?: string;
  className?: string;
};

/** Filtro de "Más filtros" con búsqueda. El valor vive en la URL; la opción "Todos" lo quita y vuelve a la página 1. */
export function FiltroBuscable({ etiqueta, parametro, opciones, textoTodos = "Todos", valorTodos = "__todos__", marcador, className }: PropiedadesFiltro) {
  const { parametros, navegar } = useParametrosUrl();
  const id = useId();
  const todas = useMemo(() => [{ id: valorTodos, nombre: textoTodos }, ...opciones], [opciones, textoTodos, valorTodos]);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">{etiqueta}</label>
      <SelectorBuscable id={id} valor={parametros.get(parametro) ?? valorTodos} opciones={todas}
        alCambiar={(valor) => navegar({ [parametro]: valor === valorTodos ? null : valor })}
        marcador={marcador ?? `Buscar ${etiqueta.toLowerCase()}`} />
    </div>
  );
}
