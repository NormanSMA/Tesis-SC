"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Button } from "@/components/ui/button";
import { convertirDesdeCordobas } from "@/core/moneda";
import { aEntradaItem, calcularVista } from "../calculo";
import { monedaDe, nombreMoneda } from "../moneda";
import { esquemaReemplazarItems, type EntradaItem, type EntradaReemplazarItems } from "../schema";
import type { CotizacionDto, SelectoresEditor } from "../tipos";
import { enfocarError, erroresEsquema, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { EditorItem } from "./EditorItem";
import { GrupoCampo } from "./GrupoCampo";
import { PieTotales } from "./PieTotales";

type Propiedades = { cotizacion: CotizacionDto; selectores: SelectoresEditor;
  alGuardar?: () => void; alCancelar?: () => void; alRecargar?: () => void;
  pie?: HTMLElement | null; variante?: "pagina" | "drawer" };

function nuevoItem(tipo: EntradaItem["tipo"]): EntradaItem {
  if (tipo === "CATALOGO") return { tipo, productoId: "", cantidad: "1", ancho: null, alto: null };
  return { tipo, categoriaId: "", descripcion: "", unidadCobro: "UNIDAD", cantidad: "1", margenPct: "30", lineas: [] };
}

function aMonedaCotizacion(selectores: SelectoresEditor, tipoCambio: string): SelectoresEditor {
  return { ...selectores,
    productos: selectores.productos.map((producto) => ({ ...producto, precioBase: convertirDesdeCordobas(producto.precioBase, tipoCambio, 2) })),
    materiales: selectores.materiales.map((material) => ({ ...material, costoPromedio: convertirDesdeCordobas(material.costoPromedio, tipoCambio, 4) })) };
}

function useEditor(propiedades: Propiedades) {
  const { cotizacion, alGuardar } = propiedades;
  const selectores = useMemo(() => aMonedaCotizacion(propiedades.selectores, cotizacion.tipoCambio),
    [propiedades.selectores, cotizacion.tipoCambio]);
  const formulario = useForm<EntradaReemplazarItems>({ shouldFocusError: false,
    defaultValues: { version: cotizacion.actualizadoEn, items: cotizacion.items.map(aEntradaItem) } });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudCotizacion("items-cotizacion", alGuardar);
  const guardar = formulario.handleSubmit(async (cuerpo) => {
    const vista = calcularVista({ ...cuerpo, originales: cotizacion.items, selectores,
      descuento: cotizacion.descuento, descuentoPct: cotizacion.descuentoPct, tasaImpuesto: cotizacion.tasaImpuesto });
    const validacion = { ...erroresEsquema(esquemaReemplazarItems, cuerpo), ...vista.errores };
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("items-cotizacion"); return; }
    await solicitud.enviar({ url: `/api/v1/cotizaciones/${cotizacion.id}/items`, metodo: "PUT", cuerpo });
  });
  return { formulario, selectores, solicitud, guardar, campos: { ...errores, ...solicitud.campos } };
}

function CamposItems({ propiedades, editor, pie }: {
  propiedades: Propiedades; editor: ReturnType<typeof useEditor>; pie: ReactNode;
}) {
  const { cotizacion } = propiedades;
  const { formulario, selectores, campos } = editor;
  const { fields, append, remove } = useFieldArray({ control: formulario.control, name: "items" });
  return <fieldset disabled={editor.solicitud.enviando} className="min-w-0 space-y-5">
    <legend className="mb-4 text-base font-semibold">Ítems de cotización</legend>
    <p className="text-sm">Moneda: {nombreMoneda(cotizacion.moneda)}</p>
    <GrupoCampo id="items" etiqueta="Productos y trabajos" error={campos.items}>
      {fields.map((item, indice) => <EditorItem key={item.id} moneda={monedaDe(cotizacion.moneda)} indice={indice}
        formulario={formulario} original={cotizacion.items.find((original) => original.id === item.itemId)}
        selectores={selectores} errores={campos} alQuitar={() => remove(indice)} />)}
    </GrupoCampo>
    {!fields.length ? <EmptyState titulo="Agregue el primer ítem" descripcion="Seleccione catálogo o capture un trabajo personalizado." /> : null}
    <div className="flex flex-wrap gap-3 max-sm:[&>*]:flex-1">
      <Button type="button" variant="outline" disabled={fields.length >= 200 || !selectores.productos.length}
        onClick={() => append(nuevoItem("CATALOGO"))}>Agregar catálogo</Button>
      <Button type="button" variant="outline" disabled={fields.length >= 200 || !selectores.categorias.length}
        onClick={() => append(nuevoItem("PERSONALIZADO"))}>Agregar personalizado</Button>
    </div>
    {pie}
  </fieldset>;
}

function PieEditor({ propiedades, formulario, selectores, enviando }: {
  propiedades: Propiedades; formulario: UseFormReturn<EntradaReemplazarItems>; selectores: SelectoresEditor; enviando: boolean;
}) {
  const { cotizacion, alCancelar, variante } = propiedades;
  return <div className="w-full space-y-4">
    <PieTotales control={formulario.control} cotizacion={cotizacion} selectores={selectores} />
    <div className={variante === "drawer" ? "flex flex-wrap gap-3" : "flex flex-wrap gap-3 max-sm:[&>*]:flex-1"}>
      <Button type="submit" form="items-cotizacion" disabled={enviando}>
      {variante === "drawer" ? "Guardar borrador" : "Guardar ítems"}</Button>
      {variante === "drawer" ? <Button asChild variant="outline" disabled={enviando}>
        <Link href={`/cotizaciones/${cotizacion.id}/editar`}>Abrir editor completo</Link></Button> :
        alCancelar ? <Button type="button" variant="outline" onClick={alCancelar}>Cancelar</Button> :
          <Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}`}>Cancelar</Link></Button>}
    </div>
  </div>;
}

export function EditorItems(propiedades: Propiedades) {
  const editor = useEditor(propiedades);
  const pie = <PieEditor propiedades={propiedades} formulario={editor.formulario}
    selectores={editor.selectores} enviando={editor.solicitud.enviando} />;
  const drawer = propiedades.variante === "drawer";
  return <form id="items-cotizacion" aria-label="Ítems de cotización" onSubmit={editor.guardar} noValidate className="space-y-5">
    <AvisoGuardado {...editor.solicitud} recargar={propiedades.alRecargar ?? editor.solicitud.recargar} />
    {drawer ? <CamposItems propiedades={propiedades} editor={editor} pie={null} /> :
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <CamposItems propiedades={propiedades} editor={editor} pie={null} />
        <aside aria-label="Totales y acciones" className="min-w-0 lg:sticky lg:top-6">{pie}</aside>
      </div>}
    {drawer && propiedades.pie ? createPortal(pie, propiedades.pie) : null}
  </form>;
}
