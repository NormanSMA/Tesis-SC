"use client";
import { memo } from "react";
import { useController, type UseFormReturn } from "react-hook-form";
import { Money } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import type { Moneda } from "@/core/moneda";
import type { CamposError } from "@/lib/errores";
import { faltaTarifaMaterial, MENSAJE_AREA_MATERIAL, MENSAJE_TARIFA_MATERIAL, modalidadMaterial } from "../materiales";
import type { EntradaLineaEditor, EntradaReemplazarItems } from "../schema";
import type { LineaDto, MaterialSelector } from "../tipos";
import { CampoSeleccion, CampoTexto } from "./CamposEditor";
type PropiedadesLinea = { moneda: Moneda; linea: EntradaLineaEditor; prefijo: string; indice: number; materiales: MaterialSelector[];
  errores: CamposError; bloqueada: boolean; importe?: string; areaPartida?: string | null; medirMaterial: boolean; guardada?: LineaDto;
  alCambiar: (linea: EntradaLineaEditor) => void; alQuitar: () => void };
const ETIQUETA = { MATERIAL: "Material", MANO_OBRA: "Mano de obra", TERCERO: "Servicio externo" };
function datosMaterial(p: PropiedadesLinea) {
  const linea = p.linea;
  const material = linea.tipo === "MATERIAL" ? p.materiales.find(m => m.id === linea.materialId) : undefined;
  const historial = p.linea.tipo === "MATERIAL" && p.guardada?.materialId === p.linea.materialId ? p.guardada : undefined;
  const conservar = historial && (p.bloqueada || !material);
  const modo = conservar ? historial.cantidadPorArea ? "AREA" : "CANTIDAD" : modalidadMaterial(material, p.medirMaterial);
  return { material, modo, precio: p.linea.tipo === "MATERIAL" ? conservar ? p.linea.costoUnitario
    : material?.precioCotizacion ?? material?.costoPromedio ?? p.linea.costoUnitario : undefined };
}
function DescripcionLinea(p: PropiedadesLinea) {
  const { linea, prefijo, errores, alCambiar } = p;
  if (linea.tipo !== "MATERIAL") return <CampoTexto compacto id={`${prefijo}.descripcion`} etiqueta="Descripción del costo" valor={linea.descripcion}
    error={errores[`${prefijo}.descripcion`]} alCambiar={descripcion => alCambiar({ ...linea, descripcion })} />;
  const opciones = [{ id: "__manual__", nombre: "Material sin registrar" }, ...p.materiales.map(m => ({ id: m.id, nombre: `${m.codigo} · ${m.nombre}` }))];
  if (linea.materialId && !opciones.some(m => m.id === linea.materialId)) opciones.push({ id: linea.materialId, nombre: `${linea.descripcion} (archivado)` });
  return <div className="min-w-0 space-y-2"><CampoSeleccion compacto id={`${prefijo}.materialId`} etiqueta="Material registrado" valor={linea.materialId ?? "__manual__"}
    opciones={opciones} error={errores[`${prefijo}.materialId`]} deshabilitado={p.bloqueada} alCambiar={id => {
      const m = p.materiales.find(m => m.id === id);
      alCambiar({ ...linea, materialId: m?.id ?? null, descripcion: m?.nombre ?? linea.descripcion,
        unidad: m?.unidadCotizacion ?? m?.unidad ?? linea.unidad, costoUnitario: m?.precioCotizacion ?? m?.costoPromedio ?? linea.costoUnitario });
    }} />{!linea.materialId ? <CampoTexto compacto id={`${prefijo}.descripcion`} etiqueta="Descripción del material" valor={linea.descripcion}
      error={errores[`${prefijo}.descripcion`]} alCambiar={descripcion => alCambiar({ ...linea, descripcion })} />
      : <details className="text-sm"><summary className="cursor-pointer">Descripción para este trabajo</summary>
        <div className="mt-2"><CampoTexto compacto id={`${prefijo}.descripcion`} etiqueta="Descripción del material en este trabajo" valor={linea.descripcion}
          error={errores[`${prefijo}.descripcion`]} alCambiar={descripcion => alCambiar({ ...linea, descripcion })} /></div>
      </details>}</div>;
}
function CantidadLinea(p: PropiedadesLinea) {
  const { linea, prefijo, errores, alCambiar } = p, { modo } = datosMaterial(p);
  const porArea = linea.tipo === "MATERIAL" && modo !== "CANTIDAD";
  const valor = linea.tipo === "MANO_OBRA" ? linea.horas : linea.tipo === "MATERIAL" ? porArea ? p.areaPartida ?? "" : linea.cantidad : "1";
  const campo = linea.tipo === "MANO_OBRA" ? "horas" : "cantidad";
  return <><CampoTexto compacto id={`${prefijo}.${campo}`} etiqueta={linea.tipo === "MANO_OBRA" ? "Horas totales" : "Cantidad total consumida"} decimal valor={valor}
    deshabilitado={p.bloqueada || porArea || linea.tipo === "TERCERO"} error={errores[`${prefijo}.${campo}`]} alCambiar={v => {
      if (linea.tipo === "MATERIAL") alCambiar({ ...linea, cantidad: v });
      if (linea.tipo === "MANO_OBRA") alCambiar({ ...linea, horas: v });
    }} />{porArea ? <small>{modo === "FALTA_AREA" ? MENSAJE_AREA_MATERIAL : "Calculado"}</small> : null}</>;
}
function PrecioLinea(p: PropiedadesLinea) {
  const { linea, prefijo, errores, alCambiar } = p, { precio, modo } = datosMaterial(p);
  const campo = linea.tipo === "MATERIAL" ? "costoUnitario" : linea.tipo === "MANO_OBRA" ? "tarifa" : "costo";
  const pendiente = linea.tipo === "MATERIAL" && Boolean(linea.materialId) && faltaTarifaMaterial(precio);
  const valor = linea.tipo === "MATERIAL" ? modo === "FALTA_AREA" || pendiente ? "" : precio ?? "" : linea.tipo === "MANO_OBRA" ? linea.tarifa : linea.costo;
  return <><CampoTexto compacto id={`${prefijo}.${campo}`} etiqueta="Costo unitario" decimal valor={valor} deshabilitado={p.bloqueada || linea.tipo === "MATERIAL" && Boolean(linea.materialId)}
    error={errores[`${prefijo}.${campo}`]} alCambiar={v => {
      if (linea.tipo === "MATERIAL") alCambiar({ ...linea, costoUnitario: v });
      if (linea.tipo === "MANO_OBRA") alCambiar({ ...linea, tarifa: v });
      if (linea.tipo === "TERCERO") alCambiar({ ...linea, costo: v });
    }} />{pendiente ? <p className="text-sm text-danger">{MENSAJE_TARIFA_MATERIAL}</p> : null}</>;
}
function ContenidoLinea(p: PropiedadesLinea) {
  const { linea, prefijo, errores, alCambiar } = p, { modo, material } = datosMaterial(p);
  const enMetros = linea.tipo === "MATERIAL" && modo !== "CANTIDAD";
  return <tr><td><fieldset disabled={p.bloqueada} className="min-w-0"><DescripcionLinea {...p} /></fieldset>
    <p className="mt-2 text-xs text-muted-foreground">{p.indice + 1}. {ETIQUETA[linea.tipo]}</p></td>
    <td><CantidadLinea {...p} /></td>
    <td><CampoTexto compacto id={`${prefijo}.unidad`} etiqueta="Unidad de costo" valor={enMetros ? "m²" : linea.unidad}
      deshabilitado={p.bloqueada || enMetros || Boolean(material?.unidadCotizacion)} error={errores[`${prefijo}.unidad`]}
      alCambiar={unidad => alCambiar({ ...linea, unidad })} /></td>
    <td><PrecioLinea {...p} /></td>
    <td>{linea.tipo === "MATERIAL" ? <CampoTexto compacto id={`${prefijo}.mermaPct`} etiqueta="Desperdicio (%)" decimal valor={linea.mermaPct}
      deshabilitado={p.bloqueada} error={errores[`${prefijo}.mermaPct`]} alCambiar={mermaPct => alCambiar({ ...linea, mermaPct })} /> : <span className="valor-costo">No aplica</span>}</td>
    <td><output className="valor-costo" aria-label={`Costo total de línea ${p.indice + 1}`}><Money valor={p.importe} moneda={p.moneda} /></output>
      {errores[`${prefijo}.importe`] ? <p role="alert">{errores[`${prefijo}.importe`]}</p> : null}
    </td><td><Button className="h-10 px-3" type="button" size="sm" variant="outline" disabled={p.bloqueada} onClick={p.alQuitar}
        aria-label={`Quitar línea ${p.indice + 1}: ${ETIQUETA[linea.tipo]}`}>Quitar</Button></td>
  </tr>;
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


