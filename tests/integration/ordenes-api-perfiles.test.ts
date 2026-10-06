import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PerfilCodigo } from "@/core/permisos";
import type { OrdenDto } from "@/modules/ordenes/tipos";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { conPermisoRevocado } from "./cotizaciones-ayudas";
import { crearAprobada, crearOrden, entradaConversion, invocar, leerOrden, ponerEstado, prepararOrdenes, type EntornoOrdenes } from "./ordenes-ayudas";

type Operacion = "listar" | "crear" | "ver" | "editar" | "entregar" | "cerrar" | "cancelar" | "opciones";
const OPERACIONES: Operacion[] = ["listar", "crear", "ver", "editar", "entregar", "cerrar", "cancelar", "opciones"];
const ESPERADO: Record<PerfilCodigo, Record<Operacion, number>> = {
  GERENCIA: { listar: 200, crear: 403, ver: 200, editar: 200, entregar: 403, cerrar: 200, cancelar: 200, opciones: 200 },
  VENTAS: { listar: 200, crear: 201, ver: 200, editar: 200, entregar: 200, cerrar: 200, cancelar: 403, opciones: 200 },
  PRODUCCION: { listar: 200, crear: 403, ver: 200, editar: 403, entregar: 200, cerrar: 403, cancelar: 403, opciones: 403 },
  ADMIN: { listar: 403, crear: 403, ver: 403, editar: 403, entregar: 403, cerrar: 403, cancelar: 403, opciones: 403 },
};

describeConBase("órdenes: API por perfil", () => {
  const db = crearClientePropietario();
  let entorno: EntornoOrdenes;
  beforeAll(async () => { entorno = await prepararOrdenes(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  async function destino(operacion: Operacion) {
    const inicial = await crearOrden(entorno);
    if (operacion === "entregar") await ponerEstado(db, inicial.id, "LISTA");
    if (operacion === "cerrar") await ponerEstado(db, inicial.id, "ENTREGADA");
    return leerOrden(entorno, inicial.id);
  }

  async function ejecutar(operacion: Operacion, cookie: string | undefined, orden: OrdenDto) {
    const { modulos } = entorno;
    const { id, actualizadoEn: version } = orden;
    const base = `/api/v1/ordenes/${id}`;
    const nueva = operacion === "crear" ? await crearAprobada(entorno) : null;
    const rutas = {
      listar: { manejador: modulos.lista.GET, metodo: "GET", ruta: "/api/v1/ordenes", cuerpo: undefined },
      crear: { manejador: modulos.lista.POST, metodo: "POST", ruta: "/api/v1/ordenes", cuerpo: entradaConversion(entorno, nueva?.id ?? randomUUID()) },
      ver: { manejador: modulos.ficha.GET, metodo: "GET", ruta: base, cuerpo: undefined },
      editar: { manejador: modulos.ficha.PATCH, metodo: "PATCH", ruta: base, cuerpo: { version, especificaciones: "Especificaciones API" } },
      entregar: { manejador: modulos.entregar.POST, metodo: "POST", ruta: `${base}/entregar`, cuerpo: { version } },
      cerrar: { manejador: modulos.cerrar.POST, metodo: "POST", ruta: `${base}/cerrar`, cuerpo: { version } },
      cancelar: { manejador: modulos.cancelar.POST, metodo: "POST", ruta: `${base}/cancelar`, cuerpo: { version, motivo: "Cancelación API" } },
      opciones: { manejador: modulos.opciones.GET, metodo: "GET", ruta: "/api/v1/ordenes/opciones", cuerpo: undefined },
    };
    const seleccion = rutas[operacion];
    return invocar<OrdenDto>(seleccion.manejador, peticion(seleccion.metodo, seleccion.ruta, { cookie, cuerpo: seleccion.cuerpo }), id);
  }

  for (const perfil of Object.keys(ESPERADO) as PerfilCodigo[]) {
    for (const operacion of OPERACIONES) {
      it(`${perfil}: ${operacion} responde ${ESPERADO[perfil][operacion]}`, async () => {
        const orden = await destino(operacion);
        const respuesta = await ejecutar(operacion, entorno.sesiones[perfil].cookie, orden);
        expect(respuesta.status).toBe(ESPERADO[perfil][operacion]);
        if (respuesta.status === 403) expect(respuesta.error?.codigo).toBe("SIN_PERMISO");
      });
    }
  }

  it("todas las operaciones sin sesión responden 401", async () => {
    const orden = await destino("ver");
    for (const operacion of OPERACIONES) {
      const respuesta = await ejecutar(operacion, undefined, orden);
      expect(respuesta.status, operacion).toBe(401);
      expect(respuesta.error?.codigo).toBe("SIN_SESION");
    }
  });

  it("escrituras rechazadas conservan cabecera, etapas y bitácora", async () => {
    const orden = await destino("editar");
    for (const operacion of ["editar", "cerrar", "cancelar"] as const) {
      expect((await ejecutar(operacion, entorno.sesiones.PRODUCCION.cookie, orden)).status).toBe(403);
    }
    expect(await leerOrden(entorno, orden.id)).toEqual(orden);
  });

  it("revocar orden:ver afecta inmediatamente las sesiones existentes", async () => {
    const orden = await destino("ver");
    await conPermisoRevocado(db, { perfil: "PRODUCCION", permiso: "orden:ver" }, async () => {
      expect((await ejecutar("listar", entorno.sesiones.PRODUCCION.cookie, orden)).status).toBe(403);
      expect((await ejecutar("ver", entorno.sesiones.PRODUCCION.cookie, orden)).status).toBe(403);
    });
    expect((await ejecutar("ver", entorno.sesiones.PRODUCCION.cookie, orden)).status).toBe(200);
  });

  it("opciones acepta gestionar o crear y rechaza cuando faltan ambos", async () => {
    const orden = await destino("ver");
    await conPermisoRevocado(db, { perfil: "VENTAS", permiso: "orden:gestionar" }, async () => {
      expect((await ejecutar("opciones", entorno.sesiones.VENTAS.cookie, orden)).status).toBe(200);
      await conPermisoRevocado(db, { perfil: "VENTAS", permiso: "orden:crear" }, async () => {
        expect((await ejecutar("opciones", entorno.sesiones.VENTAS.cookie, orden)).status).toBe(403);
      });
    });
  });

  it("cada escritura sobre orden exige versión con 422", async () => {
    const orden = await destino("ver");
    const rutas = [entorno.modulos.ficha.PATCH, entorno.modulos.entregar.POST, entorno.modulos.cerrar.POST, entorno.modulos.cancelar.POST];
    for (const ruta of rutas) {
      const respuesta = await invocar(ruta, peticion(ruta === entorno.modulos.ficha.PATCH ? "PATCH" : "POST", `/api/v1/ordenes/${orden.id}`, {
        cookie: entorno.sesiones.GERENCIA.cookie, cuerpo: { motivo: "Motivo de prueba" },
      }), orden.id);
      if (ruta === entorno.modulos.entregar.POST) expect(respuesta.status).toBe(403);
      else { expect(respuesta.status).toBe(422); expect(respuesta.error?.campos?.version).toBeTruthy(); }
    }
    const entrega = await invocar(entorno.modulos.entregar.POST, peticion("POST", `/api/v1/ordenes/${orden.id}/entregar`, {
      cookie: entorno.sesiones.VENTAS.cookie, cuerpo: {},
    }), orden.id);
    expect(entrega.status).toBe(422);
    expect(entrega.error?.campos?.version).toBeTruthy();
  });

  it("orden inexistente o identificador inválido responde 404", async () => {
    for (const id of [randomUUID(), "id-inválido"]) {
      const respuesta = await invocar(entorno.modulos.ficha.GET, peticion("GET", `/api/v1/ordenes/${id}`, { cookie: entorno.sesiones.PRODUCCION.cookie }), id);
      expect(respuesta.status).toBe(404);
      expect(respuesta.error?.codigo).toBe("NO_ENCONTRADO");
    }
  });

  it("convertir una cotización inexistente responde 404", async () => {
    const respuesta = await invocar(entorno.modulos.lista.POST, peticion("POST", "/api/v1/ordenes", {
      cookie: entorno.sesiones.VENTAS.cookie, cuerpo: entradaConversion(entorno, randomUUID()),
    }));
    expect(respuesta.status).toBe(404);
    expect(respuesta.error?.codigo).toBe("NO_ENCONTRADO");
  });

  it("versión vieja y transición inválida responden 409", async () => {
    const orden = await destino("ver");
    const vieja = await invocar(entorno.modulos.ficha.PATCH, peticion("PATCH", `/api/v1/ordenes/${orden.id}`, {
      cookie: entorno.sesiones.VENTAS.cookie, cuerpo: { version: "2000-01-01T00:00:00.000Z", especificaciones: "Cambio viejo" },
    }), orden.id);
    expect(vieja.status).toBe(409);
    expect(vieja.error?.codigo).toBe("CONFLICTO_EDICION");
    const transicion = await ejecutar("entregar", entorno.sesiones.VENTAS.cookie, orden);
    expect(transicion.status).toBe(409);
    expect(transicion.error?.codigo).toBe("TRANSICION_INVALIDA");
  });

  it("doble conversión devuelve 409 y el número de orden existente", async () => {
    const orden = await destino("ver");
    const respuesta = await invocar(entorno.modulos.lista.POST, peticion("POST", "/api/v1/ordenes", {
      cookie: entorno.sesiones.VENTAS.cookie, cuerpo: entradaConversion(entorno, orden.cotizacion.id),
    }));
    expect(respuesta.status).toBe(409);
    expect(respuesta.error?.codigo).toBe("ORDEN_EXISTENTE");
    expect(respuesta.error?.mensaje).toContain(orden.numero);
  });

  it("rechaza fecha inválida, motivo corto, identificadores y filtros con 422", async () => {
    const orden = await destino("ver");
    const cambio = await invocar(entorno.modulos.ficha.PATCH, peticion("PATCH", `/api/v1/ordenes/${orden.id}`, {
      cookie: entorno.sesiones.VENTAS.cookie, cuerpo: { version: orden.actualizadoEn, fechaEntrega: "2026-02-30", responsableId: "inválido" },
    }), orden.id);
    expect(cambio.status).toBe(422);
    expect(cambio.error?.campos?.fechaEntrega).toBeTruthy();
    expect(cambio.error?.campos?.responsableId).toBeTruthy();
    const motivo = await invocar(entorno.modulos.cancelar.POST, peticion("POST", `/api/v1/ordenes/${orden.id}/cancelar`, {
      cookie: entorno.sesiones.GERENCIA.cookie, cuerpo: { version: orden.actualizadoEn, motivo: "no" },
    }), orden.id);
    expect(motivo.status).toBe(422);
    const filtro = await invocar(entorno.modulos.lista.GET, peticion("GET", "/api/v1/ordenes?pagina=0&estado=AVANZADA", { cookie: entorno.sesiones.PRODUCCION.cookie }));
    expect(filtro.status).toBe(422);
  });

  it("JSON inválido responde 400 y origen ajeno responde 403", async () => {
    const req = new Request("http://localhost/api/v1/ordenes", { method: "POST", headers: {
      origin: "http://localhost", cookie: entorno.sesiones.VENTAS.cookie,
    }, body: "{json inválido" });
    expect((await invocar(entorno.modulos.lista.POST, req)).status).toBe(400);
    const cotizacion = await crearAprobada(entorno);
    expect((await invocar(entorno.modulos.lista.POST, peticion("POST", "/api/v1/ordenes", {
      cookie: entorno.sesiones.VENTAS.cookie, origen: "http://otro.example", cuerpo: entradaConversion(entorno, cotizacion.id),
    }))).status).toBe(403);
    expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(0);
  });
});
