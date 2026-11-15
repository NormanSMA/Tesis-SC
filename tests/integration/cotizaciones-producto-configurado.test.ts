import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { crearClientePropietario,describeConBase } from "../helpers/db";
import { liberarClienteGlobal } from "../helpers/auth";
import { prepararCotizaciones,crearBorrador,itemPersonalizado,type EntornoCotizaciones } from "./cotizaciones-ayudas";
import { aEntradaItem } from "@/modules/cotizaciones/calculo";
import { gastosIniciales } from "@/modules/personalizadas/gastos-schema";

describeConBase("cotizaciones: producto configurado como instantánea",()=>{
  const db=crearClientePropietario();let e:EntornoCotizaciones;
  beforeAll(async()=>{e=await prepararCotizaciones(db)});
  afterAll(async()=>{await liberarClienteGlobal();await db.$disconnect()});
  it("conserva selección, materiales, costos y duplicado aunque no se consulte el registro del tipo",async()=>{
    const producto={id:randomUUID(),nombre:"Fascia",materiales:[e.referencias.material.id]};
    const inicial=await crearBorrador(e,{items:[{...itemPersonalizado(e.referencias),productoPersonalizado:producto}]});
    expect(inicial.items[0].productoPersonalizado).toEqual(producto);
    const guardada=await e.modulos.servicio.reemplazarItems(inicial.id,{version:inicial.actualizadoEn,items:[aEntradaItem(inicial.items[0])]},e.ventas.actor);
    expect(guardada.items[0]).toEqual(inicial.items[0]);
    const copia=await e.modulos.servicio.duplicarCotizacion(inicial.id,e.ventas.actor);
    expect(copia.items[0].productoPersonalizado).toEqual(producto);expect(copia.total).toBe(inicial.total);
    const datos=aEntradaItem(guardada.items[0]);
    if(datos.tipo!=="PERSONALIZADO")throw Error("Producto incorrecto");
    const manual=await e.modulos.servicio.reemplazarItems(inicial.id,{version:guardada.actualizadoEn,items:[{...datos,actualizarPrecio:true,productoPersonalizado:null}]},e.ventas.actor);
    expect(manual.items[0].productoPersonalizado).toBeUndefined();expect(manual.total).toBe(guardada.total);
    expect(JSON.stringify(await db.bitacora.findMany({where:{cotizacionId:inicial.id}}))).toContain('"productoPersonalizado"');
  });
  it("guarda y recarga horas de un servicio sin exigir costos manuales adicionales",async()=>{
    const original=itemPersonalizado(e.referencias);
    const inicial=await crearBorrador(e,{items:[{...original,margenPct:"30",lineas:[],productoPersonalizado:{id:randomUUID(),nombre:"Diseño",materiales:[]},gastosPersonalizados:{...gastosIniciales("NIO"),horasPersona:"2",tarifaHora:"350"}}]});
    expect(inicial.items[0]).toMatchObject({costoTotal:"700.00",importe:"1000.00"});
    expect(inicial.items[0].lineas).toHaveLength(1);expect(inicial.items[0].lineas[0].esGastoPersonalizado).toBe(true);
    const recargada=await e.modulos.servicio.reemplazarItems(inicial.id,{version:inicial.actualizadoEn,items:[aEntradaItem(inicial.items[0])]},e.ventas.actor);
    expect(recargada.items[0]).toEqual(inicial.items[0]);
  });
});
