"use client";
import { Button } from "@/components/ui/button";
import { CampoSeleccion, CampoTexto } from "@/modules/cotizaciones/componentes/CamposEditor";
import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { SelectoresEditor } from "@/modules/cotizaciones/tipos";
import { calcularVista } from "@/modules/cotizaciones/calculo";
import { gastosIniciales, type GastosPersonalizados } from "./gastos-schema";
import { gastosCalculados } from "./gastos-calculo";

type Props = { item: Extract<EntradaItem,{ tipo: "PERSONALIZADO" }>; indice: number; moneda: string;
  selectores: SelectoresEditor; bloqueado: boolean; alCambiar: (item: EntradaItem) => void; error?: string };
export function GastosPartida({ item, indice, moneda, selectores, bloqueado, alCambiar, error }: Props) {
  const gastos = item.gastosPersonalizados;
  return <fieldset disabled={bloqueado} className="space-y-4 rounded-lg border border-formulario/70 p-4">
    <legend className="font-semibold">Gastos del trabajo y rentabilidad</legend>
    <p className="text-sm">Cantidades totales para este trabajo, en {moneda}. Registre los gastos compartidos en un solo trabajo y evite repetir costos capturados en mano de obra o instalación.</p>
    {!gastos ? <Button type="button" variant="outline" onClick={() => alCambiar({ ...item, gastosPersonalizados: gastosIniciales(moneda) })}>Agregar gastos del trabajo</Button> : <>
      <CamposGastos gastos={gastos} prefijo={`gastos-${indice}`} alCambiar={gastosPersonalizados => alCambiar({ ...item,gastosPersonalizados })} />
      <ResumenGastos {...{ item, selectores, gastos, moneda }} />
      <Button type="button" variant="outline" onClick={() => alCambiar({ ...item, gastosPersonalizados: null, lineas: item.lineas.filter(l=>!l.esGastoPersonalizado) })}>Quitar gastos del trabajo</Button>
    </>}
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
  </fieldset>;
}
export function CamposGastos({ gastos: g, prefijo, alCambiar }: { gastos: GastosPersonalizados; prefijo: string; alCambiar: (g: GastosPersonalizados) => void }) {
  const campo = (clave: keyof GastosPersonalizados, etiqueta: string) => <CampoTexto key={clave} id={`${prefijo}-${clave}`} etiqueta={etiqueta} decimal valor={g[clave]} alCambiar={v=>alCambiar({ ...g,[clave]:v })} />;
  return <div className="space-y-4">
    <Grupo titulo="Renta asignada al trabajo"><CampoSeleccion id={`${prefijo}-rentaModo`} etiqueta="Forma de asignar la renta" valor={g.rentaModo} opciones={[{id:"MONTO",nombre:"Monto fijo"},{id:"PORCENTAJE",nombre:"Porcentaje sobre venta"}]} alCambiar={v=>alCambiar({...g,rentaModo:v as GastosPersonalizados["rentaModo"]})} />{campo("rentaValor",g.rentaModo === "MONTO" ? "Monto de renta" : "Renta sobre venta (%)")}</Grupo>
    <p className="text-sm text-muted-foreground">El traslado se calcula una sola vez en la sección Instalación, mediante el mapa y su tarifa por kilómetro.</p>
    {Number(g.kmIda) > 0 ? <div className="space-y-2 rounded border border-formulario/70 p-3"><p>Esta trabajo conserva un traslado histórico de {g.kmIda} km de ida y {g.viajes} viajes. Retírelo antes de volver a cobrarlo con el mapa.</p><Button type="button" variant="outline" onClick={() => alCambiar({ ...g, kmIda: "0" })}>Retirar traslado de el trabajo</Button></div> : null}
    <Grupo titulo="Mano de obra adicional">{campo("personas","Cantidad de personas")}{campo("horasPersona","Horas por persona")}{campo("tarifaHora","Tarifa por hora y persona")}</Grupo>
    <details className="rounded border border-formulario/70 p-3"><summary className="cursor-pointer font-medium">Viáticos y hospedaje (opcionales)</summary><div className="mt-4 space-y-4">
      <Grupo titulo="Viáticos">{campo("personasViaticos","Personas con viáticos")}{campo("diasViaticos","Días de viáticos")}{campo("tarifaViatico","Tarifa por persona y día")}</Grupo>
      <Grupo titulo="Hospedaje">{campo("personasHospedaje","Personas hospedadas")}{campo("noches","Noches")}{campo("tarifaHospedaje","Tarifa por persona y noche")}</Grupo></div></details>
    <Grupo titulo="Porcentajes sobre venta"><CampoSeleccion id={`${prefijo}-imprevistos`} etiqueta="Imprevistos (%)" valor={g.imprevistosPct} opciones={[{id:"0",nombre:"No aplicar"},{id:"5",nombre:"Local: 5 %"},{id:"6",nombre:"Local: 6 %"},{id:"10",nombre:"Fuera de Estelí: 10 %"}]} alCambiar={imprevistosPct=>alCambiar({...g,imprevistosPct})} />
      <CampoSeleccion id={`${prefijo}-impuestos`} etiqueta="Impuestos internos (%)" valor={g.impuestosPct} opciones={[{id:"0",nombre:"No aplicar"},{id:"2",nombre:"2 %"},{id:"3",nombre:"3 %"}]} alCambiar={impuestosPct=>alCambiar({...g,impuestosPct})} />
      <p className="text-sm sm:col-span-3">Se calculan sobre el precio final de este trabajo. Estos trabajos requieren descuento cero; ajuste el margen para negociar el precio. Los impuestos internos no se desglosan como cargos al cliente.</p></Grupo>
  </div>;
}
function Grupo({ titulo,children }: {titulo:string;children:React.ReactNode}) {
  return <fieldset className="grid gap-3 rounded border border-formulario/70 p-4 sm:grid-cols-3"><legend className="px-1 font-medium">{titulo}</legend>{children}</fieldset>;
}
function prepararResumen({ item, selectores, gastos }: { item: Props["item"]; selectores: SelectoresEditor; gastos: GastosPersonalizados }) {
  try {
    const manuales = item.lineas.filter(l=>!l.esGastoPersonalizado);
    if (!manuales.length) return { costos: gastosCalculados({ gastos, cantidad:item.cantidad, margenPct:item.margenPct, lineas:[] }) };
    const base = calcularVista({ items:[{...item,lineas:manuales,gastosPersonalizados:null}],originales:[],selectores,descuento:"0",tasaImpuesto:"0" });
    const calculado = base.items[0];
    if (!calculado || calculado.tipo !== "PERSONALIZADO") return { error: "Complete primero los materiales, medidas y costos para calcular los gastos." };
    const lineas = calculado.lineas.map(l => l.tipo === "MANO_OBRA" ? { tipo:l.tipo, horas:l.cantidad,tarifa:l.costoUnitario } : l.tipo === "MATERIAL" ? {tipo:l.tipo,cantidad:l.cantidad,costoUnitario:l.costoUnitario,mermaPct:l.mermaPct} : {tipo:l.tipo,costo:l.costoUnitario});
    return { costos: gastosCalculados({ gastos,cantidad:item.cantidad,margenPct:item.margenPct,lineas }) };
  } catch(e) { return { error: e instanceof Error ? e.message : "Revise los valores de gastos." }; }
}
function ResumenGastos(props: { item: Props["item"]; selectores: SelectoresEditor; gastos:GastosPersonalizados; moneda:string }) {
  const resultado = prepararResumen(props);
  if (resultado.error) return <p role="status">{resultado.error}</p>;
  return <dl className="space-y-2">{resultado.costos?.map(c=><div key={c.descripcion} className="flex flex-wrap justify-between gap-2"><dt>{c.descripcion}</dt><dd>{props.moneda} {c.costo}</dd></div>)}</dl>;
}
