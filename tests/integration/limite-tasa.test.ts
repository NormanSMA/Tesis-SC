import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { configurarLimites, reiniciarLimites } from "@/lib/limite-tasa";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import {
  cargarAuth,
  CLAVE_PRUEBA,
  crearUsuarioPrueba,
  iniciarSesionPrueba,
  liberarClienteGlobal,
  peticion,
  type ModulosAuth,
} from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";

describeConBase("ADR-017: límite de tasa HTTP", () => {
  const db = crearClientePropietario();
  let auth: ModulosAuth;

  beforeAll(async () => {
    await sembrarReferencia(db);
    auth = await cargarAuth();
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  async function comprobar429(respuesta: Response) {
    expect(respuesta.status).toBe(429);
    const reintentar = respuesta.headers.get("Retry-After");
    expect(reintentar).toMatch(/^\d+$/);
    expect(Number(reintentar)).toBeGreaterThanOrEqual(1);
    expect(await respuesta.json()).toEqual({
      error: {
        codigo: "DEMASIADAS_SOLICITUDES",
        mensaje: `Demasiadas solicitudes. Intente de nuevo en ${reintentar} segundos.`,
      },
    });
  }

  it.each([["GET", "lectura"], ["POST", "escritura"]] as const)(
    "responde 429 al tercer %s con sesión",
    async (metodo, politica) => {
      const usuario = await crearUsuarioPrueba(db);
      const { cookie } = await iniciarSesionPrueba(auth, usuario.correo);
      configurarLimites({ [politica]: { puntos: 2, duracion: 60 } });
      const ruta = auth.http.manejar({}, ({ actor }) => auth.http.ok({ actor: actor.id }));
      const solicitar = () => ruta(peticion(metodo, "/api/v1/prueba", { cookie }));
      expect((await solicitar()).status).toBe(200);
      expect((await solicitar()).status).toBe(200);
      await comprobar429(await solicitar());
    },
  );

  it("responde 429 al tercer acceso público", async () => {
    configurarLimites({ publica: { puntos: 2, duracion: 60 } });
    const ruta = auth.http.manejar({ publica: true }, () => auth.http.ok({}));
    const solicitar = () => ruta(peticion("GET", "/api/v1/prueba"));
    expect((await solicitar()).status).toBe(200);
    expect((await solicitar()).status).toBe(200);
    await comprobar429(await solicitar());
  });

  it("bloquea el tercer login fallido y la clave correcta antes de verificarla", async () => {
    const usuario = await crearUsuarioPrueba(db);
    configurarLimites({ loginFallo: { puntos: 2, duracion: 900 } });
    const servicio = await import("@/modules/auth/service");
    const iniciar = vi.spyOn(servicio, "iniciarSesion");
    try {
      for (let intento = 0; intento < 2; intento++) {
        const { respuesta } = await iniciarSesionPrueba(auth, usuario.correo, "Clave-incorrecta-123");
        expect(respuesta.status).toBe(401);
      }
      await comprobar429((await iniciarSesionPrueba(auth, usuario.correo, "Clave-incorrecta-123")).respuesta);
      await comprobar429((await iniciarSesionPrueba(auth, usuario.correo, CLAVE_PRUEBA)).respuesta);
      expect(iniciar).toHaveBeenCalledTimes(2);
      reiniciarLimites();
      expect((await iniciarSesionPrueba(auth, usuario.correo)).respuesta.status).toBe(200);
    } finally {
      iniciar.mockRestore();
    }
  });

  it("registra también los fallos 423 sin cambiar el bloqueo por cuenta", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const bloqueadoHasta = new Date(Date.now() + 900_000);
    await db.usuario.update({ where: { id: usuario.id }, data: { bloqueadoHasta } });
    configurarLimites({ loginFallo: { puntos: 2, duracion: 900 } });
    for (let intento = 0; intento < 2; intento++) {
      expect((await iniciarSesionPrueba(auth, usuario.correo)).respuesta.status).toBe(423);
    }
    await comprobar429((await iniciarSesionPrueba(auth, usuario.correo)).respuesta);
    reiniciarLimites();
    expect((await iniciarSesionPrueba(auth, usuario.correo)).respuesta.status).toBe(423);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).bloqueadoHasta).toEqual(bloqueadoHasta);
  });

  it("permite diez lecturas con los límites predeterminados", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const { cookie } = await iniciarSesionPrueba(auth, usuario.correo);
    for (let lectura = 0; lectura < 10; lectura++) {
      expect((await auth.yo.GET(peticion("GET", "/api/v1/auth/yo", { cookie }))).status).toBe(200);
    }
  });
});
