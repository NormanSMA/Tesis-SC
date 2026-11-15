"use client";
import { useState } from "react";
import { peticionAdministracion } from "@/modules/admin/componentes/peticion";
import type { CategoriaPersonalizada, RegistroPersonalizadas, TipoPersonalizado } from "./schema";

export const CATEGORIAS_SC = ["Diseño Gráfico", "Impresión Digital", "Rotulación", "Impresión Láser/Burbuja/Offset", "Corte Láser/Router", "Sublimación", "Producción Audiovisual", "Acabado ID"];
export function useConfiguracionPersonalizada(inicial: RegistroPersonalizadas) {
  const [datos, setDatos] = useState<RegistroPersonalizadas>(() => ({ ...inicial, categorias: [...inicial.categorias,
    ...CATEGORIAS_SC.filter(n => !inicial.categorias.some(c => c.nombre === n)).map(nombre => ({ id: crypto.randomUUID(), nombre, tipos: [] }))] }));
  const [categoriaId, setCategoriaId] = useState(inicial.categorias[0]?.id ?? "");
  const [producto, setProducto] = useState<TipoPersonalizado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const categoria = datos.categorias.find(c => c.id === categoriaId);
  function puedeCambiar() {
    const guardado = categoria?.tipos.find(t => t.id === producto?.id);
    return !producto || JSON.stringify(producto) === JSON.stringify(guardado) || window.confirm("Hay cambios sin guardar. ¿Desea descartarlos?");
  }
  function elegirProducto(t: TipoPersonalizado) { if (puedeCambiar()) setProducto(t); }
  function elegirCategoria(id: string) { if (!puedeCambiar()) return; setCategoriaId(id); setProducto(null); setMensaje(""); }
  function nuevoProducto() { if (!puedeCambiar()) return; setProducto({ id: crypto.randomUUID(), nombre: "", unidadCobro: "UNIDAD", margenPct: "30", materiales: [] }); setMensaje(""); }
  async function guardar(categorias: CategoriaPersonalizada[], nombre: string) {
    setOcupado(true); setMensaje("");
    const r = await peticionAdministracion<RegistroPersonalizadas>("/api/v1/personalizadas", { metodo: "PUT", cuerpo: { categorias, version: datos.version } });
    setOcupado(false);
    if (r.error) { setMensaje(r.error.mensaje); return false; }
    setDatos(r.datos); setCategoriaId(r.datos.categorias.find(c => c.nombre === nombre)?.id ?? ""); setMensaje("Cambios guardados.");
    if (producto) setProducto(r.datos.categorias.flatMap(c => c.tipos).find(t => t.id === producto.id) ?? null);
    return true;
  }
  async function guardarProducto() {
    if (!producto || !categoria) return;
    await guardar(datos.categorias.map(c => c.id === categoria.id ? { ...c, tipos: [...c.tipos.filter(t => t.id !== producto.id), producto] } : c), categoria.nombre);
  }
  async function agregarCategoria(nombre: string) {
    if (!puedeCambiar()) return;
    const nueva = { id: crypto.randomUUID(), nombre: nombre.trim(), tipos: [] };
    if (await guardar([...datos.categorias, nueva], nueva.nombre)) setProducto(null);
  }
  async function retirarProducto() {
    if (!categoria || !producto || !window.confirm("¿Retirar este producto de las futuras cotizaciones? Las cotizaciones guardadas se conservan.")) return;
    if (await guardar(datos.categorias.map(c => c.id === categoria.id ? { ...c, tipos: c.tipos.filter(t => t.id !== producto.id) } : c), categoria.nombre)) setProducto(null);
  }
  return { datos, categoria, categoriaId, producto, setProducto, elegirProducto, ocupado, mensaje, elegirCategoria, nuevoProducto, guardarProducto, agregarCategoria, retirarProducto };
}
