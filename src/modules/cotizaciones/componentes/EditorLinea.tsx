"use client";

import { FormField } from "@/components/comunes/FormField";
import { Money } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import type { CamposError } from "@/lib/errores";
import type { EntradaLineaEditor } from "../schema";
import type { MaterialSelector } from "../tipos";
import { CampoSeleccion, CampoTexto } from "./CamposEditor";

type PropiedadesLinea = { linea: EntradaLineaEditor; prefijo: string; indice: number; materiales: MaterialSelector[];
  errores: CamposError; bloqueada: boolean; importe?: string; alCambiar: (linea: EntradaLineaEditor) => void; alQuitar: () => void };
const ETIQUETA = { MATERIAL: "Material", MANO_OBRA: "Mano de obra", TERCERO: "Tercero" };

function CamposMaterial({ linea, prefijo, materiales, errores, alCambiar }: PropiedadesLinea) {
  if (linea.tipo !== "MATERIAL") return null;
  const opciones = [{ id: "__manual__", nombre: "Captura manual" }, ...materiales.map((material) =>
    ({ id: material.id, nombre: `${material.codigo} · ${material.nombre}` }))];
  if (linea.materialId && !materiales.some((material) => material.id === linea.materialId)) {
    opciones.push({ id: linea.materialId, nombre: `${linea.descripcion} (archivado)` });
  }
  const seleccionar = (id: string) => {
    const material = materiales.find((registro) => registro.id === id);
    alCambiar({ ...linea, materialId: material?.id ?? null,
      descripcion: material?.nombre ?? linea.descripcion, unidad: material?.unidad ?? linea.unidad,
      costoUnitario: material?.costoPromedio ?? linea.costoUnitario });
  };
  return <>
    <CampoSeleccion id={`${prefijo}.materialId`} etiqueta="Material registrado" valor={linea.materialId ?? "__manual__"}
      opciones={opciones} error={errores[`${prefijo}.materialId`]} alCambiar={seleccionar} />
    <div className="grid gap-4 sm:grid-cols-3">
      <CampoTexto id={`${prefijo}.cantidad`} etiqueta="Cantidad total consumida" decimal requerido valor={linea.cantidad}
        error={errores[`${prefijo}.cantidad`]} alCambiar={(cantidad) => alCambiar({ ...linea, cantidad })} />
      <CampoTexto id={`${prefijo}.costoUnitario`} etiqueta="Costo unitario (C$)" decimal requerido valor={linea.costoUnitario ?? ""}
        deshabilitado={Boolean(linea.materialId)} ayuda={linea.materialId ? "Lo fija el inventario." : undefined}
        error={errores[`${prefijo}.costoUnitario`]} alCambiar={(costoUnitario) => alCambiar({ ...linea, costoUnitario })} />
      <CampoTexto id={`${prefijo}.mermaPct`} etiqueta="Merma (%)" decimal requerido valor={linea.mermaPct}
        error={errores[`${prefijo}.mermaPct`]} alCambiar={(mermaPct) => alCambiar({ ...linea, mermaPct })} />
    </div>
  </>;
}

function CamposTrabajo({ linea, prefijo, errores, alCambiar }: PropiedadesLinea) {
  if (linea.tipo === "MATERIAL") return null;
  if (linea.tipo === "TERCERO") return <CampoTexto id={`${prefijo}.costo`} etiqueta="Costo total del tercero (C$)" decimal requerido
    valor={linea.costo} error={errores[`${prefijo}.costo`]} alCambiar={(costo) => alCambiar({ ...linea, costo })} />;
  return <div className="grid gap-4 sm:grid-cols-2">
    <CampoTexto id={`${prefijo}.horas`} etiqueta="Horas totales del ítem" decimal requerido valor={linea.horas}
      error={errores[`${prefijo}.horas`]} alCambiar={(horas) => alCambiar({ ...linea, horas })} />
    <CampoTexto id={`${prefijo}.tarifa`} etiqueta="Tarifa por hora (C$)" decimal requerido valor={linea.tarifa}
      error={errores[`${prefijo}.tarifa`]} alCambiar={(tarifa) => alCambiar({ ...linea, tarifa })} />
  </div>;
}

export function EditorLinea(propiedades: PropiedadesLinea) {
  const { linea, prefijo, indice, errores, bloqueada, alCambiar } = propiedades;
  return <fieldset disabled={bloqueada} className="min-w-0 space-y-4 rounded-md border p-4">
    <legend className="px-2 text-base font-semibold">Línea {indice + 1}: {ETIQUETA[linea.tipo]}</legend>
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto id={`${prefijo}.descripcion`} etiqueta="Descripción de costo" requerido valor={linea.descripcion}
        error={errores[`${prefijo}.descripcion`]} alCambiar={(descripcion) => alCambiar({ ...linea, descripcion })} />
      <CampoTexto id={`${prefijo}.unidad`} etiqueta="Unidad de costo" requerido valor={linea.unidad}
        error={errores[`${prefijo}.unidad`]} alCambiar={(unidad) => alCambiar({ ...linea, unidad })} />
    </div>
    <CamposMaterial {...propiedades} /><CamposTrabajo {...propiedades} />
    <FormField id={`${prefijo}.importe`} etiqueta="Importe de línea" error={errores[`${prefijo}.importe`]}>
      {(atributos) => <output {...atributos} aria-live="off"><Money valor={propiedades.importe} /></output>}
    </FormField>
    <Button type="button" variant="outline" onClick={propiedades.alQuitar}
      aria-label={`Quitar línea ${indice + 1}: ${ETIQUETA[linea.tipo]}`}>Quitar línea</Button>
  </fieldset>;
}
