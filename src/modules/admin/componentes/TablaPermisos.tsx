"use client";

import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PerfilCodigo } from "@/core/permisos";
import type { listarPermisos } from "@/modules/admin/permisos-service";

import { diferenciasPermisos, permisoProtegido } from "./interfaz";

export type MatrizDto = Awaited<ReturnType<typeof listarPermisos>>;
export type PropiedadesTablaPermisos = {
  datos: MatrizDto; seleccion: Record<string, string[]>; guardados: Record<string, string[]>;
  enviando: boolean; alCambiar: (perfil: PerfilCodigo, permiso: string) => void; alGuardar: (perfil: PerfilCodigo) => void;
};

function EncabezadoPermisos(props: PropiedadesTablaPermisos) {
  return (
    <thead className="bg-muted">
      <tr><th scope="col" className="p-3">Recurso y permiso</th>{props.datos.perfiles.map((perfil) => {
        const diferencia = diferenciasPermisos(props.guardados[perfil.codigo] ?? [], props.seleccion[perfil.codigo] ?? []);
        return <th scope="col" key={perfil.codigo} className="min-w-44 p-3 text-center">
          <span className="block">{perfil.nombre}</span>
          <Button type="button" variant="outline" className="mt-3 min-h-10 whitespace-normal"
            aria-label={`Guardar cambios de ${perfil.nombre}`} disabled={props.enviando || !(diferencia.altas.length + diferencia.bajas.length)}
            onClick={() => props.alGuardar(perfil.codigo)}>Guardar cambios</Button>
        </th>;
      })}</tr>
    </thead>
  );
}

export function TablaPermisos(props: PropiedadesTablaPermisos) {
  return (
    <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-ring"
      role="region" aria-label="Matriz de perfiles y permisos" tabIndex={0}>
      <table className="w-full min-w-[1200px] text-left text-sm">
        <caption className="sr-only">Permisos agrupados por recurso. Guarde cada perfil por separado.</caption>
        <EncabezadoPermisos {...props} />
        <tbody>{props.datos.permisos.map((grupo) => <Fragment key={grupo.recurso}>
          <tr className="border-t bg-muted/50"><th colSpan={props.datos.perfiles.length + 1} scope="rowgroup" className="p-3 font-semibold">{grupo.recurso}</th></tr>
          {grupo.permisos.map((permiso) => <tr key={permiso.codigo} className="border-t">
            <th scope="row" className="max-w-80 p-3 font-normal"><span className="block font-medium">{permiso.descripcion}</span><span className="text-muted-foreground">{permiso.codigo}</span></th>
            {props.datos.perfiles.map((perfil) => {
              const protegido = permisoProtegido(perfil.codigo, permiso.codigo);
              return <td key={perfil.codigo} className="p-3 text-center">
                <Checkbox className="size-10" aria-label={`Perfil ${perfil.codigo}: permiso ${permiso.codigo}`}
                  aria-describedby={protegido ? "permisos-protegidos" : undefined}
                  checked={protegido || (props.seleccion[perfil.codigo] ?? []).includes(permiso.codigo)}
                  disabled={protegido || props.enviando} onCheckedChange={() => props.alCambiar(perfil.codigo, permiso.codigo)} />
              </td>;
            })}
          </tr>)}
        </Fragment>)}</tbody>
      </table>
    </div>
  );
}
