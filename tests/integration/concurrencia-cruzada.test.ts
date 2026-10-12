/*
 * Cobertura existente: búsqueda de Promise.all en tests/integration.
 * Administración: configuración (admin-configuracion-api.test.ts:151),
 * permisos (admin-permisos-api.test.ts:213) y administradores (admin-usuarios-servicio.test.ts:181).
 * Auth: fallos simultáneos contra bloqueo (auth-login.test.ts:218).
 * Catálogo: recetas, edición contra receta y versiones (catalogo-lista-concurrencia.test.ts:58,71,83).
 * Clientes: ediciones, edición contra archivo y archivos (clientes-concurrencia.test.ts:62,81,97,121).
 * Cotizaciones: reemplazos y envío contra edición (cotizaciones-concurrencia.test.ts:32,48).
 * Inventario: consumidores, materiales cruzados, idempotencia, entradas y ajustes.
 * Inventario: archivo contra entrada (inventario-materiales.test.ts:77).
 * Órdenes: ediciones y entregas duplicadas (ordenes-servicio.test.ts:119,228).
 * Producción usa carrera(), cuyo Promise.all está en produccion-ayudas.ts:81.
 * Producción cubre inicios, completados, cancelación, archivo de área y retrabajo.
 * Producción cubre consumo contra lista (produccion-concurrencia.test.ts:115).
 * Excluir creación de fixtures, consultas y desconexiones: no representan carreras.
 *
 * Carrera 1: no aplica añadirla; ordenes-conversion.test.ts:120-135 ya cubre
 * conversiones duplicadas, conflicto, una orden, etapas y bitácora persistidas.
 * Carrera 2: no aplica añadirla; inventario-concurrencia.test.ts:74-153 cubre
 * consumo/cancelación, ambos órdenes de bloqueo y conciliación del libro.
 * Carrera 3: cubrir entrega contra cancelación aquí.
 * Carrera 4: cubrir inicio contra lista aquí; no repetir creación/restauración,
 * cubiertas por produccion-concurrencia.test.ts:134-153.
 * Carrera 5: cubrir aprobación contra archivo aquí.
 * Carrera 6: no aplica añadirla; inventario-concurrencia.test.ts:155-169 cubre
 * devoluciones que superan el consumo, rechazo, saldo y trazabilidad persistidos.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion, crearBorrador, itemUnidad } from "./cotizaciones-ayudas";
import {
  asignarEtapa, nuevaOrden, prepararLista, prepararProduccion, type EntornoProduccion,
} from "./produccion-ayudas";

const RONDAS = 6;

function exigirUnGanador(resultados: PromiseSettledResult<unknown>[]) {
  expect(resultados.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter(({ status }) => status === "rejected")).toHaveLength(1);
  const rechazo = resultados.find((resultado) => resultado.status === "rejected");
  if (rechazo?.status !== "rejected") throw new Error("Falta el rechazo concurrente.");
  expect(rechazo.reason).toMatchObject({ status: 409 });
}

describeConBase("concurrencia cruzada: carreras pendientes entre módulos", () => {
  // El propietario prepara y consulta; los servicios usan el cliente global de aplicación.
  const db = crearClientePropietario();
  let entorno: EntornoProduccion;
  let segundaVenta: Awaited<ReturnType<typeof abrirSesion>>;
  let segundaProduccion: Awaited<ReturnType<typeof abrirSesion>>;

  beforeAll(async () => {
    entorno = await prepararProduccion(db);
    const modulos = entorno.ordenes.cotizaciones.modulos;
    segundaVenta = await abrirSesion(db, modulos, "ATENCION_CLIENTE");
    segundaProduccion = await abrirSesion(db, modulos, "PRODUCCION");
  });
  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  it("3: entregar contra cancelar deja una transición coherente con el historial", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const preparada = await prepararLista(entorno);
      const orden = await entorno.servicio.marcarLista(preparada.id,
        { version: preparada.actualizadoEn }, entorno.actor);
      const servicio = entorno.ordenes.modulos.servicio;
      const entregar = () => servicio.entregarOrden(orden.id, orden.actualizadoEn,
        entorno.ordenes.sesiones.ATENCION_CLIENTE.actor);
      const cancelar = () => servicio.cancelarOrden(orden.id,
        { version: orden.actualizadoEn, motivo: "Cancelación contra entrega" }, entorno.operaciones);
      const operaciones = ronda % 2 ? [cancelar, entregar] : [entregar, cancelar];
      const resultados = await Promise.allSettled(operaciones.map((ejecutar) => ejecutar()));
      exigirUnGanador(resultados);
      const rechazo = resultados.find((resultado) => resultado.status === "rejected");
      if (rechazo?.status === "rejected") {
        expect(rechazo.reason).toMatchObject({ codigo: "CONFLICTO_EDICION" });
      }
      const final = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } });
      const ganoEntrega = resultados[ronda % 2 ? 1 : 0].status === "fulfilled";
      expect(final.estado).toBe(ganoEntrega ? "ENTREGADA" : "CANCELADA");
      expect(final.fechaEntregaReal !== null).toBe(ganoEntrega);
      expect(final.motivoCancelacion).toBe(ganoEntrega ? null : "Cancelación contra entrega");
      const eventos = await db.bitacora.findMany({ where: {
        ordenId: orden.id, entidad: "ORDEN_TRABAJO", estadoNuevo: { in: ["ENTREGADA", "CANCELADA"] },
      } });
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({ entidadId: orden.id, estadoAnterior: "LISTA", estadoNuevo: final.estado });
      expect(await db.etapaOrden.count({ where: {
        ordenId: orden.id, estado: { in: ["PENDIENTE", "EN_CURSO"] },
      } })).toBe(0);
    }
  });

  it("4: marcar lista contra iniciar una etapa pendiente conserva la orden en producción", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const orden = await nuevaOrden(entorno);
      const primera = await asignarEtapa(entorno, orden.etapas[0]);
      const iniciada = await entorno.servicio.iniciarEtapa(primera.id,
        { version: primera.actualizadoEn }, entorno.actor);
      await entorno.servicio.completarEtapa(iniciada.id, { version: iniciada.actualizadoEn }, entorno.actor);
      const pendiente = await asignarEtapa(entorno, orden.etapas[1]);
      const actual = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } });
      // Iniciar exige PENDIENTE; esa etapa impide LISTA antes y después del inicio.
      const lista = () => entorno.servicio.marcarLista(orden.id,
        { version: actual.actualizadoEn.toISOString() }, entorno.actor);
      const iniciar = () => entorno.servicio.iniciarEtapa(pendiente.id,
        { version: pendiente.actualizadoEn }, segundaProduccion.actor);
      const operaciones = ronda % 2 ? [iniciar, lista] : [lista, iniciar];
      const resultados = await Promise.allSettled(operaciones.map((ejecutar) => ejecutar()));
      exigirUnGanador(resultados);
      expect(resultados[ronda % 2 ? 0 : 1].status).toBe("fulfilled");
      const rechazo = resultados[ronda % 2 ? 1 : 0];
      if (rechazo.status === "rejected") {
        expect(rechazo.reason).toMatchObject({ codigo: "ETAPAS_ABIERTAS" });
      }
      const final = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } });
      expect(final.estado).toBe("EN_PRODUCCION");
      expect(final.fechaInicioReal).toEqual(actual.fechaInicioReal);
      const etapa = await db.etapaOrden.findUniqueOrThrow({ where: { id: pendiente.id } });
      expect(etapa.estado).toBe("EN_CURSO");
      expect(etapa.fechaInicioReal).not.toBeNull();
      const eventos = await db.bitacora.findMany({ where: {
        ordenId: orden.id, estadoNuevo: { in: ["LISTA", "EN_CURSO"] },
      } });
      expect(eventos.filter((evento) => evento.estadoNuevo === "LISTA")).toHaveLength(0);
      expect(eventos.filter((evento) => evento.entidadId === pendiente.id)).toHaveLength(1);
    }
  });

  it("5: aprobar contra archivar una cotización conserva solo el cambio ganador", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const cotizaciones = entorno.ordenes.cotizaciones;
      const servicio = cotizaciones.modulos.servicio;
      const borrador = await crearBorrador(cotizaciones, { items: [itemUnidad(cotizaciones.referencias)] });
      const enviada = await servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, cotizaciones.ventas.actor);
      const previos = await db.bitacora.findMany({ where: { entidadId: enviada.id } });
      const aprobar = () => servicio.responderCotizacion(enviada.id, {
        version: enviada.actualizadoEn, resultado: "APROBADA", referenciaAprobacion: "Aprobación concurrente",
      }, cotizaciones.ventas.actor);
      const archivar = () => servicio.archivarCotizacion(enviada.id, enviada.actualizadoEn, segundaVenta.actor);
      const operaciones = ronda % 2 ? [archivar, aprobar] : [aprobar, archivar];
      const resultados = await Promise.allSettled(operaciones.map((ejecutar) => ejecutar()));
      exigirUnGanador(resultados);
      const ganoAprobacion = resultados[ronda % 2 ? 1 : 0].status === "fulfilled";
      const final = await db.cotizacion.findUniqueOrThrow({ where: { id: enviada.id } });
      expect(final.estado).toBe(ganoAprobacion ? "APROBADA" : "ENVIADA");
      expect(final.archivada).toBe(!ganoAprobacion);
      expect(final.referenciaAprobacion).toBe(ganoAprobacion ? "Aprobación concurrente" : null);
      const eventos = await db.bitacora.findMany({ where: {
        entidadId: enviada.id, id: { notIn: previos.map((evento) => evento.id) },
      } });
      expect(eventos).toHaveLength(1);
      if (ganoAprobacion) {
        expect(eventos[0]).toMatchObject({ estadoAnterior: "ENVIADA", estadoNuevo: "APROBADA" });
      } else {
        expect(eventos[0]).toMatchObject({ accion: "ARCHIVAR" });
      }
      expect(await db.ordenTrabajo.count({ where: { cotizacionId: enviada.id } })).toBe(0);
    }
  });
});
