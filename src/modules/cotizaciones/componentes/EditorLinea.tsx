"use client";

import { memo } from "react";
import { useController, type UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/comunes/FormField";
import { Money } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import type { Moneda } from "@/core/moneda";
import type { CamposError } from "@/lib/errores";
import { faltaTarifaMaterial, MENSAJE_AREA_MATERIAL, MENSAJE_TARIFA_MATERIAL, modalidadMaterial } from "../materiales";
import { simboloMoneda } from "../moneda";
import type { EntradaLineaEditor, EntradaReemplazarItems } from "../schema";
import type { LineaDto, MaterialSelector } from "../tipos";
import { CampoSeleccion, CampoTexto } from "./CamposEditor";

type PropiedadesLinea = { moneda: Moneda; linea: EntradaLineaEditor; prefijo: string; indice: number; materiales: MaterialSelector[];
  errores: CamposError; bloqueada: boolean; importe?: string; areaPartida?: string | null; medirMaterial: boolean; guardada?: LineaDto;
  alCambiar: (linea: EntradaLineaEditor) => void; alQuitar: () => void };
const ETIQUETA = { MATERIAL: "Material", MANO_OBRA: "Mano de obra", TERCERO: "Tercero" };

function CamposMaterial({ moneda, linea, prefijo, materiales, errores, alCambiar, areaPartida, medirMaterial, guardada, bloqueada }: PropiedadesLinea) {
  if (linea.tipo !== "MATERIAL") return null;
  const opciones = [{ id: "__manual__", nombre: "Captura manual" }, ...materiales.map((material) =>
    ({ id: material.id, nombre: `${material.codigo} · ${material.nombre}` }))];
  if (linea.materialId && !materiales.some((material) => material.id === linea.materialId)) {
    opciones.push({ id: linea.materialId, nombre: `${linea.descripcion} (archivado)` });
  }
  const seleccionar = (id: string) => {
    const material = materiales.find((registro) => registro.id === id);
    alCambiar({ ...linea, materialId: material?.id ?? null,
      descripcion: material?.nombre ?? linea.descripcion, unidad: material?.unidadCotizacion ?? material?.unidad ?? linea.unidad,
      costoUnitario: material?.precioCotizacion ?? material?.costoPromedio ?? linea.costoUnitario });
  };
  const material = materiales.find(({ id }) => id === linea.materialId);
  const historial = guardada?.materialId === linea.materialId ? guardada : undefined;
  const conservar = historial && (bloqueada || !material);
  const modo = conservar ? historial.cantidadPorArea ? "AREA" : "CANTIDAD" : modalidadMaterial(material, medirMaterial);
  const porArea = modo !== "CANTIDAD";
  const costo = conservar ? linea.costoUnitario : material?.precioCotizacion ?? material?.costoPromedio ?? linea.costoUnitario;
  const pendiente = Boolean(linea.materialId && faltaTarifaMaterial(costo));
  return <>
    <CampoSeleccion id={`${prefijo}.materialId`} etiqueta="Material registrado" valor={linea.materialId ?? "__manual__"}
      opciones={opciones} error={errores[`${prefijo}.materialId`]} alCambiar={seleccionar} />
    {modo === "FALTA_AREA" ? <p className="text-sm text-muted-foreground">{MENSAJE_AREA_MATERIAL}</p> : null}
    {pendiente ? <p className="text-sm text-danger">{MENSAJE_TARIFA_MATERIAL}</p> : null}
    <div className="grid gap-4 sm:grid-cols-3">
      <CampoTexto id={`${prefijo}.cantidad`} etiqueta="Cantidad total consumida" decimal requerido
        valor={porArea ? areaPartida ?? "" : linea.cantidad} deshabilitado={porArea}
        ayuda={porArea ? "m² calculados con el ancho, el alto y la cantidad de piezas de la partida." : undefined}
        error={errores[`${prefijo}.cantidad`]} alCambiar={(cantidad) => alCambiar({ ...linea, cantidad })} />
      <CampoTexto id={`${prefijo}.costoUnitario`} etiqueta={`Costo unitario (${simboloMoneda(moneda)})`} decimal requerido valor={modo === "FALTA_AREA" || pendiente ? "" : costo ?? ""}
        deshabilitado={Boolean(linea.materialId)} ayuda={porArea ? "Precio de cotización por m²." : linea.materialId ? "Precio de cotización del material." : undefined}
        error={errores[`${prefijo}.costoUnitario`]} alCambiar={(costoUnitario) => alCambiar({ ...linea, costoUnitario })} />
      <CampoTexto id={`${prefijo}.mermaPct`} etiqueta="Merma (%)" decimal requerido valor={linea.mermaPct}
        error={errores[`${prefijo}.mermaPct`]} alCambiar={(mermaPct) => alCambiar({ ...linea, mermaPct })} />
    </div>
  </>;
}

function CamposTrabajo({ moneda, linea, prefijo, errores, alCambiar }: PropiedadesLinea) {
  if (linea.tipo === "MATERIAL") return null;
  if (linea.tipo === "TERCERO") return <CampoTexto id={`${prefijo}.costo`} etiqueta={`Costo total del tercero (${simboloMoneda(moneda)})`} decimal requerido
    valor={linea.costo} error={errores[`${prefijo}.costo`]} alCambiar={(costo) => alCambiar({ ...linea, costo })} />;
  return <div className="grid gap-4 sm:grid-cols-2">
    <CampoTexto id={`${prefijo}.horas`} etiqueta="Horas totales del ítem" decimal requerido valor={linea.horas}
      error={errores[`${prefijo}.horas`]} alCambiar={(horas) => alCambiar({ ...linea, horas })} />
    <CampoTexto id={`${prefijo}.tarifa`} etiqueta={`Tarifa por hora (${simboloMoneda(moneda)})`} decimal requerido valor={linea.tarifa}
      error={errores[`${prefijo}.tarifa`]} alCambiar={(tarifa) => alCambiar({ ...linea, tarifa })} />
  </div>;
}

function ContenidoLinea(propiedades: PropiedadesLinea) {
  const { linea, prefijo, indice, errores, bloqueada, alCambiar } = propiedades;
  const material = linea.tipo === "MATERIAL" ? propiedades.materiales.find(({ id }) => id === linea.materialId) : undefined;
  const historial = linea.tipo === "MATERIAL" && propiedades.guardada?.materialId === linea.materialId ? propiedades.guardada : undefined;
  const enMetros = historial && (bloqueada || !material) ? historial.cantidadPorArea
    : modalidadMaterial(material, propiedades.medirMaterial) !== "CANTIDAD";
  return <fieldset disabled={bloqueada} className="min-w-0 space-y-4 rounded-md border p-4">
    <legend className="px-2 text-base font-semibold">Línea {indice + 1}: {ETIQUETA[linea.tipo]}</legend>
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto id={`${prefijo}.descripcion`} etiqueta="Descripción de costo" requerido valor={linea.descripcion}
        error={errores[`${prefijo}.descripcion`]} alCambiar={(descripcion) => alCambiar({ ...linea, descripcion })} />
      <CampoTexto id={`${prefijo}.unidad`} etiqueta="Unidad de costo" requerido valor={enMetros ? "m²" : linea.unidad}
        deshabilitado={enMetros || Boolean(material?.unidadCotizacion)}
        error={errores[`${prefijo}.unidad`]} alCambiar={(unidad) => alCambiar({ ...linea, unidad })} />
    </div>
    <CamposMaterial {...propiedades} /><CamposTrabajo {...propiedades} />
    <FormField id={`${prefijo}.importe`} etiqueta="Importe de línea" error={errores[`${prefijo}.importe`]}>
      {(atributos) => <output {...atributos} aria-live="off"><Money valor={propiedades.importe} moneda={propiedades.moneda} /></output>}
    </FormField>
    <Button type="button" variant="outline" onClick={propiedades.alQuitar}
      aria-label={`Quitar línea ${indice + 1}: ${ETIQUETA[linea.tipo]}`}>Quitar línea</Button>
  </fieldset>;
}

type LineaRegistrada = Omit<PropiedadesLinea, "linea" | "alCambiar" | "alQuitar"> & {
  formulario: UseFormReturn<EntradaReemplazarItems>;
  prefijo: `items.${number}.lineas.${number}`;
  quitar: (indice: number) => void;
};

export const EditorLinea = memo(function EditorLinea(propiedades: LineaRegistrada) {
  const { field } = useController({ control: propiedades.formulario.control, name: propiedades.prefijo });
  return <ContenidoLinea {...propiedades} linea={field.value} alCambiar={field.onChange}
    alQuitar={() => propiedades.quitar(propiedades.indice)} />;
}, (anterior, siguiente) => {
  const erroresDe = (propiedades: LineaRegistrada) => Object.entries(propiedades.errores)
    .filter(([campo]) => campo.startsWith(`${propiedades.prefijo}.`));
  return anterior.formulario === siguiente.formulario && anterior.prefijo === siguiente.prefijo
    && anterior.indice === siguiente.indice && anterior.materiales === siguiente.materiales
    && anterior.moneda === siguiente.moneda && anterior.bloqueada === siguiente.bloqueada
    && anterior.areaPartida === siguiente.areaPartida && anterior.guardada === siguiente.guardada
    && anterior.medirMaterial === siguiente.medirMaterial
    && anterior.importe === siguiente.importe && anterior.quitar === siguiente.quitar
    && JSON.stringify(erroresDe(anterior)) === JSON.stringify(erroresDe(siguiente));
});


