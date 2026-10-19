"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";

import { FormField } from "@/components/comunes/FormField";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { MaterialDto } from "../dto";

const texto = (material: Pick<MaterialDto, "codigo" | "nombre">) => `${material.codigo} · ${material.nombre}`;

// Consulta la base con cada texto (250 ms de espera): cubre cualquier cantidad de materiales sin paginar a mano.
function useMateriales(consulta: string) {
  const [estado, setEstado] = useState<{ consulta: string | null; datos: MaterialDto[]; fallo: string }>({ consulta: null, datos: [], fallo: "" });
  useEffect(() => {
    const controlador = new AbortController();
    const espera = setTimeout(() => {
      fetch(`/api/v1/materiales?activo=true&porPagina=30&pagina=1&q=${encodeURIComponent(consulta)}`, { signal: controlador.signal })
        .then(async (resultado) => { if (!resultado.ok) throw new Error("No se pudieron cargar los materiales."); return resultado.json(); })
        .then((datos: { datos: MaterialDto[] }) => setEstado({ consulta, datos: datos.datos, fallo: "" }))
        .catch((causa) => { if (!controlador.signal.aborted) setEstado({ consulta, datos: [], fallo: causa.message ?? "No se pudieron cargar los materiales." }); });
    }, consulta ? 250 : 0);
    return () => { clearTimeout(espera); controlador.abort(); };
  }, [consulta]);
  return { ...estado, cargando: estado.consulta !== consulta };
}

// El material puede venir de la URL y no estar en la lista cargada: se consulta para mostrar su nombre.
function useNombreExterno(valor: string, conocido: boolean) {
  const [externo, setExterno] = useState<{ id: string; texto: string } | null>(null);
  useEffect(() => {
    if (!valor || conocido || externo?.id === valor) return;
    const controlador = new AbortController();
    fetch(`/api/v1/materiales/${valor}`, { signal: controlador.signal })
      .then((resultado) => (resultado.ok ? resultado.json() : null))
      .then((datos) => { if (datos?.datos) setExterno({ id: valor, texto: texto(datos.datos) }); })
      .catch(() => undefined);
    return () => controlador.abort();
  }, [valor, conocido, externo]);
  return externo?.id === valor ? externo.texto : null;
}

function ListaMateriales({ idLista, datos, valor, activo, alActivar, alElegir }: {
  idLista: string; datos: MaterialDto[]; valor: string; activo: number; alActivar: (indice: number) => void; alElegir: (material: MaterialDto) => void;
}) {
  return (
      <ul id={idLista} role="listbox" aria-label="Materiales" className="max-h-72 overflow-y-auto p-1">
        {datos.map((material, indice) => (
          <li key={material.id} id={`${idLista}-${material.id}`} role="option" aria-selected={material.id === valor}
            onMouseDown={(evento) => evento.preventDefault()} onClick={() => alElegir(material)} onMouseEnter={() => alActivar(indice)}
            className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm", indice === activo && "bg-slate-100")}>
            <Check aria-hidden="true" className={cn("size-4 shrink-0 text-primary", material.id !== valor && "invisible")} />
            <span className="min-w-0 flex-1 truncate">{material.nombre}</span>
            <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">{material.codigo}</span>
          </li>
        ))}
      </ul>
  );
}

/** Material con búsqueda: se escribe el nombre o el código y se elige de la lista. Teclado: flechas, Enter, Escape. */
export function SelectorMaterial({ id, valor, error, cambiar }: {
  id: string; valor: string; error?: string; cambiar: (material: MaterialDto | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(0);
  const [elegido, setElegido] = useState<MaterialDto | null>(null);
  const idLista = useId();
  const { datos, fallo, cargando } = useMateriales(q.trim());
  const enLista = datos.find((material) => material.id === valor) ?? (elegido?.id === valor ? elegido : undefined);
  const externo = useNombreExterno(valor, Boolean(enLista));
  const visible = enLista ? texto(enLista) : (externo ?? (valor ? "Material seleccionado" : null));

  function elegir(material: MaterialDto) { setElegido(material); cambiar(material); setAbierto(false); setQ(""); }
  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") { evento.preventDefault(); setActivo((indice) => Math.min(indice + 1, datos.length - 1)); }
    if (evento.key === "ArrowUp") { evento.preventDefault(); setActivo((indice) => Math.max(indice - 1, 0)); }
    if (evento.key === "Enter" && datos[activo]) { evento.preventDefault(); elegir(datos[activo]); }
  }

  return <FormField id={id} etiqueta="Material" requerido error={error}>{(atributos) =>
    <Popover open={abierto} onOpenChange={(siguiente) => { setAbierto(siguiente); setActivo(0); if (!siguiente) setQ(""); }}>
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={abierto} aria-haspopup="listbox" aria-controls={idLista} {...atributos}
          className="flex h-11 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive md:text-sm">
          <span className={cn("min-w-0 flex-1 truncate", !visible && "text-muted-foreground")}>{visible ?? "Buscar material por nombre o código"}</span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={q} onChange={(evento) => { setQ(evento.target.value); setActivo(0); }} onKeyDown={alTeclear}
            aria-label="Buscar material por nombre o código" aria-controls={idLista} aria-autocomplete="list"
            aria-activedescendant={datos[activo] ? `${idLista}-${datos[activo].id}` : undefined}
            placeholder="Nombre o código" className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <ListaMateriales idLista={idLista} datos={datos} valor={valor} activo={activo} alActivar={setActivo} alElegir={elegir} />
        {datos.length === 0 || fallo ? <p role="status" className={cn("border-t border-slate-100 px-4 py-3 text-sm", fallo ? "text-danger" : "text-muted-foreground")}>
          {fallo || (cargando ? "Buscando…" : "Sin coincidencias.")}</p> : null}
      </PopoverContent>
    </Popover>}
  </FormField>;
}
