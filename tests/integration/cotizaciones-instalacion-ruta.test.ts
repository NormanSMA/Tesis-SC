import { beforeAll, afterAll, expect, it } from "vitest";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { liberarClienteGlobal } from "../helpers/auth";
import { prepararCotizaciones, itemUnidad, type EntornoCotizaciones } from "./cotizaciones-ayudas";

describeConBase("cotizaciones: tarifa y distancia de instalación auditadas", () => {
  const db=crearClientePropietario(); let e:EntornoCotizaciones;
  beforeAll(async()=>{e=await prepararCotizaciones(db)});
  afterAll(async()=>{await liberarClienteGlobal();await db.$disconnect()});
  it("conserva ruta redonda, descuento de tarifa, duplicación y auditoría sin cambiar configuración", async()=>{
    const configuracion=await db.configuracion.findMany({where:{clave:{contains:"instalacion"}}});
    const inicial=await e.modulos.servicio.crearCotizacion({clienteId:e.referencias.cliente.id,asunto:"Ruta redonda",items:[itemUnidad(e.referencias)],instalacion:{manoObra:"100",km:"10",destino:"13.3,-86.49",tarifa:"12",idaVuelta:true}},e.ventas.actor);
    expect(inicial.instalacion).toMatchObject({km:"10.000",tarifa:"12.00",total:"340.00",idaVuelta:true});
    const editada=await e.modulos.servicio.editarCotizacion(inicial.id,{version:inicial.actualizadoEn,asunto:"Edición independiente"},e.ventas.actor);
    expect(editada.instalacion).toEqual(inicial.instalacion);
    const copia=await e.modulos.servicio.duplicarCotizacion(inicial.id,e.ventas.actor);
    expect(copia.instalacion).toEqual(inicial.instalacion);
    const nueva=await e.modulos.servicio.editarCotizacion(inicial.id,{version:editada.actualizadoEn,instalacion:{manoObra:"100",km:"10",destino:"13.3,-86.49",tarifa:"8",idaVuelta:true}},e.ventas.actor);
    expect(nueva.instalacion?.total).toBe("260.00");
    const eventos=await db.bitacora.findMany({where:{cotizacionId:inicial.id,accion:"EDITAR"}});
    expect(JSON.stringify(eventos)).toContain('"tarifa":"8.00"');
    expect(await db.configuracion.findMany({where:{clave:{contains:"instalacion"}}})).toEqual(configuracion);
  });
  it("no duplica retrospectivamente los kilómetros históricos",async()=>{
    const anterior=await e.modulos.servicio.crearCotizacion({clienteId:e.referencias.cliente.id,asunto:"Ruta histórica",instalacion:{manoObra:"0",km:"10",destino:"13.3,-86.49",tarifa:"16"}},e.ventas.actor);
    expect(anterior.instalacion?.total).toBe("160.00");
    const editada=await e.modulos.servicio.editarCotizacion(anterior.id,{version:anterior.actualizadoEn,asunto:"Conserva importe"},e.ventas.actor);
    expect(editada.instalacion).toEqual(anterior.instalacion);
  });
});
