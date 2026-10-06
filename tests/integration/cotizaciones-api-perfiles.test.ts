import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PerfilCodigo } from "@/core/permisos";
import type { CotizacionDto } from "@/modules/cotizaciones/tipos";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  abrirSesion, conPermisoRevocado, crearBorrador, entradaExistente, invocar, itemUnidad,
  nombreUnico, prepararCotizaciones, type EntornoCotizaciones, type SesionCotizacion,
} from "./cotizaciones-ayudas";

type Operacion = "listar" | "crear" | "ver" | "editar" | "items" | "enviar" | "responder" | "duplicar" | "archivar";
const OPERACIONES: Operacion[] = ["listar", "crear", "ver", "editar", "items", "enviar", "responder", "duplicar", "archivar"];
const ESPERADO: Record<PerfilCodigo, Record<Operacion, number>> = {
  GERENCIA: { listar: 200, crear: 403, ver: 200, editar: 403, items: 403, enviar: 403, responder: 200, duplicar: 403, archivar: 403 },
  VENTAS: { listar: 200, crear: 201, ver: 200, editar: 200, items: 200, enviar: 200, responder: 200, duplicar: 201, archivar: 200 },
  PRODUCCION: { listar: 403, crear: 403, ver: 403, editar: 403, items: 403, enviar: 403, responder: 403, duplicar: 403, archivar: 403 },
  ADMIN: { listar: 403, crear: 403, ver: 403, editar: 403, items: 403, enviar: 403, responder: 403, duplicar: 403, archivar: 403 },
};

describeConBase("cotizaciones: API por perfil y validaciones", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  const sesiones = {} as Record<PerfilCodigo, SesionCotizacion>;
  beforeAll(async () => {
    entorno = await prepararCotizaciones(db);
    sesiones.VENTAS = entorno.ventas;
    for (const perfil of ["GERENCIA", "PRODUCCION", "ADMIN"] as const) {
      sesiones[perfil] = await abrirSesion(db, entorno.modulos, perfil);
    }
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  async function destino(operacion: Operacion) {
    const cotizacion = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    return operacion === "responder"
      ? entorno.modulos.servicio.enviarCotizacion(cotizacion.id, cotizacion.actualizadoEn, entorno.ventas.actor)
      : cotizacion;
  }

  function ejecutar(operacion: Operacion, cookie: string | undefined, cotizacion: CotizacionDto) {
    const { modulos, referencias } = entorno;
    const { id, actualizadoEn: version } = cotizacion;
    const base = `/api/v1/cotizaciones/${id}`;
    const rutas = {
      listar: { manejador: modulos.lista.GET, metodo: "GET", ruta: "/api/v1/cotizaciones", cuerpo: undefined },
      crear: { manejador: modulos.lista.POST, metodo: "POST", ruta: "/api/v1/cotizaciones",
        cuerpo: { clienteId: referencias.cliente.id, asunto: nombreUnico() } },
      ver: { manejador: modulos.ficha.GET, metodo: "GET", ruta: base, cuerpo: undefined },
      editar: { manejador: modulos.ficha.PATCH, metodo: "PATCH", ruta: base, cuerpo: { version, asunto: "Asunto editado" } },
      items: { manejador: modulos.items.PUT, metodo: "PUT", ruta: `${base}/items`,
        cuerpo: { version, items: [{ ...entradaExistente(cotizacion.items[0]), cantidad: "2" }] } },
      enviar: { manejador: modulos.enviar.POST, metodo: "POST", ruta: `${base}/enviar`, cuerpo: { version } },
      responder: { manejador: modulos.responder.POST, metodo: "POST", ruta: `${base}/responder`, cuerpo: { version, resultado: "APROBADA" } },
      duplicar: { manejador: modulos.duplicar.POST, metodo: "POST", ruta: `${base}/duplicar`, cuerpo: {} },
      archivar: { manejador: modulos.archivar.POST, metodo: "POST", ruta: `${base}/archivar`, cuerpo: { version } },
    };
    const seleccion = rutas[operacion];
    return invocar<CotizacionDto>(seleccion.manejador, peticion(seleccion.metodo, seleccion.ruta, {
      cookie, cuerpo: seleccion.cuerpo, origen: seleccion.metodo === "GET" ? null : undefined,
    }), ["listar", "crear"].includes(operacion) ? undefined : id);
  }

  for (const perfil of Object.keys(ESPERADO) as PerfilCodigo[]) {
    describe(`perfil ${perfil}`, () => {
      for (const operacion of OPERACIONES) {
        it(`${operacion} responde ${ESPERADO[perfil][operacion]}`, async () => {
          const cotizacion = await destino(operacion);
          const respuesta = await ejecutar(operacion, sesiones[perfil].cookie, cotizacion);
          expect(respuesta.status).toBe(ESPERADO[perfil][operacion]);
          if (respuesta.status === 403) expect(respuesta.error?.codigo).toBe("SIN_PERMISO");
        });
      }
    });
  }

  it("sin sesión todas las operaciones responden 401", async () => {
    const cotizacion = await destino("ver");
    for (const operacion of OPERACIONES) {
      const respuesta = await ejecutar(operacion, undefined, cotizacion);
      expect(respuesta.status, operacion).toBe(401);
      expect(respuesta.error?.codigo).toBe("SIN_SESION");
    }
  });

  it("escrituras rechazadas conservan la cotización y su bitácora", async () => {
    const cotizacion = await destino("editar");
    const eventos = await db.bitacora.count({ where: { cotizacionId: cotizacion.id } });
    for (const perfil of ["GERENCIA", "PRODUCCION", "ADMIN"] as const) {
      for (const operacion of ["editar", "items", "enviar", "archivar"] as const) {
        expect((await ejecutar(operacion, sesiones[perfil].cookie, cotizacion)).status).toBe(403);
      }
    }
    expect(await entorno.modulos.servicio.obtenerCotizacion(cotizacion.id)).toEqual(cotizacion);
    expect(await db.bitacora.count({ where: { cotizacionId: cotizacion.id } })).toBe(eventos);
  });

  it("revocar cotizacion:ver se aplica a sesiones existentes y restaurarlo recupera acceso", async () => {
    const cotizacion = await destino("ver");
    await conPermisoRevocado(db, { perfil: "VENTAS", permiso: "cotizacion:ver" }, async () => {
      for (const operacion of ["listar", "ver"] as const) {
        expect((await ejecutar(operacion, sesiones.VENTAS.cookie, cotizacion)).status).toBe(403);
      }
    });
    expect((await ejecutar("ver", sesiones.VENTAS.cookie, cotizacion)).status).toBe(200);
  });

  it("revocar cotizacion:gestionar bloquea escrituras y restaurarlo recupera acceso", async () => {
    const cotizacion = await destino("editar");
    await conPermisoRevocado(db, { perfil: "VENTAS", permiso: "cotizacion:gestionar" }, async () => {
      for (const operacion of ["crear", "editar", "items", "duplicar", "archivar"] as const) {
        expect((await ejecutar(operacion, sesiones.VENTAS.cookie, cotizacion)).status).toBe(403);
      }
    });
    expect((await ejecutar("editar", sesiones.VENTAS.cookie, cotizacion)).status).toBe(200);
  });

  it("revocar catalogo:ver bloquea el catálogo y restaurarlo recupera acceso", async () => {
    const consultar = () => invocar(entorno.modulos.catalogo.GET, peticion("GET", "/api/v1/productos", {
      cookie: sesiones.VENTAS.cookie, origen: null,
    }));
    expect((await consultar()).status).toBe(200);
    await conPermisoRevocado(db, { perfil: "VENTAS", permiso: "catalogo:ver" }, async () => {
      expect((await consultar()).status).toBe(403);
    });
    expect((await consultar()).status).toBe(200);
  });

  it("toda escritura existente exige versión con 422", async () => {
    const cotizacion = await destino("responder");
    const rutas = [
      { manejador: entorno.modulos.ficha.PATCH, metodo: "PATCH", sufijo: "", cuerpo: { asunto: "Cambio" } },
      { manejador: entorno.modulos.items.PUT, metodo: "PUT", sufijo: "/items", cuerpo: { items: [] } },
      { manejador: entorno.modulos.enviar.POST, metodo: "POST", sufijo: "/enviar", cuerpo: {} },
      { manejador: entorno.modulos.responder.POST, metodo: "POST", sufijo: "/responder", cuerpo: { resultado: "APROBADA" } },
      { manejador: entorno.modulos.archivar.POST, metodo: "POST", sufijo: "/archivar", cuerpo: {} },
    ];
    for (const ruta of rutas) {
      const respuesta = await invocar(ruta.manejador, peticion(ruta.metodo, `/api/v1/cotizaciones/${cotizacion.id}${ruta.sufijo}`, {
        cookie: sesiones.VENTAS.cookie, cuerpo: ruta.cuerpo,
      }), cotizacion.id);
      expect(respuesta.status).toBe(422);
      expect(respuesta.error?.campos?.version).toBeTruthy();
    }
  });

  it("rechaza asunto vacío, JSON inválido y motivo de rechazo ausente", async () => {
    const cotizacion = await destino("responder");
    const creacion = await invocar(entorno.modulos.lista.POST, peticion("POST", "/api/v1/cotizaciones", {
      cookie: sesiones.VENTAS.cookie, cuerpo: { clienteId: entorno.referencias.cliente.id, asunto: " " },
    }));
    expect(creacion.status).toBe(422);
    expect(creacion.error?.campos?.asunto).toBeTruthy();
    const rechazo = await invocar(entorno.modulos.responder.POST, peticion("POST", `/api/v1/cotizaciones/${cotizacion.id}/responder`, {
      cookie: sesiones.VENTAS.cookie, cuerpo: { version: cotizacion.actualizadoEn, resultado: "RECHAZADA" },
    }), cotizacion.id);
    expect(rechazo.status).toBe(422);
    expect(rechazo.error?.campos?.motivo).toBeTruthy();
    const invalida = new Request("http://localhost/api/v1/cotizaciones", {
      method: "POST", headers: { origin: "http://localhost", cookie: sesiones.VENTAS.cookie }, body: "{json inválido",
    });
    expect((await invocar(entorno.modulos.lista.POST, invalida)).status).toBe(400);
  });

  it("rechaza itemId duplicado con 422 en la API", async () => {
    const cotizacion = await destino("items");
    const item = entradaExistente(cotizacion.items[0]);
    const respuesta = await invocar(entorno.modulos.items.PUT, peticion("PUT", `/api/v1/cotizaciones/${cotizacion.id}/items`, {
      cookie: sesiones.VENTAS.cookie, cuerpo: { version: cotizacion.actualizadoEn, items: [item, item] },
    }), cotizacion.id);
    expect(respuesta.status).toBe(422);
    expect(respuesta.error?.campos?.["items.1.itemId"]).toBeTruthy();
  });

  it("recalcula montos y descarta importes enviados por el cliente", async () => {
    const cotizacion = await destino("items");
    const respuesta = await invocar<CotizacionDto>(entorno.modulos.items.PUT, peticion("PUT", `/api/v1/cotizaciones/${cotizacion.id}/items`, {
      cookie: sesiones.VENTAS.cookie, cuerpo: { version: cotizacion.actualizadoEn, total: "1", subtotal: "1",
        items: [{ ...entradaExistente(cotizacion.items[0]), precioUnitario: "1", importe: "1", cantidad: "2" }] },
    }), cotizacion.id);
    expect(respuesta.status).toBe(200);
    expect(respuesta.datos).toMatchObject({ subtotal: "2640.00", impuesto: "396.00", total: "3036.00" });
  });

  it("devuelve 404 para identificadores ausentes o mal formados", async () => {
    for (const id of [randomUUID(), "abc"]) {
      const respuesta = await invocar(entorno.modulos.ficha.GET, peticion("GET", `/api/v1/cotizaciones/${id}`, {
        cookie: sesiones.VENTAS.cookie, origen: null,
      }), id);
      expect(respuesta.status).toBe(404);
      expect(respuesta.error?.codigo).toBe("NO_ENCONTRADO");
    }
  });

  it("rechaza origen ajeno aunque exista permiso de gestión", async () => {
    const respuesta = await invocar(entorno.modulos.lista.POST, peticion("POST", "/api/v1/cotizaciones", {
      cookie: sesiones.VENTAS.cookie, origen: "https://sitio-ajeno.example",
      cuerpo: { clienteId: entorno.referencias.cliente.id, asunto: nombreUnico() },
    }));
    expect(respuesta.status).toBe(403);
    expect(respuesta.error?.codigo).toBe("ORIGEN_NO_PERMITIDO");
  });
});
