import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PerfilCodigo } from "@/core/permisos";
import type { MaterialDto } from "@/modules/inventario/dto";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { clienteInventario, crearMaterial, entradaMaterial, invocar, peticionLibro, prepararInventario, recibir, type EntornoInventario } from "./inventario-ayudas";

const OPERACIONES = ["listar", "crear", "ver", "editar", "archivar", "reactivar", "libro", "movimientos", "entrada", "ajuste"] as const;
type Operacion = typeof OPERACIONES[number];
const PERMITIDAS: Record<PerfilCodigo, readonly Operacion[]> = {
  GERENCIA: ["listar", "crear", "ver", "editar", "archivar", "reactivar", "libro", "movimientos", "ajuste"],
  VENTAS: ["listar", "ver", "libro", "movimientos"],
  PRODUCCION: ["listar", "crear", "ver", "editar", "archivar", "reactivar", "libro", "movimientos", "entrada"], ADMIN: [],
};
describe("inventario: API por perfil", () => {
  const db = clienteInventario();
  let entorno: EntornoInventario;
  beforeAll(async () => { entorno = await prepararInventario(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  async function ejecutar(operacion: Operacion, cookie?: string) {
    let material = await crearMaterial(entorno);
    if (operacion === "reactivar") material = await entorno.modulos.servicio.cambiarActivoMaterial(
      { id: material.id, version: material.actualizadoEn, activo: false }, entorno.sesiones.PRODUCCION.actor);
    const { modulos } = entorno; const base = `/api/v1/materiales/${material.id}`;
    const rutas = {
      listar: { manejador: modulos.lista.GET, metodo: "GET", ruta: "/api/v1/materiales", cuerpo: undefined },
      crear: { manejador: modulos.lista.POST, metodo: "POST", ruta: "/api/v1/materiales", cuerpo: entradaMaterial() },
      ver: { manejador: modulos.ficha.GET, metodo: "GET", ruta: base, cuerpo: undefined },
      editar: { manejador: modulos.ficha.PATCH, metodo: "PATCH", ruta: base, cuerpo: { version: material.actualizadoEn, nombre: "Edición API" } },
      archivar: { manejador: modulos.archivar.POST, metodo: "POST", ruta: `${base}/archivar`, cuerpo: { version: material.actualizadoEn } },
      reactivar: { manejador: modulos.reactivar.POST, metodo: "POST", ruta: `${base}/reactivar`, cuerpo: { version: material.actualizadoEn } },
      libro: { manejador: modulos.libro.GET, metodo: "GET", ruta: `${base}/movimientos`, cuerpo: undefined },
      movimientos: { manejador: modulos.movimientos.GET, metodo: "GET", ruta: "/api/v1/movimientos", cuerpo: undefined },
      entrada: { manejador: modulos.entrada.POST, metodo: "POST", ruta: "/api/v1/inventario/entradas", cuerpo: { materialId: material.id, cantidad: "1", costoUnitario: "5" } },
      ajuste: { manejador: modulos.ajuste.POST, metodo: "POST", ruta: "/api/v1/inventario/ajustes", cuerpo: { materialId: material.id, cantidad: "1", direccion: "AUMENTAR", motivo: "Conteo físico" } },
    };
    const ruta = rutas[operacion];
    const solicitud = peticion(ruta.metodo, ruta.ruta, { cookie, cuerpo: ruta.cuerpo });
    solicitud.headers.set("Idempotency-Key", randomUUID());
    return invocar(ruta.manejador, solicitud, material.id);
  }
  for (const perfil of Object.keys(PERMITIDAS) as PerfilCodigo[]) {
    for (const operacion of OPERACIONES) {
      it(`${perfil}: ${operacion}`, async () => {
        const respuesta = await ejecutar(operacion, entorno.sesiones[perfil].cookie);
        const permitido = PERMITIDAS[perfil].includes(operacion);
        const status = ["crear", "entrada", "ajuste"].includes(operacion) ? 201 : 200;
        expect(respuesta.status).toBe(permitido ? status : 403);
        if (!permitido) expect(respuesta.error?.codigo).toBe("SIN_PERMISO");
      });
    }
  }
  it("todas las rutas requieren sesión con 401", async () => {
    for (const operacion of OPERACIONES) expect((await ejecutar(operacion)).status, operacion).toBe(401);
  });
  it("lectura y escrituras con material inexistente responden 404", async () => {
    const cookie = entorno.sesiones.PRODUCCION.cookie;
    for (const id of [randomUUID(), "invalido"]) {
      for (const manejador of [entorno.modulos.ficha.GET, entorno.modulos.libro.GET]) {
        expect((await invocar(manejador, peticion("GET", `/api/v1/materiales/${id}`, { cookie }), id)).status).toBe(404);
      }
    }
    expect((await invocar(entorno.modulos.entrada.POST, peticionLibro({ ruta: "/api/v1/inventario/entradas", cookie,
      cuerpo: { materialId: randomUUID(), cantidad: "1", costoUnitario: "1" } }))).status).toBe(404);
  });
  it("editar, archivar y reactivar exigen versión con 422", async () => {
    const material = await crearMaterial(entorno); const cookie = entorno.sesiones.PRODUCCION.cookie;
    for (const manejador of [entorno.modulos.ficha.PATCH, entorno.modulos.archivar.POST, entorno.modulos.reactivar.POST]) {
      const respuesta = await invocar(manejador, peticion(manejador === entorno.modulos.ficha.PATCH ? "PATCH" : "POST", `/api/v1/materiales/${material.id}`, { cookie, cuerpo: {} }), material.id);
      expect(respuesta.status).toBe(422); expect(respuesta.error?.campos?.version).toBeTruthy();
    }
  });
  it("entrada y ajuste exigen Idempotency-Key y rechazan cantidad inválida", async () => {
    const material = await crearMaterial(entorno);
    for (const [manejador, cookie, cuerpo] of [
      [entorno.modulos.entrada.POST, entorno.sesiones.PRODUCCION.cookie, { materialId: material.id, cantidad: "1", costoUnitario: "0" }],
      [entorno.modulos.ajuste.POST, entorno.sesiones.GERENCIA.cookie, { materialId: material.id, cantidad: "1", direccion: "AUMENTAR", motivo: "Conteo físico" }],
    ] as const) {
      for (const clave of [null, "invalida"]) expect((await invocar(manejador, peticionLibro({ ruta: "/api/v1/inventario", cookie, cuerpo, clave }))).status).toBe(422);
      expect((await invocar(manejador, peticionLibro({ ruta: "/api/v1/inventario", cookie, cuerpo: { ...cuerpo, cantidad: "0" } }))).status).toBe(422);
    }
  });
  it("reintentos de entrada y ajuste responden 200 con repetida true", async () => {
    const material = await crearMaterial(entorno);
    for (const [manejador, cookie, cuerpo] of [
      [entorno.modulos.entrada.POST, entorno.sesiones.PRODUCCION.cookie, { materialId: material.id, cantidad: "1", costoUnitario: "0" }],
      [entorno.modulos.ajuste.POST, entorno.sesiones.GERENCIA.cookie, { materialId: material.id, cantidad: "1", direccion: "AUMENTAR", motivo: "Conteo físico" }],
    ] as const) {
      const entrada = { ruta: "/api/v1/inventario", cookie, cuerpo, clave: randomUUID() };
      expect((await invocar(manejador, peticionLibro(entrada))).status).toBe(201);
      const repetida = await invocar<{ repetida: boolean }>(manejador, peticionLibro(entrada));
      expect(repetida.status).toBe(200); expect(repetida.datos.repetida).toBe(true);
    }
  });
  it("version vieja y archivar con existencia responden 409", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id);
    const cookie = entorno.sesiones.PRODUCCION.cookie;
    const archivo = await invocar(entorno.modulos.archivar.POST, peticion("POST", `/api/v1/materiales/${material.id}/archivar`,
      { cookie, cuerpo: { version: material.actualizadoEn } }), material.id);
    expect(archivo.status).toBe(409); expect(archivo.error?.codigo).toBe("MATERIAL_CON_EXISTENCIA");
    const edicion = await invocar(entorno.modulos.ficha.PATCH, peticion("PATCH", `/api/v1/materiales/${material.id}`,
      { cookie, cuerpo: { version: "2000-01-01T00:00:00.000Z", nombre: "No persistir" } }), material.id);
    expect(edicion.status).toBe(409); expect(edicion.error?.codigo).toBe("CONFLICTO_EDICION");
  });
  it("rechaza unidad mutable, motivo corto, filtros inválidos y JSON inválido", async () => {
    const material = await crearMaterial(entorno); const cookie = entorno.sesiones.PRODUCCION.cookie;
    const mutable = await invocar(entorno.modulos.ficha.PATCH, peticion("PATCH", "/api/v1/materiales", { cookie,
      cuerpo: { version: material.actualizadoEn, unidad: "LITRO" } }), material.id);
    expect(mutable.status).toBe(422);
    const ajuste = await invocar(entorno.modulos.ajuste.POST, peticionLibro({ ruta: "/api/v1/inventario/ajustes",
      cookie: entorno.sesiones.GERENCIA.cookie, cuerpo: { materialId: material.id, cantidad: "1", direccion: "AUMENTAR", motivo: "1234" } }));
    expect(ajuste.status).toBe(422); expect(ajuste.error?.campos?.motivo).toBeTruthy();
    for (const [ruta, manejador] of [["/api/v1/materiales?pagina=0", entorno.modulos.lista.GET], ["/api/v1/movimientos?desde=ayer", entorno.modulos.movimientos.GET]] as const) {
      expect((await invocar(manejador, peticion("GET", ruta, { cookie }))).status).toBe(422);
    }
    const solicitud = peticion("POST", "/api/v1/materiales", { cookie });
    const invalida = new Request(solicitud.url, { method: "POST", headers: solicitud.headers, body: "{" });
    expect((await invocar(entorno.modulos.lista.POST, invalida)).status).toBe(400);
  });
  it("respuesta de alta mantiene decimales como cadenas", async () => {
    const respuesta = await invocar<MaterialDto>(entorno.modulos.lista.POST, peticion("POST", "/api/v1/materiales", {
      cookie: entorno.sesiones.PRODUCCION.cookie, cuerpo: entradaMaterial() }));
    expect(respuesta.status).toBe(201); expect(typeof respuesta.datos.existencia).toBe("string");
    expect(typeof respuesta.datos.costoPromedio).toBe("string");
  });
});
