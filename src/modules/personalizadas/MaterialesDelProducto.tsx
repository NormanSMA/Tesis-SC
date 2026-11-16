"use client";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/comunes/ValorFormateado";
import { CampoTexto } from "@/modules/cotizaciones/componentes/CamposEditor";
import { modalidadMaterial, superficieTotal } from "@/modules/cotizaciones/materiales";
import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { SelectoresEditor, ItemDto } from "@/modules/cotizaciones/tipos";
import type { ItemCalculado } from "@/modules/cotizaciones/calculo";
import type { Moneda } from "@/core/moneda";

type Personalizado = Extract<EntradaItem,{tipo:"PERSONALIZADO"}>;
type Props = { item:Personalizado; indice:number; selectores:SelectoresEditor; original?:ItemDto; calculado:ItemCalculado|null;
  bloqueado:boolean; moneda:Moneda; errores:Record<string,string>; alCambiar:(item:EntradaItem)=>void };
export function MaterialesDelProducto(props:Props) {
  const { item,selectores,original,indice,bloqueado,alCambiar } = props;
  const ids=[...new Set([...(item.productoPersonalizado?.materiales??[]),...item.lineas.filter(l=>l.tipo==="MATERIAL"&&l.materialId).map(l=>l.tipo==="MATERIAL"?l.materialId!:"")])];
  function marcar(id:string, incluir:boolean) {
    const material=selectores.materiales.find(m=>m.id===id);
    if(incluir&&material) alCambiar({...item,lineas:[...item.lineas,{tipo:"MATERIAL",materialId:id,descripcion:material.nombre,unidad:material.unidadCotizacion??material.unidad,cantidad:"1",mermaPct:"0"}]});
    if(!incluir) alCambiar({...item,lineas:item.lineas.filter(l=>l.tipo!=="MATERIAL"||l.materialId!==id)});
  }
  return <fieldset disabled={bloqueado} className="min-w-0 space-y-4 rounded-lg border border-formulario/70 p-4"><legend className="font-semibold">Materiales de {item.productoPersonalizado?.nombre}</legend>
    <p className="text-sm">Los materiales marcados ya se calculan. Las cantidades iniciales son 1; ajústelas según el trabajo. En m² se usan las medidas y la cantidad a realizar.</p>
    {!ids.length ? <p>Este producto no tiene materiales configurados. Registre las horas y otros gastos de trabajo, o agregue sus materiales desde Configuración.</p> : null}
    <div className="overflow-x-auto rounded-lg border border-formulario" role="region" aria-label="Materiales del producto" tabIndex={0}><table className="tabla-costos"><caption className="sr-only">Seleccione los materiales y ajuste sus cantidades</caption><colgroup>{[40,15,17,12,16].map((ancho,i)=><col key={i} style={{width:`${ancho}%`}}/>)}</colgroup><thead><tr>{["Usar y material", "Cantidad total", "Precio por unidad", "Desperdicio %", "Costo total"].map(t=><th scope="col" key={t} className={t === "Usar y material" ? undefined : "text-right"}>{t}</th>)}</tr></thead><tbody>{ids.map(id=>{
      const pos=item.lineas.findIndex(l=>l.tipo==="MATERIAL"&&l.materialId===id),linea=item.lineas[pos];
      const material=selectores.materiales.find(m=>m.id===id),guardada=original?.lineas.find(l=>l.materialId===id);
      return <tr key={id}><td>
        <label className="flex min-h-10 items-center gap-3 font-medium"><input type="checkbox" className="size-4 shrink-0 accent-primary" checked={pos>=0} disabled={!material&&pos<0} onChange={e=>marcar(id,e.target.checked)}/>{material?.nombre??guardada?.descripcion??"Material no disponible"}</label></td>
        {linea?.tipo==="MATERIAL" ? <DatosConsumo {...props} linea={linea} posicion={pos} /> : <td colSpan={4} className="text-sm text-muted-foreground">No incluido en el precio.</td>}
      </tr>;
    })}</tbody></table></div>
    {props.errores[`items.${indice}.lineas`] ? <p role="alert" className="text-destructive">Seleccione los materiales necesarios o complete las horas y gastos del trabajo.</p> : null}
    {item.lineas.some(l=>!l.esGastoPersonalizado&&(l.tipo!=="MATERIAL"||!l.materialId)) ? <p className="text-sm">Este trabajo también conserva otros costos registrados: {item.lineas.filter(l=>!l.esGastoPersonalizado&&(l.tipo!=="MATERIAL"||!l.materialId)).map(l=>l.descripcion).join(", ")}. Use captura manual para revisarlos o modificarlos.</p> : null}
    <Button type="button" variant="outline" onClick={()=>alCambiar({...item,productoPersonalizado:null})}>Agregar materiales o servicios manualmente</Button>
  </fieldset>;
}
function DatosConsumo(props:Props & {linea:Extract<Personalizado["lineas"][number],{tipo:"MATERIAL"}>;posicion:number}) {
  const {item,linea,posicion,selectores,original,calculado,moneda,indice,alCambiar}=props;
  const material=selectores.materiales.find(m=>m.id===linea.materialId), guardada=original?.lineas.find(l=>l.id===linea.lineaId);
  const porArea=guardada&&!item.actualizarPrecio?guardada.cantidadPorArea:modalidadMaterial(material,Boolean(item.ancho&&item.alto)||item.unidadCobro==="M2")==="AREA";
  const precio=guardada&&!item.actualizarPrecio?guardada.costoUnitario:material?.precioCotizacion??material?.costoPromedio??linea.costoUnitario;
  const manuales=item.lineas.slice(0,posicion).filter(l=>!l.esGastoPersonalizado).length;
  const importe=calculado?.tipo==="PERSONALIZADO"?calculado.lineas[manuales]?.importe:null;
  function cambiar(cambios:Partial<typeof linea>){alCambiar({...item,lineas:item.lineas.map((l,i)=>i===posicion?{...linea,...cambios}:l)})}
  return <><td>
    <CampoTexto compacto id={`items.${indice}.lineas.${posicion}.cantidad`} etiqueta={porArea?"Superficie calculada (m²)":`Cantidad a utilizar (${guardada?.unidad??material?.unidadCotizacion??material?.unidad??linea.unidad})`} valor={porArea?superficieTotal(item)??"":linea.cantidad} decimal deshabilitado={porArea}
      error={props.errores[`items.${indice}.lineas.${posicion}.cantidad`]??props.errores[`items.${indice}.lineas.${posicion}.materialId`]} alCambiar={cantidad=>cambiar({cantidad})}/><small>{porArea ? "m² calculados" : guardada?.unidad ?? material?.unidadCotizacion ?? material?.unidad ?? linea.unidad}</small></td>
    <td><p className="valor-costo"><Money valor={precio} moneda={moneda}/></p>{!Number(precio)?<p className="text-sm text-destructive">Tarifa pendiente en Configuración.</p>:null}</td><td>
    <CampoTexto compacto id={`items.${indice}.lineas.${posicion}.mermaPct`} etiqueta="Desperdicio (%)" decimal valor={linea.mermaPct} error={props.errores[`items.${indice}.lineas.${posicion}.mermaPct`]} alCambiar={mermaPct=>cambiar({mermaPct})}/></td>
    <td><p className="valor-costo font-medium"><Money valor={importe} moneda={moneda}/></p></td>
  </>;
}
