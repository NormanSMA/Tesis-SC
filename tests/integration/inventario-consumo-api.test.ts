import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PerfilCodigo } from "@/core/permisos";
import type { RespuestaMovimientosOrden, ResumenOrdenInventario } from "@/modules/inventario/contrato-orden";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { consumir, crearMaterial, nuevaOrden, peticionOrden, prepararConsumo, type EntornoConsumo } from "./inventario-consumo-ayudas";
import { invocar, ponerEstado } from "./ordenes-ayudas";

type Operacion = "consumir" | "devolver" | "resumen";
const ESPERADO: Record<PerfilCodigo, Record<Operacion, number>> = {
  GERENCIA: { consumir: 403, devolver: 403, resumen: 200 },
  VENTAS: { consumir: 403, devolver: 403, resumen: 200 },
  PRODUCCION: { consumir: 201, devolver: 201, resumen: 200 },
  ADMIN: { consumir: 403, devolver: 403, resumen: 403 },
};

describeConBase("inventario: API de consumo y devolución por perfil", () => {
  const db = crearClientePropietario();
  let entorno: EntornoConsumo;
  beforeAll(async () => { entorno = await prepararConsumo(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  function cookie(perfil: PerfilCodigo) {
    return entorno.ordenes.sesiones[perfil].cookie;
  }

  async function ordenConConsumo() {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10", costo: "7.25" });
    await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "2" }] });
    return { orden, material, lineas: [{ materialId: material.id, cantidad: "1" }] };
  }

  type Llamada = { operacion: Operacion; ordenId: string; cookie?: string; cuerpo?: unknown; clave?: string | null };
  function llamar<T = RespuestaMovimientosOrden>({ operacion, ordenId, cookie: galleta, cuerpo, clave }: Llamada) {
    const { consumos, devoluciones } = entorno.modulos;
    if (operacion === "resumen") {
      return invocar<T>(consumos.GET, peticionOrden(`/api/v1/ordenes/${ordenId}/consumos`, { metodo: "GET", cookie: galleta, clave: null }), ordenId);
    }
    const ruta = `/api/v1/ordenes/${ordenId}/${operacion === "consumir" ? "consumos" : "devoluciones"}`;
    const manejador = operacion === "consumir" ? consumos.POST : devoluciones.POST;
    return invocar<T>(manejador, peticionOrden(ruta, { cookie: galleta, cuerpo, clave }), ordenId);
  }

  for (const perfil of Object.keys(ESPERADO) as PerfilCodigo[]) {
    for (const operacion of ["consumir", "devolver", "resumen"] as Operacion[]) {
      it(`${perfil}: ${operacion} responde ${ESPERADO[perfil][operacion]}`, async () => {
        const { orden, lineas } = await ordenConConsumo();
        const respuesta = await llamar({ operacion, ordenId: orden.id, cookie: cookie(perfil), cuerpo: { lineas } });
        expect(respuesta.status).toBe(ESPERADO[perfil][operacion]);
        if (respuesta.status === 403) expect(respuesta.error?.codigo).toBe("SIN_PERMISO");
      });
    }
  }

  it("sin sesión responde 401 en las tres rutas", async () => {
    const { orden, lineas } = await ordenConConsumo();
    for (const operacion of ["consumir", "devolver", "resumen"] as Operacion[]) {
      const respuesta = await llamar({ operacion, ordenId: orden.id, cuerpo: { lineas } });
      expect(respuesta.status).toBe(401);
    }
  });

  it("orden inexistente o id inválido responde 404", async () => {
    const { lineas } = await ordenConConsumo();
    for (const ordenId of [randomUUID(), "no-es-uuid"]) {
      expect((await llamar({ operacion: "consumir", ordenId, cookie: cookie("PRODUCCION"), cuerpo: { lineas } })).status).toBe(404);
      expect((await llamar({ operacion: "resumen", ordenId, cookie: cookie("GERENCIA") })).status).toBe(404);
    }
  });

  it("exige Idempotency-Key válida y repite la respuesta con 200", async () => {
    const { orden, lineas } = await ordenConConsumo();
    const base = { operacion: "consumir" as const, ordenId: orden.id, cookie: cookie("PRODUCCION"), cuerpo: { lineas } };
    const sinClave = await llamar({ ...base, clave: null });
    expect(sinClave).toMatchObject({ status: 422, error: { codigo: "VALIDACION", campos: { "Idempotency-Key": expect.any(String) } } });
    expect((await llamar({ ...base, clave: "no-es-uuid" })).status).toBe(422);
    const clave = randomUUID();
    const primera = await llamar({ ...base, clave });
    const segunda = await llamar({ ...base, clave });
    expect([primera.status, segunda.status]).toEqual([201, 200]);
    expect(primera.datos.repetida).toBe(false);
    expect(segunda.datos).toEqual({ ...primera.datos, repetida: true });
  });

  it("valida el cuerpo con 422 por campo", async () => {
    const { orden, material } = await ordenConConsumo();
    const base = { operacion: "consumir" as const, ordenId: orden.id, cookie: cookie("PRODUCCION") };
    const casos: [unknown, string][] = [
      [{ lineas: [] }, "lineas"],
      [{ lineas: [{ materialId: material.id, cantidad: "0" }] }, "lineas.0.cantidad"],
      [{ lineas: [{ materialId: material.id, cantidad: "1.0001" }] }, "lineas.0.cantidad"],
      [{ lineas: [{ materialId: material.id, cantidad: "1" }, { materialId: material.id, cantidad: "2" }] }, "lineas.1.materialId"],
      [{ lineas: [{ materialId: randomUUID(), cantidad: "1" }] }, "lineas.0.materialId"],
    ];
    for (const [cuerpo, campo] of casos) {
      const respuesta = await llamar({ ...base, cuerpo });
      expect(respuesta.status).toBe(422);
      expect(respuesta.error?.campos).toHaveProperty([campo]);
    }
  });

  it("responde 409 por estado de la orden, existencia y tope de devolución", async () => {
    const { orden, material } = await ordenConConsumo();
    const produccion = cookie("PRODUCCION");
    const insuficiente = await llamar({ operacion: "consumir", ordenId: orden.id, cookie: produccion,
      cuerpo: { lineas: [{ materialId: material.id, cantidad: "8.001" }] } });
    expect(insuficiente).toMatchObject({ status: 409, error: { codigo: "EXISTENCIA_INSUFICIENTE",
      campos: { "lineas.0.cantidad": expect.stringContaining("disponible 8.000") } } });
    const excede = await llamar({ operacion: "devolver", ordenId: orden.id, cookie: produccion,
      cuerpo: { lineas: [{ materialId: material.id, cantidad: "2.001" }] } });
    expect(excede).toMatchObject({ status: 409, error: { codigo: "DEVOLUCION_EXCEDE_CONSUMO" } });
    await ponerEstado(db, orden.id, "CERRADA");
    for (const operacion of ["consumir", "devolver"] as Operacion[]) {
      const respuesta = await llamar({ operacion, ordenId: orden.id, cookie: produccion,
        cuerpo: { lineas: [{ materialId: material.id, cantidad: "1" }] } });
      expect(respuesta).toMatchObject({ status: 409, error: { codigo: "ORDEN_NO_ADMITE_CONSUMO" } });
    }
  });

  it("muestra costos de movimientos ligados a la orden solo con cotizacion:ver", async () => {
    const { orden } = await ordenConConsumo();
    const produccionPost = await llamar({ operacion: "consumir", ordenId: orden.id, cookie: cookie("PRODUCCION"),
      cuerpo: { lineas: [{ materialId: (await crearMaterial(entorno, { existencia: "3" })).id, cantidad: "1" }] } });
    expect(produccionPost.status).toBe(201);
    expect(produccionPost.datos.movimientos[0]).not.toHaveProperty("costoUnitario");
    for (const perfil of ["GERENCIA", "VENTAS"] as PerfilCodigo[]) {
      const resumen = await llamar<ResumenOrdenInventario>({ operacion: "resumen", ordenId: orden.id, cookie: cookie(perfil) });
      expect(resumen.datos.movimientos.find((m) => m.costoUnitario === "7.2500")).toBeDefined();
      expect(resumen.datos.movimientos.every((m) => m.costoPromedioResultante !== undefined)).toBe(true);
    }
    const produccion = await llamar<ResumenOrdenInventario>({ operacion: "resumen", ordenId: orden.id, cookie: cookie("PRODUCCION") });
    expect(produccion.datos.movimientos).toHaveLength(2);
    expect(produccion.datos.movimientos.some((m) => "costoUnitario" in m || "costoPromedioResultante" in m)).toBe(false);
  });
});
