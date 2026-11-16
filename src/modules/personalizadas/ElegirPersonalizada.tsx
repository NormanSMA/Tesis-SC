"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CampoSeleccion } from "@/modules/cotizaciones/componentes/CamposEditor";
import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { SelectoresEditor } from "@/modules/cotizaciones/tipos";
import { aplicarProducto } from "./seleccion";
import type { RegistroPersonalizadas } from "./schema";

type Props = { moneda: string; item: Extract<EntradaItem, { tipo: "PERSONALIZADO" }>; indice: number; selectores: SelectoresEditor;
  bloqueado: boolean; alCambiar: (item: EntradaItem) => void };
export function ElegirPersonalizada({ item, indice, selectores, bloqueado, alCambiar, moneda }: Props) {
  const [registro, setRegistro] = useState<RegistroPersonalizadas>({ categorias: [], version: null });
  const [mensaje, setMensaje] = useState("");
  const categoria = registro.categorias.find(c => c.id === item.categoriaId);
  useEffect(() => {
    const controlador = new AbortController();
    void fetch("/api/v1/personalizadas", { signal: controlador.signal }).then(async r => {
      if (!r.ok) throw new Error();
      const respuesta = await r.json(); setRegistro(respuesta.datos);
    }).catch(() => { if (!controlador.signal.aborted) setMensaje("No se pudieron cargar los productos. Puede continuar con la captura manual."); });
    return () => controlador.abort();
  }, []);
  function elegir(id: string) {
    const tipo = categoria?.tipos.find(t => t.id === id);
    if (!tipo) return;
    if (item.productoPersonalizado && item.productoPersonalizado.id !== id && !window.confirm("¿Cambiar el producto? Se reemplazarán sus materiales sugeridos. Los otros costos se conservan.")) return;
    alCambiar(aplicarProducto({ tipo, item, selectores, moneda }));
    setMensaje("Producto cargado. Sus materiales ya están incluidos en el cálculo; revise cantidades y desmarque los que no utilizará." + (tipo.tarifas && tipo.tarifas.moneda !== moneda ? ` Las tarifas de gastos están en ${tipo.tarifas.moneda}; revise los gastos en la moneda de esta cotización.` : ""));
  }
  function cambiarCategoria(categoriaId:string) {
    if(item.productoPersonalizado && categoriaId!==item.categoriaId && !window.confirm("¿Cambiar de categoría? Los materiales actuales quedarán disponibles en captura manual.")) return;
    alCambiar({...item,categoriaId,productoPersonalizado:null});
  }
  if (bloqueado) return null;
  const tipos = [...(categoria?.tipos ?? [])];
  if (item.productoPersonalizado && !tipos.some(t => t.id === item.productoPersonalizado?.id)) tipos.push({ ...item.productoPersonalizado, unidadCobro: item.unidadCobro, margenPct:item.margenPct });
  return <fieldset className="min-w-0 space-y-3 rounded-lg border border-formulario/70 p-4">
    <legend className="font-semibold">Producto configurado</legend>
    <p className="text-sm">Elija un producto para cargar sus materiales y tarifas automáticamente. También puede preparar el trabajo manualmente.</p>
    {registro.categorias.length ? <CampoSeleccion id={`tipo-categoria-${indice}`} etiqueta="Categoría del producto configurado" valor={categoria?.id ?? ""}
      opciones={registro.categorias} alCambiar={cambiarCategoria} /> : null}
    <CampoSeleccion id={`tipo-personalizado-${indice}`} etiqueta="Producto personalizable" valor={item.productoPersonalizado?.id ?? ""}
      opciones={tipos} alCambiar={elegir} />
    {item.productoPersonalizado ? <Button type="button" variant="outline" onClick={() => alCambiar({ ...item, productoPersonalizado:null })}>Usar captura manual</Button> : <p className="text-sm text-muted-foreground">Si no elige un producto, agregue los materiales o servicios que necesita en la sección inferior.</p>}
    <p role="status">{mensaje}</p>
  </fieldset>;
}
