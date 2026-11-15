"use client";
import { TarifasDelProducto } from "./TarifasDelProducto";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CampoSeleccion, CampoTexto } from "@/modules/cotizaciones/componentes/CamposEditor";
import type { RegistroPersonalizadas, TipoPersonalizado } from "./schema";
import { useConfiguracionPersonalizada } from "./useConfiguracionPersonalizada";

type Material = { id: string; nombre: string; codigo: string };
export function ConfigurarPersonalizadas({ inicial, materiales }: { inicial: RegistroPersonalizadas; materiales: Material[] }) {
  const f = useConfiguracionPersonalizada(inicial);
  return <fieldset disabled={f.ocupado} className="min-w-0 space-y-6 [&_fieldset]:min-w-0 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:h-auto [&_button]:min-h-10 [&_button]:break-words">
    <p>Primero elija una categoría; después cree o seleccione un producto y marque sus materiales. Termine con Guardar producto personalizable.</p>
    <section className="space-y-4 rounded-xl border border-formulario bg-card p-5">
      <h2 className="text-lg font-semibold">1. Categoría del servicio</h2>
      <CampoSeleccion id="categoria-personalizada" etiqueta="Categoría comercial" valor={f.categoriaId} opciones={f.datos.categorias} alCambiar={f.elegirCategoria} />
      <NuevaCategoria agregar={f.agregarCategoria} />
    </section>
    {f.categoria ? <section className="space-y-4 rounded-xl border border-formulario bg-card p-5">
      <h2 className="text-lg font-semibold">2. Producto personalizable</h2>
      <p>Productos de {f.categoria.nombre}: {f.categoria.tipos.length}. Cada producto puede tener una selección diferente de materiales.</p>
      <div className="grid gap-3 sm:grid-cols-2">{f.categoria.tipos.map(t => <Button key={t.id} variant={f.producto?.id === t.id ? "default" : "outline"} onClick={() => f.elegirProducto(t)}>{t.nombre}</Button>)}</div>
      <Button variant="outline" onClick={f.nuevoProducto}>Crear producto personalizable</Button>
      {f.producto ? <><DatosProducto tipo={f.producto} alCambiar={f.setProducto} /><TarifasDelProducto tipo={f.producto} alCambiar={f.setProducto} /></> : <p className="text-sm text-muted-foreground">Seleccione un producto existente o pulse Crear producto personalizable.</p>}
    </section> : <p>Seleccione una categoría para continuar.</p>}
    {f.producto ? <>
      <MaterialesProducto tipo={f.producto} materiales={materiales} alCambiar={f.setProducto} />
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-formulario bg-card p-4">
        <Button disabled={!f.producto.nombre.trim()} onClick={f.guardarProducto}>Guardar producto personalizable</Button>
        {f.categoria?.tipos.some(t => t.id === f.producto?.id) ? <Button variant="outline" onClick={f.retirarProducto}>Retirar producto</Button> : null}
        <span className="text-sm">Los cambios del formulario se aplican al guardar.</span>
      </div>
    </> : null}
    <p role="status">{f.mensaje}</p>
  </fieldset>;
}
function NuevaCategoria({ agregar }: { agregar: (nombre: string) => Promise<void> }) {
  const [nombre, setNombre] = useState("");
  return <details className="rounded-lg border border-formulario/70 p-3"><summary className="cursor-pointer font-medium">¿Necesita otra categoría? Agregar categoría</summary>
    <div className="mt-3 space-y-3"><CampoTexto id="nueva-categoria" etiqueta="Nombre de la nueva categoría" valor={nombre} alCambiar={setNombre} />
      <Button variant="outline" disabled={!nombre.trim()} onClick={() => void agregar(nombre)}>Guardar nueva categoría</Button></div>
  </details>;
}
function DatosProducto({ tipo, alCambiar }: { tipo: TipoPersonalizado; alCambiar: (t: TipoPersonalizado) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2"><CampoTexto id="tipo-nombre" etiqueta="Nombre del producto" valor={tipo.nombre} alCambiar={nombre => alCambiar({ ...tipo, nombre })} ayuda="Por ejemplo: rótulo luminoso de dos caras." requerido /></div>
    <CampoSeleccion id="tipo-unidad" etiqueta="Unidad de cobro sugerida" valor={tipo.unidadCobro} opciones={[{ id: "UNIDAD", nombre: "Unidad" }, { id: "M2", nombre: "m²" }]} alCambiar={unidad => alCambiar({ ...tipo, unidadCobro: unidad as "UNIDAD" | "M2" })} />
    <CampoTexto id="tipo-margen" etiqueta="Margen sugerido sobre venta (%)" decimal valor={tipo.margenPct} alCambiar={margenPct => alCambiar({ ...tipo, margenPct })} />
  </div>;
}
function MaterialesProducto({ tipo, materiales, alCambiar }: { tipo: TipoPersonalizado; materiales: Material[]; alCambiar: (t: TipoPersonalizado) => void }) {
  const [q, setQ] = useState("");
  const seleccion = new Set(tipo.materiales);
  function marcar(id: string, incluir: boolean) { alCambiar({ ...tipo, materiales: incluir ? [...tipo.materiales, id] : tipo.materiales.filter(x => x !== id) }); }
  return <section className="space-y-4 rounded-xl border border-formulario bg-card p-5">
    <h2 className="text-lg font-semibold">3. Materiales habituales del producto</h2>
    <p>Marque los materiales que se cargarán automáticamente al elegir este producto. Al cotizar podrá quitar los que no use y ajustar sus cantidades.</p>
    <CampoTexto id="buscar-material-tipo" etiqueta="Buscar material por nombre o código" valor={q} alCambiar={setQ} />
    <p className="font-medium">{seleccion.size} materiales seleccionados</p>
    <fieldset className="max-h-96 space-y-2 overflow-auto rounded border border-formulario/70 p-3"><legend>Materiales disponibles</legend>
      {materiales.filter(m => `${m.codigo} ${m.nombre}`.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es"))).map(m => <label key={m.id} className="flex items-start gap-3 rounded border border-formulario/70 p-3">
        <input type="checkbox" className="mt-1" checked={seleccion.has(m.id)} onChange={e => marcar(m.id,e.target.checked)} />
        <span>{m.nombre}<span className="block text-sm text-muted-foreground">{m.codigo}</span></span></label>)}
      {tipo.materiales.filter(id => !materiales.some(m => m.id === id)).map(id => <label key={id} className="flex gap-2">
        <input type="checkbox" checked onChange={() => marcar(id,false)} />Material archivado: desmarque para retirarlo.</label>)}
    </fieldset>
  </section>;
}
