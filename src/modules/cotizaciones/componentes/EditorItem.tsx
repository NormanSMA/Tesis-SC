"use client";
import { MaterialesDelProducto } from "@/modules/personalizadas/MaterialesDelProducto";
import { GastosPartida } from "@/modules/personalizadas/GastosPartida";

import { ElegirPersonalizada } from "@/modules/personalizadas/ElegirPersonalizada";
import { useId } from "react";
import { useController, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/comunes/FormField";
import { Money } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { TipoLineaCosto } from "@/core/costeo";
import type { Moneda } from "@/core/moneda";
import type { CamposError } from "@/lib/errores";
import { calcularVista, type ItemCalculado } from "../calculo";
import { superficieTotal } from "../materiales";
import type { EntradaItem, EntradaLineaEditor, EntradaReemplazarItems } from "../schema";
import type { ItemDto, SelectoresEditor } from "../tipos";
import { CampoSeleccion, CampoTexto } from "./CamposEditor";
import { EditorLinea } from "./EditorLinea";
import { GrupoCampo } from "./GrupoCampo";

export type ItemEditor = EntradaItem;

type CamposItem = { moneda: Moneda; item: ItemEditor; indice: number; original?: ItemDto; selectores: SelectoresEditor;
  calculado: ItemCalculado | null; errores: CamposError; alCambiar: (item: ItemEditor) => void; alQuitar: () => void };
export type PropiedadesItem = CamposItem;
type ItemRegistrado = Omit<CamposItem, "item" | "calculado" | "alCambiar"> & { formulario: UseFormReturn<EntradaReemplazarItems> };

function nuevaLinea(tipo: TipoLineaCosto): EntradaLineaEditor {
  if (tipo === "MATERIAL") return { tipo, descripcion: "", unidad: "unidad", materialId: null,
    cantidad: "1", costoUnitario: "0", mermaPct: "0" };
  if (tipo === "MANO_OBRA") return { tipo, descripcion: "Mano de obra", unidad: "hora", horas: "1", tarifa: "0" };
  return { tipo, descripcion: "Servicio externo", unidad: "servicio", costo: "0" };
}

function CamposCatalogo({ moneda, item, indice, original, selectores, errores, alCambiar }: CamposItem) {
  if (item.tipo !== "CATALOGO") return null;
  const conservar = Boolean(original && !item.actualizarPrecio);
  const producto = selectores.productos.find((registro) => registro.id === item.productoId);
  const opciones = selectores.productos.map((registro) => ({ id: registro.id, nombre: `${registro.codigo} · ${registro.nombre}` }));
  if (original?.productoId && !opciones.some((registro) => registro.id === original.productoId)) {
    opciones.push({ id: original.productoId, nombre: `${original.descripcion} (archivado)` });
  }
  const unidad = conservar ? original?.unidadCobro : producto?.unidadCobro;
  const precio = conservar ? original?.precioUnitario : producto?.precioBase;
  return <>
    <CampoSeleccion id={`items.${indice}.productoId`} etiqueta="Producto" valor={item.productoId} requerido opciones={opciones}
      deshabilitado={conservar} error={errores[`items.${indice}.productoId`]}
      alCambiar={(productoId) => alCambiar({ ...item, productoId })} />
    <p className="text-sm text-muted-foreground">Cobro: {unidad === "M2" ? "m²" : "unidad"}. Precio: <Money valor={precio} moneda={moneda} />.</p>
    {conservar ? <p className="text-sm">Conserve {original?.descripcion} con su precio guardado.</p> : null}
    {original?.productoActivo === false ? <p role="status" className="text-sm">El producto está archivado. Puede conservar su instantánea.</p> : null}
    {unidad === "M2" ? <MedidasItem item={item} indice={indice} errores={errores} alCambiar={alCambiar} /> : null}
  </>;
}

function MedidasItem({ item, indice, errores, alCambiar }: Pick<CamposItem, "item" | "indice" | "errores" | "alCambiar">) {
  return <div className="grid gap-4 sm:grid-cols-3">
    <CampoTexto id={`items.${indice}.ancho`} etiqueta="Ancho (m)" decimal requerido valor={item.ancho ?? ""}
      error={errores[`items.${indice}.ancho`]} alCambiar={(ancho) => alCambiar({ ...item, ancho: ancho || null })} />
    <CampoTexto id={`items.${indice}.alto`} etiqueta="Alto (m)" decimal requerido valor={item.alto ?? ""}
      error={errores[`items.${indice}.alto`]} alCambiar={(alto) => alCambiar({ ...item, alto: alto || null })} />
    <CampoTexto id={`items.${indice}.profundidad`} etiqueta="Profundidad (m, opcional)" decimal valor={item.profundidad ?? ""}
      error={errores[`items.${indice}.profundidad`]} alCambiar={(profundidad) => alCambiar({ ...item, profundidad: profundidad || null })} />
    <p className="text-sm text-muted-foreground sm:col-span-3">Con profundidad, el m² incluye el frente y los cuatro laterales.</p>
  </div>;
}

function CamposPersonalizado({ moneda, item, indice, original, selectores, errores, alCambiar }: CamposItem) {
  if (item.tipo !== "PERSONALIZADO") return null;
  const requiereMedidas = item.lineas.some((linea) => linea.tipo === "MATERIAL" && Boolean(linea.materialId) &&
    (original?.lineas.some((guardada) => guardada.id === linea.lineaId && guardada.materialId === linea.materialId && guardada.cantidadPorArea)
      || (!original || item.actualizarPrecio) && selectores.materiales.find((material) => material.id === linea.materialId)?.unidadCotizacion === "M2"));
  const categorias = [...selectores.categorias];
  if (original && !categorias.some((registro) => registro.id === original.categoriaId)) {
    categorias.push({ id: original.categoriaId, nombre: "Categoría guardada (archivada)" });
  }
  return <>
    <ElegirPersonalizada moneda={moneda} item={item} indice={indice} selectores={selectores} bloqueado={Boolean(original && !item.actualizarPrecio)} alCambiar={alCambiar} />
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSeleccion id={`items.${indice}.categoriaId`} etiqueta="Categoría" requerido valor={item.categoriaId} opciones={categorias}
        deshabilitado={Boolean(item.productoPersonalizado)}
        error={errores[`items.${indice}.categoriaId`]} alCambiar={(categoriaId) => alCambiar({ ...item, categoriaId })} />
      <CampoSeleccion id={`items.${indice}.unidadCobro`} etiqueta="Unidad de cobro" valor={item.unidadCobro}
        opciones={[{ id: "UNIDAD", nombre: "Unidad" }, { id: "M2", nombre: "m²" }]}
        alCambiar={(unidadCobro) => alCambiar({ ...item, unidadCobro: unidadCobro as "UNIDAD" | "M2" })} />
    </div>
    <CampoTexto id={`items.${indice}.descripcion`} etiqueta="Descripción del trabajo" requerido valor={item.descripcion}
      error={errores[`items.${indice}.descripcion`]} alCambiar={(descripcion) => alCambiar({ ...item, descripcion })} />
    {item.unidadCobro === "M2" || requiereMedidas ? <MedidasItem item={item} indice={indice} errores={errores} alCambiar={alCambiar} /> : null}
    <CampoTexto id={`items.${indice}.margenPct`} etiqueta="Ganancia sobre el precio de venta (%)" decimal requerido valor={item.margenPct}
      deshabilitado={Boolean(original && !item.actualizarPrecio)} error={errores[`items.${indice}.margenPct`]}
      alCambiar={(margenPct) => alCambiar({ ...item, margenPct })} />
    <p className="text-sm text-muted-foreground">Los materiales en m² usan el ancho, el alto, la profundidad si se indica y la cantidad de este trabajo.</p>
  </>;
}

function LineasItem({ moneda, item, indice, original, selectores, calculado, errores, formulario }: CamposItem & Pick<ItemRegistrado, "formulario">) {
  const { fields, append, remove } = useFieldArray({ control: formulario.control, name: `items.${indice}.lineas` });
  const bloqueada = Boolean(original && !item.actualizarPrecio);
  const lineas = calculado?.tipo === "PERSONALIZADO" ? calculado.lineas : [];
  return <div className="space-y-4">
    <h3 className="text-base font-semibold">Materiales y otros costos</h3>
    <GrupoCampo id={`items.${indice}.lineas`} etiqueta="Materiales y servicios del trabajo" className="space-y-4"
      error={errores[`items.${indice}.lineas`]}>
      <div className="min-w-0 overflow-x-auto rounded-lg border border-formulario" role="region" aria-label="Tabla de costos del producto" tabIndex={0}><table className="tabla-costos tabla-costos-manual"><caption className="sr-only">Materiales y servicios del trabajo</caption><colgroup>{[30,12,10,14,10,14,10].map((ancho,i) => <col key={i} style={{width:`${ancho}%`}} />)}</colgroup><thead><tr>{["Material o servicio", "Cantidad", "Unidad", "Costo unitario", "Desperdicio %", "Costo total", "Acciones"].map(t => <th scope="col" key={t} className={["Cantidad", "Costo unitario", "Desperdicio %", "Costo total"].includes(t) ? "text-right" : undefined}>{t}</th>)}</tr></thead><tbody>{fields.map((linea, posicion) => linea.esGastoPersonalizado ? null : <EditorLinea key={linea.id}
        moneda={moneda} formulario={formulario} prefijo={`items.${indice}.lineas.${posicion}`} indice={posicion} materiales={selectores.materiales}
        areaPartida={superficieTotal(item)} medirMaterial={item.tipo === "PERSONALIZADO" && (item.unidadCobro === "M2" || Boolean(item.ancho && item.alto))}
        guardada={original?.lineas.find(({ id }) => id === linea.lineaId)}
        errores={errores} bloqueada={bloqueada} importe={lineas[fields.slice(0, posicion).filter(l => !l.esGastoPersonalizado).length]?.importe}
        quitar={remove} />)}</tbody></table></div>
    </GrupoCampo>
    <div className="flex flex-wrap gap-2">
      {(["MATERIAL", "MANO_OBRA", "TERCERO"] as const).map((tipo) => <Button key={tipo} type="button" variant="outline"
        disabled={bloqueada} onClick={() => append(nuevaLinea(tipo))}>
        Agregar {tipo === "MATERIAL" ? "material" : tipo === "MANO_OBRA" ? "mano de obra" : "servicio externo"}
      </Button>)}
    </div>
  </div>;
}

function ActualizarInstantanea({ item, indice, original, alCambiar }: CamposItem) {
  const idDescripcion = useId();
  if (!original) return null;
  const etiqueta = item.tipo === "CATALOGO" ? "Aplicar producto y precio vigentes" : "Aplicar cambios de costos y margen";
  return <><FormField id={`items.${indice}.actualizarPrecio`} etiqueta={etiqueta}
    ayuda="Sin marcar, conserve los precios y costos guardados.">
    {(atributos) => <Checkbox {...atributos}
      aria-describedby={[atributos["aria-describedby"], idDescripcion].filter(Boolean).join(" ")}
      checked={item.actualizarPrecio ?? false}
      onCheckedChange={(valor) => alCambiar(valor === true ? { ...item, actualizarPrecio: true }
        : { ...item, actualizarPrecio: false })} />}
  </FormField><span id={idDescripcion} className="sr-only">
    {item.tipo === "CATALOGO" ? "Al marcar, aplique el producto y precio vigentes del catálogo."
      : "Al marcar, recalcule el precio con los cambios de costos y margen."}
  </span></>;
}

function ContenidoItem(propiedades: CamposItem & { formulario?: UseFormReturn<EntradaReemplazarItems> }) {
  const { moneda, item, indice, calculado, errores, alCambiar, alQuitar } = propiedades;
  return <Card className="min-w-0 border-[1.5px] border-formulario px-5"><div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Producto {indice + 1}: {item.tipo === "CATALOGO" ? "Catálogo" : "Personalizado"}</h2>
      <Button type="button" variant="outline" onClick={alQuitar} aria-label={`Quitar producto ${indice + 1}`}>Quitar producto</Button>
    </div>
    <ActualizarInstantanea {...propiedades} />
    <CamposCatalogo {...propiedades} /><CamposPersonalizado {...propiedades} />
    <CampoTexto id={`items.${indice}.cantidad`} etiqueta="Cantidad del producto" decimal requerido valor={item.cantidad}
      error={errores[`items.${indice}.cantidad`]} alCambiar={(cantidad) => alCambiar({ ...item, cantidad })} />
    {item.tipo === "PERSONALIZADO" && item.productoPersonalizado ? <MaterialesDelProducto {...propiedades} item={item} bloqueado={Boolean(propiedades.original && !item.actualizarPrecio)} /> : item.tipo === "PERSONALIZADO" && propiedades.formulario ? <LineasItem {...propiedades} formulario={propiedades.formulario} /> : null}
    {item.tipo === "PERSONALIZADO" ? <GastosPartida item={item} indice={indice} moneda={moneda} selectores={propiedades.selectores}
      bloqueado={Boolean(propiedades.original && !item.actualizarPrecio)} alCambiar={alCambiar} error={errores.gastosPersonalizados ?? errores[`items.${indice}.gastosPersonalizados`]} /> : null}
    <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t pt-4 text-sm">
      <div><dt>Precio unitario</dt><dd><Money valor={calculado?.precioUnitario} moneda={moneda} /></dd></div>
      {item.tipo === "PERSONALIZADO" ? <div><dt>Costo total</dt><dd><Money valor={calculado?.costoTotal} moneda={moneda} /></dd></div> : null}
      <div><dt>Importe del producto</dt><dd className="font-semibold"><Money valor={calculado?.importe} moneda={moneda} /></dd></div>
    </dl>
  </div></Card>;
}

function ItemConFormulario(propiedades: ItemRegistrado) {
  const { field } = useController({ control: propiedades.formulario.control, name: `items.${propiedades.indice}` });
  const item = useWatch({ control: propiedades.formulario.control, name: `items.${propiedades.indice}` });
  const vista = calcularVista({ items: [item], originales: propiedades.original ? [propiedades.original] : [],
    selectores: propiedades.selectores, descuento: "0", tasaImpuesto: "0" });
  const errores = { ...propiedades.errores, ...Object.fromEntries(Object.entries(vista.errores)
    .map(([campo, mensaje]) => [campo.replace(/^items\.0\./, `items.${propiedades.indice}.`), mensaje])) };
  return <ContenidoItem {...propiedades} item={item} calculado={vista.items[0]} errores={errores} alCambiar={field.onChange} />;
}

export function EditorItem(propiedades: ItemRegistrado | PropiedadesItem) {
  return "formulario" in propiedades ? <ItemConFormulario {...propiedades} /> : <ContenidoItem {...propiedades} />;
}
