import { describe, expect, it } from "vitest";
import { aplicarProducto } from "@/modules/personalizadas/seleccion";
import { gastosIniciales } from "@/modules/personalizadas/gastos-schema";
import { calcularVista } from "@/modules/cotizaciones/calculo";
import { esquemaItem, type EntradaItem } from "@/modules/cotizaciones/schema";
import type { SelectoresEditor } from "@/modules/cotizaciones/tipos";

const id="00000000-0000-4000-8000-000000000001",m2="00000000-0000-4000-8000-000000000002",unidad="00000000-0000-4000-8000-000000000003";
const selectores:SelectoresEditor={categorias:[{id,nombre:"Rotulación"}],productos:[],materiales:[
  {id:m2,codigo:"L",nombre:"Lona",unidad:"M2",unidadCotizacion:"M2",costoPromedio:"0",precioCotizacion:"100"},
  {id:unidad,codigo:"T",nombre:"Tubo",unidad:"UNIDAD",costoPromedio:"0",precioCotizacion:"50"},
]};
const vacio:Extract<EntradaItem,{tipo:"PERSONALIZADO"}>={tipo:"PERSONALIZADO",categoriaId:id,descripcion:"",cantidad:"2",ancho:"1",alto:"0.8",unidadCobro:"UNIDAD",margenPct:"30",lineas:[]};
const tipo={id,nombre:"Fascia",unidadCobro:"UNIDAD" as const,margenPct:"30",materiales:[m2,unidad]};
const vista=(item:EntradaItem)=>calcularVista({items:[item],originales:[],selectores,descuento:"0",tasaImpuesto:"0"});
describe("cotizaciones: elegir un producto carga su cálculo",()=>{
  it("calcula de inmediato con sus materiales y las medidas sin captura manual",()=>{
    const elegido=aplicarProducto({tipo,item:vacio,selectores,moneda:"NIO"});
    expect(elegido.lineas).toHaveLength(2);expect(elegido.productoPersonalizado?.nombre).toBe("Fascia");
    expect(vista(elegido).errores).toEqual({});expect(vista(elegido).items[0]).toMatchObject({costoTotal:"210.00",importe:"300.00"});
    expect(aplicarProducto({tipo,item:elegido,selectores,moneda:"NIO"}).lineas).toHaveLength(2);
  });
  it("al cambiar el producto sustituye sugerencias anteriores y conserva otros costos",()=>{
    const elegido=aplicarProducto({tipo,item:{...vacio,lineas:[{tipo:"TERCERO",descripcion:"Servicio adicional",unidad:"servicio",costo:"40"}]},selectores,moneda:"NIO"});
    const otro=aplicarProducto({tipo:{...tipo,id:unidad,nombre:"Letrero",materiales:[unidad]},item:elegido,selectores,moneda:"NIO"});
    expect(otro.lineas).toHaveLength(2);expect(otro.lineas.some(l=>l.tipo==="TERCERO")).toBe(true);expect(otro.descripcion).toBe("Letrero");
  });
  it("permite servicios sin materiales cuando se registran horas reales de trabajo",()=>{
    const servicio={...vacio,cantidad:"1",descripcion:"Diseño",gastosPersonalizados:{...gastosIniciales("NIO"),horasPersona:"2",tarifaHora:"350"}};
    expect(esquemaItem.safeParse(servicio).success).toBe(true);
    expect(vista(servicio).errores).toEqual({});expect(vista(servicio).items[0]).toMatchObject({costoTotal:"700.00",importe:"1000.00"});
    expect(esquemaItem.safeParse({...servicio,gastosPersonalizados:{...gastosIniciales("NIO"),rentaModo:"PORCENTAJE",rentaValor:"8"}}).success).toBe(false);
  });
});
