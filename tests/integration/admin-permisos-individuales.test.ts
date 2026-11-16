import { afterAll, beforeAll, expect, it } from "vitest";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { abrirSesion, crearBorrador, prepararCotizaciones, type EntornoCotizaciones } from "./cotizaciones-ayudas";
import { invocar } from "../helpers/fabricas";
import { versionPermisos } from "@/modules/admin/permisos-dto";

describeConBase("permisos adicionales y privacidad comercial", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  let servicio: typeof import("@/modules/admin/permisos-usuario");
  beforeAll(async () => {
    entorno = await prepararCotizaciones(db);
    servicio = await import("@/modules/admin/permisos-usuario");
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("un permiso individual habilita y revoca acceso en una sesión existente sin afectar al compañero de perfil", async () => {
    const gerente = await abrirSesion(db, entorno.modulos, "GERENCIA");
    const primera = await abrirSesion(db, entorno.modulos, "ADMINISTRACION");
    const segunda = await abrirSesion(db, entorno.modulos, "ADMINISTRACION");
    const cot = await crearBorrador(entorno);
    const leer = (cookie: string) => invocar(entorno.modulos.ficha.GET, peticion("GET", "/api/v1/cotizaciones/" + cot.id, { cookie }), cot.id);
    expect((await leer(primera.cookie)).status).toBe(404);
    const concedido = await servicio.guardarAccesosIndividuales(primera.usuarioId,
      { permisos: ["cotizacion:ver_todas"], version: versionPermisos([]) }, gerente.actor);
    expect((await leer(primera.cookie)).status).toBe(200);
    expect((await leer(segunda.cookie)).status).toBe(404);
    await expect(servicio.guardarAccesosIndividuales(primera.usuarioId,
      { permisos: [], version: versionPermisos([]) }, gerente.actor)).rejects.toMatchObject({ status: 409 });
    await servicio.guardarAccesosIndividuales(primera.usuarioId, { permisos: [], version: concedido.version }, gerente.actor);
    expect((await leer(primera.cookie)).status).toBe(404);
    expect(await db.bitacora.count({ where: { entidadId: primera.usuarioId,
      accion: { in: ["OTORGAR_PERMISO", "REVOCAR_PERMISO"] } } })).toBe(2);
  });

  it("cada usuario puede crear y editar su cotización, y los listados excluyen las ajenas", async () => {
    const otra = await abrirSesion(db, entorno.modulos, "ATENCION_CLIENTE");
    const propia = await entorno.modulos.servicio.crearCotizacion({ clienteId: entorno.referencias.cliente.id, asunto: "Propia" }, otra.actor);
    const ajena = await crearBorrador(entorno);
    expect((await entorno.modulos.servicio.editarCotizacion(propia.id,
      { version: propia.actualizadoEn, asunto: "Editada" }, otra.actor)).asunto).toBe("Editada");
    await expect(entorno.modulos.servicio.editarCotizacion(ajena.id,
      { version: ajena.actualizadoEn, asunto: "Ajena" }, otra.actor)).rejects.toMatchObject({ status: 404 });
    const lista = await invocar<{ id: string }[]>(entorno.modulos.lista.GET, peticion("GET", "/api/v1/cotizaciones", { cookie: otra.cookie }));
    expect(lista.datos.map(c => c.id)).toEqual([propia.id]);
  });

  it("Administración no puede otorgarse permisos", async () => {
    const admin = await abrirSesion(db, entorno.modulos, "ADMINISTRACION");
    await expect(servicio.guardarAccesosIndividuales(admin.usuarioId,
      { permisos: ["cotizacion:ver_todas"], version: versionPermisos([]) }, admin.actor)).rejects.toMatchObject({ status: 403 });
    expect(await db.usuarioPermiso.count({ where: { usuarioId: admin.usuarioId } })).toBe(0);
  });
});
