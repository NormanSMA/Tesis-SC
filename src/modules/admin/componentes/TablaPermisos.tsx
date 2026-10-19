"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { PerfilCodigo } from "@/core/permisos";
import type { listarPermisos } from "@/modules/admin/permisos-service";
import { cn } from "@/lib/utils";

import { etiquetaRecurso, permisoProtegido } from "./interfaz";

export type MatrizDto = Awaited<ReturnType<typeof listarPermisos>>;
export type PropiedadesTablaPermisos = {
  datos: MatrizDto; seleccion: Record<string, string[]>;
  enviando: boolean; alCambiar: (perfil: PerfilCodigo, permiso: string) => void;
  /** Marca o desmarca todos los permisos del grupo para un perfil. Sin esta función no se muestra "Acceso total". */
  alCambiarGrupo?: (perfil: PerfilCodigo, permisos: string[], marcar: boolean) => void;
};

const OCULTA_EN_MOVIL = "max-md:hidden";

function SelectorPerfil({ datos, elegido, alElegir }: { datos: MatrizDto; elegido: string; alElegir: (codigo: PerfilCodigo) => void }) {
  return (
    <div role="group" aria-label="Perfil visible" className="flex flex-wrap gap-2 md:hidden">
      {datos.perfiles.map((perfil) => <Button key={perfil.codigo} type="button" size="sm" className="min-h-10 whitespace-normal"
        variant={perfil.codigo === elegido ? "default" : "outline"} aria-pressed={perfil.codigo === elegido}
        onClick={() => alElegir(perfil.codigo)}>{perfil.nombre}</Button>)}
    </div>
  );
}

function useDesborde() {
  const region = useRef<HTMLDivElement>(null);
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const elemento = region.current;
    if (!elemento) return;
    const medir = () => setDesborda(elemento.scrollWidth > elemento.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return { region, desborda };
}

type Grupo = MatrizDto["permisos"][number];

/** Fila de grupo: nombre plegable y un interruptor "Acceso total" por perfil. */
function FilaGrupo({ grupo, props, abierto, alPlegar, claseColumna }: {
  grupo: Grupo; props: PropiedadesTablaPermisos; abierto: boolean; alPlegar: () => void; claseColumna: (codigo: string) => string | undefined;
}) {
  const nombre = etiquetaRecurso(grupo.recurso);
  return <tr className="border-t bg-slate-50">
    <th scope="rowgroup" className="p-3 text-left font-semibold">
      <button type="button" aria-expanded={abierto} aria-label={`${abierto ? "Plegar" : "Desplegar"} permisos de ${nombre}`} onClick={alPlegar}
        className="mr-2 inline-flex size-8 items-center justify-center rounded-md align-middle text-muted-foreground hover:bg-slate-200/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform duration-150", !abierto && "-rotate-90")} />
      </button>{nombre}</th>
    {props.datos.perfiles.map((perfil) => {
      const editables = grupo.permisos.filter((permiso) => !permisoProtegido(perfil.codigo, permiso.codigo));
      const marcados = grupo.permisos.filter((permiso) => permisoProtegido(perfil.codigo, permiso.codigo)
        || (props.seleccion[perfil.codigo] ?? []).includes(permiso.codigo)).length;
      const total = editables.length > 0 && editables.every((permiso) => (props.seleccion[perfil.codigo] ?? []).includes(permiso.codigo));
      return <td key={perfil.codigo} className={cn("p-3 text-center", claseColumna(perfil.codigo))}>
        <span className="inline-flex items-center gap-2">
          <Switch size="sm" aria-label={`Acceso total del perfil ${perfil.codigo} en ${nombre}`}
            checked={editables.length === 0 ? marcados === grupo.permisos.length : total}
            disabled={!props.alCambiarGrupo || editables.length === 0 || props.enviando}
            onCheckedChange={(marcar) => props.alCambiarGrupo?.(perfil.codigo, editables.map((permiso) => permiso.codigo), marcar)} />
          <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">{marcados}/{grupo.permisos.length}</span>
        </span>
      </td>;
    })}
  </tr>;
}

export function TablaPermisos(props: PropiedadesTablaPermisos) {
  const [elegido, setElegido] = useState(props.datos.perfiles[0]?.codigo ?? "");
  const [plegados, setPlegados] = useState<string[]>([]);
  const { region, desborda } = useDesborde();
  const claseColumna = (codigo: string) => (codigo === elegido ? undefined : OCULTA_EN_MOVIL);
  const alPlegar = (recurso: string) => setPlegados((actual) => actual.includes(recurso) ? actual.filter((valor) => valor !== recurso) : [...actual, recurso]);
  return (
    <>
      <SelectorPerfil datos={props.datos} elegido={elegido} alElegir={setElegido} />
      {desborda ? <p className="text-sm text-muted-foreground max-md:hidden">Desplace la matriz horizontalmente para consultar todos los perfiles.</p> : null}
      <div ref={region} className="mb-4 max-w-full min-w-0 overflow-x-auto rounded-2xl border border-slate-200/80 bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
        role="region" aria-label="Matriz de perfiles y permisos" tabIndex={0}>
        <table className="w-full text-left text-sm md:min-w-[1200px]">
          <caption className="sr-only">Permisos agrupados por recurso. Guarde todos los cambios con el botón fijo inferior.</caption>
          <thead className="bg-muted">
            <tr><th scope="col" className="p-3 md:min-w-64">Recurso y permiso</th>{props.datos.perfiles.map((perfil) =>
              <th scope="col" key={perfil.codigo} className={cn("p-3 text-center md:min-w-44", claseColumna(perfil.codigo))}>{perfil.nombre}</th>)}
            </tr>
          </thead>
          <tbody>{props.datos.permisos.map((grupo) => {
            const abierto = !plegados.includes(grupo.recurso);
            return <Fragment key={grupo.recurso}>
              <FilaGrupo grupo={grupo} props={props} abierto={abierto} alPlegar={() => alPlegar(grupo.recurso)} claseColumna={claseColumna} />
              {abierto ? grupo.permisos.map((permiso) => <tr key={permiso.codigo} className="border-t border-border-subtle">
                <th scope="row" className="max-w-80 p-3 font-normal"><span className="block font-medium">{permiso.descripcion}</span><span className="block text-xs text-muted-foreground [overflow-wrap:anywhere] max-md:hidden">{permiso.codigo}</span></th>
                {props.datos.perfiles.map((perfil) => {
                  const protegido = permisoProtegido(perfil.codigo, permiso.codigo);
                  return <td key={perfil.codigo} className={cn("p-3 text-center", claseColumna(perfil.codigo))}>
                    <Checkbox className="relative after:absolute after:-inset-2.5 after:content-['']" aria-label={`Perfil ${perfil.codigo}: permiso ${permiso.codigo}`}
                      aria-describedby={protegido ? "permisos-protegidos" : undefined}
                      checked={protegido || (props.seleccion[perfil.codigo] ?? []).includes(permiso.codigo)}
                      disabled={protegido || props.enviando} onCheckedChange={() => props.alCambiar(perfil.codigo, permiso.codigo)} />
                  </td>;
                })}
              </tr>) : null}
            </Fragment>;
          })}</tbody>
        </table>
      </div>
    </>
  );
}
