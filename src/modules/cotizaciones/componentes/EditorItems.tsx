"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { aEntradaItem, calcularVista } from "../calculo";
import { esquemaReemplazarItems, type EntradaItem } from "../schema";
import type { CotizacionDto, SelectoresEditor } from "../tipos";
import { enfocarError, erroresEsquema, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { EditorItem, type ItemEditor } from "./EditorItem";
import { GrupoCampo } from "./GrupoCampo";
import { TotalesCotizacion } from "./TotalesCotizacion";

function nuevoItem(tipo: EntradaItem["tipo"]): ItemEditor {
  const claveLocal = crypto.randomUUID();
  if (tipo === "CATALOGO") return { claveLocal, tipo, productoId: "", cantidad: "1", ancho: null, alto: null };
  return { claveLocal, tipo, categoriaId: "", descripcion: "", unidadCobro: "UNIDAD", cantidad: "1", margenPct: "30", lineas: [] };
}

export function EditorItems({ cotizacion, selectores }: { cotizacion: CotizacionDto; selectores: SelectoresEditor }) {
  const [items, setItems] = useState<ItemEditor[]>(cotizacion.items.map(aEntradaItem));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudCotizacion("items-cotizacion");
  const vista = calcularVista({ items, originales: cotizacion.items, selectores,
    descuento: cotizacion.descuento, tasaImpuesto: cotizacion.tasaImpuesto });
  const campos = { ...errores, ...vista.errores, ...solicitud.campos };
  const cambiarItem = (indice: number, item: ItemEditor) => setItems(items.map((guardado, posicion) =>
    posicion === indice ? { ...item, claveLocal: guardado.claveLocal } : guardado));
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = { version: cotizacion.actualizadoEn, items: items.map((item) => {
      const entrada = { ...item };
      delete entrada.claveLocal;
      return entrada;
    }) };
    const validacion = { ...erroresEsquema(esquemaReemplazarItems, cuerpo), ...vista.errores };
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("items-cotizacion"); return; }
    await solicitud.enviar({ url: `/api/v1/cotizaciones/${cotizacion.id}/items`, metodo: "PUT", cuerpo });
  }
  return <form id="items-cotizacion" aria-label="Ítems de cotización" onSubmit={guardar} noValidate className="space-y-5">
    <AvisoGuardado {...solicitud} />
    <fieldset disabled={solicitud.enviando} className="min-w-0 space-y-5">
      <legend className="mb-4 text-xl font-semibold">Ítems de cotización</legend>
      <GrupoCampo id="items" etiqueta="Productos y trabajos" error={campos.items}>
        {items.map((item, indice) => <EditorItem key={item.itemId ?? item.claveLocal} item={item} indice={indice}
          original={cotizacion.items.find((original) => original.id === item.itemId)} selectores={selectores}
          calculado={vista.items[indice]} errores={campos} alCambiar={(entrada) => cambiarItem(indice, entrada)}
          alQuitar={() => setItems(items.filter((_, posicion) => posicion !== indice))} />)}
      </GrupoCampo>
      {!items.length ? <EmptyState titulo="Agregue el primer ítem" descripcion="Seleccione catálogo o capture un trabajo personalizado." /> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={items.length >= 200 || !selectores.productos.length}
          onClick={() => setItems([...items, nuevoItem("CATALOGO")])}>Agregar catálogo</Button>
        <Button type="button" variant="outline" disabled={items.length >= 200 || !selectores.categorias.length}
          onClick={() => setItems([...items, nuevoItem("PERSONALIZADO")])}>Agregar personalizado</Button>
      </div>
      {vista.totales ? <div><TotalesCotizacion totales={vista.totales} /></div> : <Alert>
        <CircleAlert aria-hidden="true" /><AlertTitle>Revise los campos para calcular los totales</AlertTitle>
        <AlertDescription>{campos.descuento ?? "Complete productos, cantidades y líneas de costo."}</AlertDescription>
      </Alert>}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={solicitud.enviando}>Guardar ítems</Button>
        <Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}`}>Cancelar</Link></Button></div>
    </fieldset>
  </form>;
}
