"use client";

import { FormField } from "@/components/comunes/FormField";
import { Money } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { TipoLineaCosto } from "@/core/costeo";
import type { CamposError } from "@/lib/errores";
import type { ItemCalculado } from "../calculo";
import type { EntradaItem, EntradaLineaEditor } from "../schema";
import type { ItemDto, SelectoresEditor } from "../tipos";
import { CampoSeleccion, CampoTexto } from "./CamposEditor";
import { EditorLinea } from "./EditorLinea";

export type PropiedadesItem = { item: EntradaItem; indice: number; original?: ItemDto; selectores: SelectoresEditor;
  calculado: ItemCalculado | null; errores: CamposError; alCambiar: (item: EntradaItem) => void; alQuitar: () => void };

function nuevaLinea(tipo: TipoLineaCosto): EntradaLineaEditor {
  if (tipo === "MATERIAL") return { tipo, descripcion: "", unidad: "unidad", materialId: null,
    cantidad: "1", costoUnitario: "0", mermaPct: "0" };
  if (tipo === "MANO_OBRA") return { tipo, descripcion: "Mano de obra", unidad: "hora", horas: "1", tarifa: "0" };
  return { tipo, descripcion: "Servicio de tercero", unidad: "servicio", costo: "0" };
}

function CamposCatalogo({ item, indice, original, selectores, errores, alCambiar }: PropiedadesItem) {
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
    <p className="text-sm text-muted-foreground">Cobro: {unidad === "M2" ? "m²" : "unidad"}. Precio: <Money valor={precio} />.</p>
    {conservar ? <p className="text-sm">Conserve {original?.descripcion} con su precio guardado.</p> : null}
    {original?.productoActivo === false ? <p role="status" className="text-sm">El producto está archivado. Puede conservar su instantánea.</p> : null}
    {unidad === "M2" ? <MedidasItem item={item} indice={indice} errores={errores} alCambiar={alCambiar} /> : null}
  </>;
}

function MedidasItem({ item, indice, errores, alCambiar }: Pick<PropiedadesItem, "item" | "indice" | "errores" | "alCambiar">) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <CampoTexto id={`items.${indice}.ancho`} etiqueta="Ancho (m)" decimal requerido valor={item.ancho ?? ""}
      error={errores[`items.${indice}.ancho`]} alCambiar={(ancho) => alCambiar({ ...item, ancho: ancho || null })} />
    <CampoTexto id={`items.${indice}.alto`} etiqueta="Alto (m)" decimal requerido valor={item.alto ?? ""}
      error={errores[`items.${indice}.alto`]} alCambiar={(alto) => alCambiar({ ...item, alto: alto || null })} />
  </div>;
}

function CamposPersonalizado({ item, indice, original, selectores, errores, alCambiar }: PropiedadesItem) {
  if (item.tipo !== "PERSONALIZADO") return null;
  const categorias = [...selectores.categorias];
  if (original && !categorias.some((registro) => registro.id === original.categoriaId)) {
    categorias.push({ id: original.categoriaId, nombre: "Categoría guardada (archivada)" });
  }
  return <>
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSeleccion id={`items.${indice}.categoriaId`} etiqueta="Categoría" requerido valor={item.categoriaId} opciones={categorias}
        error={errores[`items.${indice}.categoriaId`]} alCambiar={(categoriaId) => alCambiar({ ...item, categoriaId })} />
      <CampoSeleccion id={`items.${indice}.unidadCobro`} etiqueta="Unidad de cobro" valor={item.unidadCobro}
        opciones={[{ id: "UNIDAD", nombre: "Unidad" }, { id: "M2", nombre: "m²" }]}
        alCambiar={(unidadCobro) => alCambiar({ ...item, unidadCobro: unidadCobro as "UNIDAD" | "M2" })} />
    </div>
    <CampoTexto id={`items.${indice}.descripcion`} etiqueta="Descripción del trabajo" requerido valor={item.descripcion}
      error={errores[`items.${indice}.descripcion`]} alCambiar={(descripcion) => alCambiar({ ...item, descripcion })} />
    {item.unidadCobro === "M2" ? <MedidasItem item={item} indice={indice} errores={errores} alCambiar={alCambiar} /> : null}
    <CampoTexto id={`items.${indice}.margenPct`} etiqueta="Margen sobre precio (%)" decimal requerido valor={item.margenPct}
      deshabilitado={Boolean(original && !item.actualizarPrecio)} error={errores[`items.${indice}.margenPct`]}
      alCambiar={(margenPct) => alCambiar({ ...item, margenPct })} />
    <p className="text-sm text-muted-foreground">Las líneas representan consumos totales del ítem. La cantidad solo divide el precio unitario.</p>
  </>;
}

function LineasItem({ item, indice, original, selectores, calculado, errores, alCambiar }: PropiedadesItem) {
  if (item.tipo !== "PERSONALIZADO") return null;
  const bloqueada = Boolean(original && !item.actualizarPrecio);
  const lineas = calculado?.tipo === "PERSONALIZADO" ? calculado.lineas : [];
  const cambiarLinea = (posicion: number, linea: EntradaLineaEditor) => {
    alCambiar({ ...item, lineas: item.lineas.map((guardada, actual) => actual === posicion ? linea : guardada) });
  };
  return <div className="space-y-4">
    <h3 className="text-base font-semibold">Líneas de costo</h3>
    <FormField id={`items.${indice}.lineas`} etiqueta="Consumos del ítem" error={errores[`items.${indice}.lineas`]}>
      {(atributos) => <div {...atributos} tabIndex={-1} className="space-y-4">
        {item.lineas.map((linea, posicion) => <EditorLinea key={linea.lineaId ?? posicion}
          linea={linea} prefijo={`items.${indice}.lineas.${posicion}`} indice={posicion} materiales={selectores.materiales}
          errores={errores} bloqueada={bloqueada} importe={lineas[posicion]?.importe}
          alCambiar={(entrada) => cambiarLinea(posicion, entrada)}
          alQuitar={() => alCambiar({ ...item, lineas: item.lineas.filter((_, actual) => actual !== posicion) })} />)}
      </div>}
    </FormField>
    <div className="flex flex-wrap gap-2">
      {(["MATERIAL", "MANO_OBRA", "TERCERO"] as const).map((tipo) => <Button key={tipo} type="button" variant="outline"
        disabled={bloqueada} onClick={() => alCambiar({ ...item, lineas: [...item.lineas, nuevaLinea(tipo)] })}>
        Agregar {tipo === "MATERIAL" ? "material" : tipo === "MANO_OBRA" ? "mano de obra" : "tercero"}
      </Button>)}
    </div>
  </div>;
}

function ActualizarInstantanea({ item, indice, original, alCambiar }: PropiedadesItem) {
  if (!original) return null;
  const etiqueta = item.tipo === "CATALOGO" ? "Aplicar producto y precio vigentes" : "Aplicar cambios de costos y margen";
  return <FormField id={`items.${indice}.actualizarPrecio`} etiqueta={etiqueta}
    ayuda="Sin marcar, conserve los precios y costos guardados.">
    {(atributos) => <Checkbox {...atributos} checked={item.actualizarPrecio ?? false}
      onCheckedChange={(valor) => alCambiar(valor === true ? { ...item, actualizarPrecio: true }
        : { ...item, actualizarPrecio: false })} />}
  </FormField>;
}

export function EditorItem(propiedades: PropiedadesItem) {
  const { item, indice, calculado, errores, alCambiar, alQuitar } = propiedades;
  return <Card className="px-5"><div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Ítem {indice + 1}: {item.tipo === "CATALOGO" ? "Catálogo" : "Personalizado"}</h2>
      <Button type="button" variant="outline" onClick={alQuitar} aria-label={`Quitar ítem ${indice + 1}`}>Quitar ítem</Button>
    </div>
    <ActualizarInstantanea {...propiedades} />
    <CamposCatalogo {...propiedades} /><CamposPersonalizado {...propiedades} />
    <CampoTexto id={`items.${indice}.cantidad`} etiqueta="Cantidad del ítem" decimal requerido valor={item.cantidad}
      error={errores[`items.${indice}.cantidad`]} alCambiar={(cantidad) => alCambiar({ ...item, cantidad })} />
    <LineasItem {...propiedades} />
    <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t pt-4 text-sm">
      <div><dt>Precio unitario</dt><dd><Money valor={calculado?.precioUnitario} /></dd></div>
      {item.tipo === "PERSONALIZADO" ? <div><dt>Costo total</dt><dd><Money valor={calculado?.costoTotal} /></dd></div> : null}
      <div><dt>Importe del ítem</dt><dd className="font-semibold"><Money valor={calculado?.importe} /></dd></div>
    </dl>
  </div></Card>;
}
