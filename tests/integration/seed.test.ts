import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { leerClaves } from "../../prisma/seed/entorno";
import { sembrar, type ResultadoSiembra } from "../../prisma/seed/sembrar";
import { verificarSiembra } from "../../prisma/seed/verificar";
import type { PrismaClient } from "@/generated/prisma/client";
import { verificarContrasena } from "@/lib/auth/password";
import { crearCliente } from "@/lib/db";

import { urlParaPg, urlPropietario } from "../helpers/entorno-bd";
import { describeConBase } from "../helpers/db";
import { comprobarParidadEstimado } from "../helpers/paridad-estimado";

// Base propia de la siembra: no toca sc_test, que comparten las demás pruebas.
const BASE_SIEMBRA = "sc_test_seed";
const raiz = path.resolve(import.meta.dirname, "..", "..");

// Claves ficticias solo para esta prueba. No salen de .env ni se comparan con las de producción.
const CLAVES = {
  SEED_PASSWORD_GERENCIA: "clave-gerencia-prueba-1",
  SEED_PASSWORD_ATENCION_CLIENTE: "clave-atencion-prueba-1",
  SEED_PASSWORD_ADMINISTRACION: "clave-administracion-prueba-1",
  SEED_PASSWORD_OPERACIONES: "clave-operaciones-prueba-1",
  SEED_PASSWORD_PRODUCCION: "clave-produccion-prueba-1",
  SEED_PASSWORD_ADMIN: "clave-admin-prueba-1",
};

function urlDeBase(url: string, base: string, usuario?: { nombre: string; clave: string }): string {
  const resultado = new URL(url);
  resultado.pathname = `/${base}`;
  if (usuario) {
    resultado.username = usuario.nombre;
    resultado.password = usuario.clave;
  }
  return resultado.toString();
}

async function conectar(url: string): Promise<Client> {
  const cliente = new Client({ connectionString: urlParaPg(url) });
  await cliente.connect();
  return cliente;
}

async function crearBaseMigrada(): Promise<void> {
  const mantenimiento = await conectar(urlDeBase(urlPropietario(), "postgres"));
  try {
    await mantenimiento.query(`DROP DATABASE IF EXISTS ${BASE_SIEMBRA} WITH (FORCE)`);
    await mantenimiento.query(`CREATE DATABASE ${BASE_SIEMBRA}`);
  } finally {
    await mantenimiento.end();
  }
  const resultado = spawnSync("pnpm exec prisma migrate deploy", {
    cwd: raiz,
    env: { ...process.env, DATABASE_URL_MIGRACION: urlDeBase(urlPropietario(), BASE_SIEMBRA) },
    encoding: "utf8",
    shell: true,
  });
  if (resultado.status !== 0) throw new Error(`prisma migrate deploy falló:\n${resultado.stdout}\n${resultado.stderr}`);
}

// Mismo SQL que scripts/db/roles.sh: la siembra corre con los permisos reales de la aplicación.
async function crearRolDeLaAplicacion(): Promise<void> {
  const clave = process.env.APP_DB_PASSWORD;
  if (!clave) throw new Error("Falta APP_DB_PASSWORD. Revisa .env.example.");
  const cliente = await conectar(urlDeBase(urlPropietario(), BASE_SIEMBRA));
  try {
    await cliente.query("SELECT set_config('sc.rol', $1, false), set_config('sc.clave', $2, false)", [
      process.env.APP_DB_USER ?? "sc_app",
      clave,
    ]);
    await cliente.query(readFileSync(path.join(raiz, "scripts", "db", "roles.sql"), "utf8"));
  } finally {
    await cliente.end();
  }
}

async function borrarBase(): Promise<void> {
  const mantenimiento = await conectar(urlDeBase(urlPropietario(), "postgres"));
  try {
    await mantenimiento.query(`DROP DATABASE IF EXISTS ${BASE_SIEMBRA} WITH (FORCE)`);
  } finally {
    await mantenimiento.end();
  }
}

async function contar(db: PrismaClient, tabla: string): Promise<number> {
  const filas = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${tabla}`);
  return Number(filas[0].n);
}

describe("claves de la siembra", () => {
  it("falla nombrando cada variable que falta", () => {
    expect(() => leerClaves({})).toThrow(
      /SEED_PASSWORD_GERENCIA.*SEED_PASSWORD_ATENCION_CLIENTE.*SEED_PASSWORD_PRODUCCION.*SEED_PASSWORD_ADMIN/,
    );
  });

  it("exige 14 caracteres y no repite la clave en el mensaje", () => {
    const corta = "corta-12345";
    let mensaje = "";
    try {
      leerClaves({ ...CLAVES, SEED_PASSWORD_ATENCION_CLIENTE: corta });
    } catch (error) {
      mensaje = (error as Error).message;
    }
    expect(mensaje).toContain("SEED_PASSWORD_ATENCION_CLIENTE");
    expect(mensaje).toContain("14 caracteres");
    expect(mensaje).not.toContain(corta);
  });

  it("devuelve una clave por perfil", () => {
    const claves = leerClaves(CLAVES);
    expect(claves.PRODUCCION).toBe(CLAVES.SEED_PASSWORD_PRODUCCION);
    expect(Object.keys(claves).sort()).toEqual(["ADMIN", "ADMINISTRACION", "ATENCION_CLIENTE", "GERENCIA", "OPERACIONES", "PRODUCCION"]);
  });
});

describeConBase("siembra de datos de demostración", () => {
  let db: PrismaClient;
  let primera: ResultadoSiembra;

  beforeAll(async () => {
    await crearBaseMigrada();
    await crearRolDeLaAplicacion();
    const url = urlDeBase(urlPropietario(), BASE_SIEMBRA, {
      nombre: process.env.APP_DB_USER ?? "sc_app",
      clave: process.env.APP_DB_PASSWORD as string,
    });
    db = crearCliente(url);
    primera = await sembrar(db, { env: CLAVES, silenciosa: true });
  });

  afterAll(async () => {
    await db?.$disconnect();
    await borrarBase();
  });

  it("corre con el rol de la aplicación, sin ser dueño de las tablas", async () => {
    const filas = await db.$queryRaw<{ usuario: string }[]>`SELECT current_user::text AS usuario`;
    expect(filas[0].usuario).toBe(process.env.APP_DB_USER ?? "sc_app");
    expect(primera.omitida).toBe(false);
  });

  it("pasa todas las comprobaciones de verificar.ts", async () => {
    const resultado = await verificarSiembra(db);
    const fallas = resultado.comprobaciones.filter((c) => !c.ok);
    expect(fallas).toEqual([]);
    expect(resultado.ok).toBe(true);
  });

  it("cubre todos los estados de cotización y de orden", async () => {
    const cotizaciones = await db.cotizacion.groupBy({ by: ["estado"], _count: true });
    const ordenes = await db.ordenTrabajo.groupBy({ by: ["estado"], _count: true });
    expect(cotizaciones.map((c) => c.estado).sort()).toEqual([
      "AJUSTE_SOLICITADO", "APROBADA", "BORRADOR", "ENVIADA", "RECHAZADA", "VENCIDA",
    ]);
    expect(Object.fromEntries(cotizaciones.map((c) => [c.estado, c._count]))).toEqual({
      AJUSTE_SOLICITADO: 1, APROBADA: 8, BORRADOR: 4, ENVIADA: 5, RECHAZADA: 3, VENCIDA: 1,
    });
    expect(ordenes.map((o) => o.estado).sort()).toEqual([
      "CANCELADA",
      "CERRADA",
      "ENTREGADA",
      "EN_PRODUCCION",
      "LISTA",
      "PENDIENTE",
    ]);
  });

  it("deja a cada cliente con al menos una cotización", async () => {
    expect(await db.cliente.count()).toBe(18);
    expect(await db.cotizacion.count()).toBe(22);
    const filas = await db.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM cliente c
       WHERE NOT EXISTS (SELECT 1 FROM cotizacion cot WHERE cot.cliente_id = c.id)`;
    expect(Number(filas[0].total)).toBe(0);
  });

  it("conserva el ajuste y enlaza su versión corregida vigente", async () => {
    const original = await db.cotizacion.findFirstOrThrow({ where: { estado: "AJUSTE_SOLICITADO" } });
    expect(original.version).toBe(1);
    expect(original.motivoAjuste?.trim().length).toBeGreaterThanOrEqual(3);
    expect(original.fechaRespuesta).not.toBeNull();
    const corregida = await db.cotizacion.findFirstOrThrow({ where: { cotizacionOrigenId: original.id } });
    expect(corregida.version).toBe(2);
    expect(corregida.estado).toBe("ENVIADA");
    expect(corregida.clienteId).toBe(original.clienteId);
    expect(corregida.creadoEn.getTime()).toBeGreaterThan(original.fechaRespuesta!.getTime());
    expect(corregida.fechaVencimiento!.getTime()).toBeGreaterThan(Date.now());
    const evento = await db.bitacora.findFirstOrThrow({
      where: { cotizacionId: original.id, estadoAnterior: "ENVIADA", estadoNuevo: "AJUSTE_SOLICITADO" },
    });
    expect(evento.accion).toBe("CAMBIAR_ESTADO");
    expect(evento.detalle).toMatchObject({ motivo: original.motivoAjuste });
    expect(evento.creadoEn).toEqual(original.fechaRespuesta);
  });

  it("numera cotizaciones y órdenes en orden cronológico de creación", async () => {
    const cotizaciones = await db.cotizacion.findMany({ orderBy: { numero: "asc" }, select: { creadoEn: true } });
    const ordenes = await db.ordenTrabajo.findMany({ orderBy: { numero: "asc" }, select: { creadoEn: true } });
    for (const lista of [cotizaciones, ordenes]) {
      const tiempos = lista.map((d) => d.creadoEn.getTime());
      expect(tiempos).toEqual([...tiempos].sort((a, b) => a - b));
    }
  });

  it("deja cada hecho en el pasado y la bitácora ordenable", async () => {
    const futuros = await db.bitacora.count({ where: { creadoEn: { gt: new Date() } } });
    expect(futuros).toBe(0);
  });

  it("el saldo de cada movimiento coincide con la suma acumulada del libro", async () => {
    const filas = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM (
        SELECT existencia_resultante,
               sum(cantidad) OVER (PARTITION BY material_id ORDER BY creado_en, id) AS acumulado
          FROM movimiento_inventario) t
       WHERE t.existencia_resultante <> t.acumulado`;
    expect(Number(filas[0].n)).toBe(0);
  });

  it("los consumos de una orden enlazan movimiento, material y orden", async () => {
    const enlaces = await db.consumoOrden.findMany({ include: { movimiento: true, orden: true } });
    expect(enlaces.length).toBeGreaterThan(0);
    for (const enlace of enlaces) {
      expect(["CONSUMO", "DEVOLUCION"]).toContain(enlace.movimiento.tipo);
      expect(enlace.movimiento.materialId).toBe(enlace.materialId);
      expect(enlace.movimiento.referencia).toBe(enlace.orden.numero);
    }
  });

  it("las cotizaciones copian IVA, moneda y vigencia de la configuración", async () => {
    const configuracion = await db.configuracion.findMany();
    const valor = (clave: string) => configuracion.find((c) => c.clave === clave)?.valor;
    expect(valor("iva_porcentaje")).toBe("15.00");
    expect(valor("cotizacion_vigencia_dias")).toBe("15");
    expect(valor("moneda")).toBe("NIO");
    expect(valor("empresa_nombre")).toBe("Soluciones Creativas");
    const cotizaciones = await db.cotizacion.findMany();
    for (const cotizacion of cotizaciones) {
      expect(cotizacion.tasaImpuesto.toString()).toBe("15");
      expect(cotizacion.moneda).toBe("NIO");
    }
  });

  it("guarda solo hashes y cada perfil entra con la clave de su variable", async () => {
    const usuarios = await db.usuario.findMany({ include: { perfiles: { include: { perfil: true } } } });
    expect(usuarios).toHaveLength(10);
    for (const usuario of usuarios) {
      expect(usuario.correo).toBe(usuario.correo.toLowerCase());
      expect(usuario.hashContrasena.startsWith("$argon2id$")).toBe(true);
      const clave = CLAVES[`SEED_PASSWORD_${usuario.perfiles[0].perfil.codigo}` as keyof typeof CLAVES];
      expect(await verificarContrasena(usuario.hashContrasena, clave)).toBe(true);
    }
  });

  it("el consumo estimado de las órdenes sembradas coincide con el del módulo de órdenes", async () => {
    await comprobarParidadEstimado(db);
  });

  it("una segunda ejecución se omite y no cambia ningún conteo", async () => {
    const tablas = ["cotizacion", "orden_trabajo", "movimiento_inventario", "bitacora", "usuario", "material", "cliente"];
    const antes = await Promise.all(tablas.map((t) => contar(db, t)));
    const segunda = await sembrar(db, { env: {}, silenciosa: true });
    const despues = await Promise.all(tablas.map((t) => contar(db, t)));
    expect(segunda.omitida).toBe(true);
    expect(despues).toEqual(antes);
  });
});
