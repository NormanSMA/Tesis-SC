"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PerfilCodigo } from "@/core/permisos";
import type { listarPermisos } from "@/modules/admin/permisos-service";
import { cn } from "@/lib/utils";

import { etiquetaRecurso, permisoProtegido } from "./interfaz";

export type MatrizDto = Awaited<ReturnType<typeof listarPermisos>>;
export type PropiedadesTablaPermisos = {
  datos: MatrizDto; seleccion: Record<string, string[]>;
  enviando: boolean; alCambiar: (perfil: PerfilCodigo, permiso: string) => void;
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

export function TablaPermisos(props: PropiedadesTablaPermisos) {
  const [elegido, setElegido] = useState(props.datos.perfiles[0]?.codigo ?? "");
  const { region, desborda } = useDesborde();
  const claseColumna = (codigo: string) => (codigo === elegido ? undefined : OCULTA_EN_MOVIL);
  return (
    <>
      <SelectorPerfil datos={props.datos} elegido={elegido} alElegir={setElegido} />
      {desborda ? <p className="text-sm text-muted-foreground max-md:hidden">Desplace la matriz horizontalmente para consultar todos los perfiles.</p> : null}
      <div ref={region} className="mb-4 max-w-full min-w-0 overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-ring"
        role="region" aria-label="Matriz de perfiles y permisos" tabIndex={0}>
        <table className="w-full text-left text-sm md:min-w-[1200px]">
          <caption className="sr-only">Permisos agrupados por recurso. Guarde todos los cambios con el botón fijo inferior.</caption>
          <thead className="bg-muted">
            <tr><th scope="col" className="p-3">Recurso y permiso</th>{props.datos.perfiles.map((perfil) =>
              <th scope="col" key={perfil.codigo} className={cn("p-3 text-center md:min-w-44", claseColumna(perfil.codigo))}>{perfil.nombre}</th>)}
            </tr>
          </thead>
          <tbody>{props.datos.permisos.map((grupo) => <Fragment key={grupo.recurso}>
            <tr className="border-t bg-muted/50"><th colSpan={props.datos.perfiles.length + 1} scope="rowgroup" className="p-3 font-semibold">{etiquetaRecurso(grupo.recurso)}</th></tr>
            {grupo.permisos.map((permiso) => <tr key={permiso.codigo} className="border-t">
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
            </tr>)}
          </Fragment>)}</tbody>
        </table>
      </div>
    </>
  );
}
