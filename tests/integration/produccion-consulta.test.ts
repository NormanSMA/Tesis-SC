import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { consumir } from "./inventario-consumo-ayudas";
import { leerOrden } from "./ordenes-ayudas";
import { asignarEtapa, nuevaOrden, prepararProduccion, type EntornoProduccion } from "./produccion-ayudas";

const db = crearClientePropietario();
let entorno: EntornoProduccion;

function registrarTrazabilidad() {
  it("CF-09 vincula conversión, cliente, cotización, consumo y ejecución de etapas", async () => {
    const orden = await nuevaOrden(entorno);
    const materialId = orden.consumosEstimados[0].material.id;
    const { registrarEntrada } = await import("@/modules/inventario/libro");
    await registrarEntrada({ materialId, cantidad: "20", costoUnitario: "2850" }, entorno.ordenes.sesiones.ADMINISTRACION.actor, randomUUID());
    const respuesta = await consumir(entorno.consumo, { ordenId: orden.id, lineas: [{ materialId, cantidad: "2" }] });
    expect(respuesta.movimientos).toHaveLength(1);
    const asignada = await asignarEtapa(entorno, orden.etapas[0]);
    const iniciada = await entorno.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor);
    await entorno.servicio.completarEtapa(asignada.id, { version: iniciada.actualizadoEn }, entorno.actor);
    const ficha = await entorno.ordenes.modulos.servicio.obtenerOrden(orden.id, entorno.actor);
    const resumen = await entorno.consumo.modulos.resumen.obtenerResumenOrden(orden.id, entorno.ordenes.sesiones.ADMINISTRACION.actor);
    await expect(entorno.consumo.modulos.resumen.obtenerResumenOrden(orden.id, entorno.actor))
      .rejects.toMatchObject({ status: 403 });
    const etapas = await entorno.servicio.obtenerEtapasOrden(orden.id, entorno.actor);
    expect(ficha.cliente.id).toBe(entorno.ordenes.cotizaciones.referencias.cliente.id);
    expect(ficha.cotizacion.id).toBe(orden.cotizacion.id);
    expect(etapas[0].estado).toBe("COMPLETADA");
    expect(resumen.materiales.find((fila) => fila.material.id === materialId)?.neto).toBe("2.000");
    expect(resumen.movimientos[0].id).toBe(respuesta.movimientos[0].id);
    expect(ficha.eventos.filter((evento) => evento.entidad === "MOVIMIENTO_INVENTARIO")).toHaveLength(1);
    expect(ficha.eventos.some((evento) => evento.accion === "CONVERTIR_EN_ORDEN")).toBe(true);
    expect(JSON.stringify(ficha)).not.toMatch(/precioUnitario|costoUnitario|subtotal|costoTotal/);
    expect(resumen.movimientos[0]).toHaveProperty("costoUnitario");
  });
}

function registrarAgrupacion() {
  it("tablero agrupa por área y responsable con atraso de fecha de Managua", async () => {
    const orden = await nuevaOrden(entorno);
    const primera = await entorno.servicio.editarEtapa(orden.etapas[0].id, { version: orden.etapas[0].actualizadoEn,
      responsableId: entorno.actor.id, fechaFinPlan: "2000-01-01" }, entorno.planificador);
    const tablero = await entorno.servicio.obtenerTablero({ q: orden.numero }, entorno.actor);
    expect(tablero.datos).toHaveLength(2);
    expect(tablero.datos.find((fila) => fila.id === primera.id)?.atrasada).toBe(true);
    expect(tablero.porArea[0].etapas).toHaveLength(2);
    expect(tablero.porResponsable.find((grupo) => grupo.id === entorno.actor.id)?.etapas[0].id).toBe(primera.id);
    expect(tablero.porResponsable.find((grupo) => grupo.id === null)?.nombre).toBe("Sin responsable");
  });
}

function registrarFiltros() {
  it("filtros combinados seleccionan etapa, área, responsable, estado y texto literal", async () => {
    const orden = await nuevaOrden(entorno);
    const asignada = await asignarEtapa(entorno, orden.etapas[0]);
    const iniciada = await entorno.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor);
    const tablero = await entorno.servicio.obtenerTablero({ area: asignada.area.id, responsable: entorno.actor.id, estado: "EN_CURSO", q: orden.numero }, entorno.actor);
    expect(tablero.datos.map((fila) => fila.id)).toEqual([iniciada.id]);
    expect((await entorno.servicio.obtenerTablero({ q: "%_" }, entorno.actor)).datos).toEqual([]);
    expect((await entorno.servicio.obtenerTablero({ responsable: randomUUID() }, entorno.actor)).datos).toEqual([]);
  });
}

function registrarVisibilidad() {
  it("tablero nunca muestra dinero para ningún perfil autorizado", async () => {
    const orden = await nuevaOrden(entorno);
    for (const perfil of ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMIN"] as const) {
      if (perfil === "ADMIN") {
        await expect(entorno.servicio.obtenerTablero({ q: orden.numero }, entorno.ordenes.sesiones[perfil].actor))
          .rejects.toMatchObject({ status: 403 });
        continue;
      }
      const tablero = await entorno.servicio.obtenerTablero({ q: orden.numero }, entorno.ordenes.sesiones[perfil].actor);
      expect(tablero.datos).toHaveLength(2);
      expect(JSON.stringify(tablero)).not.toMatch(/subtotal|impuesto|precio|costo|totalCotizacion|margen|moneda/);
      expect(Object.keys(tablero.datos[0].orden).sort()).toEqual(["estado", "fechaEntrega", "id", "numero"]);
    }
  });
}

function registrarTerminales() {
  it("terminales no aparecen aunque conserven etapas abiertas", async () => {
    for (const estado of ["ENTREGADA", "CERRADA", "CANCELADA"] as const) {
      const orden = await nuevaOrden(entorno);
      const asignada = await asignarEtapa(entorno, orden.etapas[0]);
      await entorno.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor);
      const actual = await leerOrden(entorno.ordenes, orden.id);
      if (estado === "CANCELADA") await entorno.ordenes.modulos.servicio.cancelarOrden(orden.id,
        { version: actual.actualizadoEn, motivo: "Cancelada por cliente" }, entorno.operaciones);
      else {
        await db.ordenTrabajo.update({ where: { id: orden.id }, data: { estado: "LISTA" } });
        const lista = await leerOrden(entorno.ordenes, orden.id);
        const entregada = await entorno.ordenes.modulos.servicio.entregarOrden(orden.id, lista.actualizadoEn, entorno.operaciones);
        if (estado === "CERRADA") await entorno.ordenes.modulos.servicio.cerrarOrden(orden.id, entregada.actualizadoEn, entorno.operaciones);
      }
      expect((await entorno.servicio.obtenerTablero({ q: orden.numero }, entorno.actor)).datos).toEqual([]);
      expect((await entorno.servicio.obtenerEtapasOrden(orden.id, entorno.actor))[0].estado).toBe("EN_CURSO");
    }
  });
}

describeConBase("producción: consulta y CF-09", () => {
  beforeAll(async () => { entorno = await prepararProduccion(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  registrarTrazabilidad();
  registrarAgrupacion();
  registrarFiltros();
  registrarVisibilidad();
  registrarTerminales();
});
