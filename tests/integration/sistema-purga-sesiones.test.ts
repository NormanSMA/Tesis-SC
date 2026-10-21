import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import type { Actor } from "@/core/autorizacion";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import {
  cargarAuth, crearUsuarioPrueba, iniciarSesionPrueba, liberarClienteGlobal,
  peticion, type ModulosAuth,
} from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";

const HORA_MS = 60 * 60 * 1000;
const RUTA = "/api/v1/sistema/sesiones/purga";
const sqlPurga = readFileSync("scripts/db/purgar-sesiones.sql", "utf8");

function sesionesPrueba(usuarioId: string, ahora: Date) {
  const fecha = (horas: number) => new Date(ahora.getTime() + horas * HORA_MS);
  const estados = [
    { expiraEn: fecha(-25), revocadaEn: null },
    { expiraEn: fecha(24), revocadaEn: fecha(-25) },
    { expiraEn: fecha(-25), revocadaEn: fecha(-25) },
    { expiraEn: fecha(24), revocadaEn: null },
    { expiraEn: fecha(-1), revocadaEn: null },
    { expiraEn: fecha(24), revocadaEn: fecha(-1) },
    { expiraEn: fecha(-24), revocadaEn: null },
    { expiraEn: fecha(24), revocadaEn: fecha(-24) },
  ];
  return estados.map((estado) => ({
    id: randomUUID(), tokenHash: randomBytes(32).toString("hex"),
    usuarioId, creadoEn: fecha(-72), ...estado,
  }));
}

describeConBase("purga de sesiones del sistema", () => {
  const db = crearClientePropietario();
  let auth: ModulosAuth;
  let servicio: typeof import("@/modules/sistema/service");
  let ruta: typeof import("@/app/api/v1/sistema/sesiones/purga/route");
  let actor: Actor;
  let cookieAdmin: string;
  let cookieGerencia: string;

  beforeAll(async () => {
    await sembrarReferencia(db);
    auth = await cargarAuth();
    servicio = await import("@/modules/sistema/service");
    ruta = await import("@/app/api/v1/sistema/sesiones/purga/route");
    const admin = await crearUsuarioPrueba(db, { perfil: "ADMIN" });
    const gerencia = await crearUsuarioPrueba(db, { perfil: "GERENCIA" });
    actor = {
      id: admin.id, nombre: admin.nombre, correo: admin.correo,
      perfil: "ADMIN", perfiles: ["ADMIN"], permisos: ["configuracion:gestionar"],
    };
    const sesionAdmin = await iniciarSesionPrueba(auth, admin.correo);
    const sesionGerencia = await iniciarSesionPrueba(auth, gerencia.correo);
    expect(sesionAdmin.respuesta.status).toBe(200);
    expect(sesionGerencia.respuesta.status).toBe(200);
    cookieAdmin = sesionAdmin.cookie;
    cookieGerencia = sesionGerencia.cookie;
  });

  beforeEach(async () => {
    await servicio.purgarSesionesCaducadas(actor);
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  async function idsRestantes(ids: string[]) {
    const sesiones = await db.sesion.findMany({
      where: { id: { in: ids } }, select: { id: true }, orderBy: { id: "asc" },
    });
    return sesiones.map((sesion) => sesion.id);
  }

  it("borra solo caducadas y revocadas viejas y registra el conteo", async () => {
    const ahora = new Date();
    const sesiones = sesionesPrueba(actor.id, ahora);
    await db.sesion.createMany({ data: sesiones });
    const eventosAntes = await db.bitacora.count({ where: { usuarioId: actor.id, accion: "EDITAR" } });

    expect(await servicio.purgarSesionesCaducadas(actor, ahora)).toEqual({ borradas: 3 });
    expect(await idsRestantes(sesiones.slice(0, 3).map((sesion) => sesion.id))).toEqual([]);
    const eventos = await db.bitacora.findMany({
      where: { usuarioId: actor.id, accion: "EDITAR" }, orderBy: { creadoEn: "desc" },
    });
    expect(eventos).toHaveLength(eventosAntes + 1);
    expect(eventos[0]).toMatchObject({
      entidad: "USUARIO", entidadId: actor.id,
      detalle: { operacion: "PURGAR_SESIONES_CADUCADAS", borradas: 3 },
    });
    expect(await idsRestantes(sesiones.slice(6).map((sesion) => sesion.id)))
      .toEqual(sesiones.slice(6).map((sesion) => sesion.id).sort());
  });

  it("respeta vigentes y revocadas recientes desde la ruta POST", async () => {
    const sesiones = sesionesPrueba(actor.id, new Date());
    const conservadas = sesiones.slice(3, 6);
    await db.sesion.createMany({ data: conservadas });

    const respuesta = await ruta.POST(peticion("POST", RUTA, { cookie: cookieAdmin }));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ datos: { borradas: 0 } });
    expect(await idsRestantes(conservadas.map((sesion) => sesion.id)))
      .toEqual(conservadas.map((sesion) => sesion.id).sort());
  });

  it("rechaza con 403 sin permiso y conserva sesiones y bitácora", async () => {
    const sesiones = sesionesPrueba(actor.id, new Date());
    const ids = sesiones.map((sesion) => sesion.id);
    await db.sesion.createMany({ data: sesiones });
    const eventosAntes = await db.bitacora.count();

    const respuesta = await ruta.POST(peticion("POST", RUTA, { cookie: cookieGerencia }));

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ error: { codigo: "SIN_PERMISO" } });
    await expect(servicio.purgarSesionesCaducadas({ ...actor, permisos: [] }))
      .rejects.toMatchObject({ status: 403, codigo: "SIN_PERMISO" });
    expect(await idsRestantes(ids)).toEqual([...ids].sort());
    expect(await db.bitacora.count()).toBe(eventosAntes);
  });

  it("el SQL del archivo borra el mismo conjunto que la función", async () => {
    const [{ ahora }] = await db.$queryRaw<{ ahora: Date }[]>`SELECT now() AS ahora`;
    const sesiones = sesionesPrueba(actor.id, ahora).slice(0, 6);
    const ids = sesiones.map((sesion) => sesion.id);
    await db.sesion.createMany({ data: sesiones });

    expect(await servicio.purgarSesionesCaducadas(actor, ahora)).toEqual({ borradas: 3 });
    const conservadas = await idsRestantes(ids);
    expect(conservadas).toEqual(sesiones.slice(3).map((sesion) => sesion.id).sort());
    await db.sesion.createMany({ data: sesiones.slice(0, 3) });

    expect(await db.$executeRawUnsafe(sqlPurga)).toBe(3);
    expect(await idsRestantes(ids)).toEqual(conservadas);
    const respaldoProgramado = readFileSync("scripts/respaldo-programado.sh", "utf8");
    expect(respaldoProgramado.replace(/\r\n/g, "\n")).toContain(sqlPurga.trim());
  });
});
