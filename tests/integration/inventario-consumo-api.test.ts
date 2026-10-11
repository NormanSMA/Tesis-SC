import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PerfilCodigo } from "@/core/permisos";
import type { RespuestaMovimientosOrden, ResumenOrdenInventario } from "@/modules/inventario/contrato-orden";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { consumir, crearMaterial, nuevaOrden, peticionOrden, prepararConsumo, type EntornoConsumo } from "./inventario-consumo-ayudas";
import { invocar, ponerEstado } from "./ordenes-ayudas";

type Operacion = "consumir" | "devolver" | "resumen";
// Matriz v9: consumir y devolver exigen inventario:consumir; el resumen exige orden:ver e inventario:ver.
const ESPERADO: Record<PerfilCodigo, Record<Operacion, number>> = {
  GERENCIA: { consumir: 403, devolver: 403, resumen: 200 },
  ADMINISTRACION: { consumir: 201, devolver: 201, resumen: 200 },
  OPERACIONES: { consumir: 403, devolver: 403, resumen: 200 },
  ATENCION_CLIENTE: { consumir: 403, devolver: 403, resumen: 403 },
  PRODUCCION: { consumir: 403, devolver: 403, resumen: 403 },
  ADMIN: { consumir: 403, devolver: 403, resumen: 403 },
};

describeConBase("inventario: API de consumo y devolución por perfil", () => {
  const db = crearClientePropietario();
  let entorno: EntornoConsumo;
  beforeAll(async () => { entorno = await prepararConsumo(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  function cookie(perfil: PerfilCodigo) {
    return entorno.sesiones[perfil].cookie;
  }

  function estadoInventario(materialId: string, ordenId: string) {
    return db.$queryRaw<{ existencia: string; movimientos: number; consumos: number; bitacora: number }[]>`
      SELECT m.existencia::text AS existencia,
        (SELECT COUNT(*)::int FROM movimiento_inventario WHERE material_id = m.id) AS movimientos,
        (SELECT COUNT(*)::int FROM consumo_orden
          WHERE material_id = m.id OR orden_id = ${ordenId}::uuid) AS consumos,
        (SELECT COUNT(*)::int FROM bitacora b
          WHERE b.orden_id = ${ordenId}::uuid
            OR (b.entidad = 'MATERIAL' AND b.entidad_id = m.id)
            OR b.detalle->>'materialId' = m.id::text
            OR b.detalle->'material'->>'id' = m.id::text
            OR (b.entidad = 'MOVIMIENTO_INVENTARIO' AND EXISTS (
              SELECT 1 FROM movimiento_inventario v WHERE v.id = b.entidad_id AND v.material_id = m.id))) AS bitacora
      FROM material m WHERE m.id = ${materialId}::uuid`;
  }

  async function llamarSinCambios(materialId: string, solicitud: Llamada) {
    const antes = await estadoInventario(materialId, solicitud.ordenId);
    const respuesta = await llamar(solicitud);
    expect(await estadoInventario(materialId, solicitud.ordenId)).toEqual(antes);
    return respuesta;
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
        const { orden, material, lineas } = await ordenConConsumo();
        const solicitud = { operacion, ordenId: orden.id, cookie: cookie(perfil), cuerpo: { lineas } };
        const respuesta = ESPERADO[perfil][operacion] === 403
          ? await llamarSinCambios(material.id, solicitud) : await llamar(solicitud);
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
      expect((await llamar({ operacion: "consumir", ordenId, cookie: cookie("ADMINISTRACION"), cuerpo: { lineas } })).status).toBe(404);
      expect((await llamar({ operacion: "resumen", ordenId, cookie: cookie("GERENCIA") })).status).toBe(404);
    }
  });

  it("exige Idempotency-Key válida y repite la respuesta con 200", async () => {
    const { orden, material, lineas } = await ordenConConsumo();
    const base = { operacion: "consumir" as const, ordenId: orden.id, cookie: cookie("ADMINISTRACION"), cuerpo: { lineas } };
    for (const operacion of ["consumir", "devolver"] as const) {
      for (const clave of [null, "no-es-uuid"]) {
        const respuesta = await llamarSinCambios(material.id, { ...base, operacion, clave });
        expect(respuesta).toMatchObject({ status: 422, error: { codigo: "VALIDACION", campos: { "Idempotency-Key": expect.any(String) } } });
      }
    }
    const clave = randomUUID();
    const primera = await llamar({ ...base, clave });
    const segunda = await llamar({ ...base, clave });
    expect([primera.status, segunda.status]).toEqual([201, 200]);
    expect(primera.datos.repetida).toBe(false);
    expect(segunda.datos).toEqual({ ...primera.datos, repetida: true });
    expect(await db.consumoOrden.findMany({ where: { idempotencyKey: clave }, select: { movimientoId: true } }))
      .toEqual([{ movimientoId: primera.datos.movimientos[0].id }]);
  });

  it("guarda Idempotency-Key de la solicitud de devolución", async () => {
    const { orden, lineas } = await ordenConConsumo();
    const clave = randomUUID();
    const respuesta = await llamar({ operacion: "devolver", ordenId: orden.id,
      cookie: cookie("ADMINISTRACION"), cuerpo: { lineas }, clave });
    expect(respuesta.status).toBe(201);
    expect(await db.consumoOrden.findUniqueOrThrow({ where: { movimientoId: respuesta.datos.movimientos[0].id } }))
      .toMatchObject({ ordenId: orden.id, idempotencyKey: clave });
  });

  it("valida el cuerpo con 422 por campo", async () => {
    const { orden, material } = await ordenConConsumo();
    const base = { ordenId: orden.id, cookie: cookie("ADMINISTRACION") };
    const casos: [unknown, string][] = [
      [{ lineas: [] }, "lineas"],
      [{ lineas: [{ materialId: material.id, cantidad: "0" }] }, "lineas.0.cantidad"],
      [{ lineas: [{ materialId: material.id, cantidad: "1.0001" }] }, "lineas.0.cantidad"],
      [{ lineas: [{ materialId: material.id, cantidad: "1" }, { materialId: material.id, cantidad: "2" }] }, "lineas.1.materialId"],
      [{ lineas: [{ materialId: randomUUID(), cantidad: "1" }] }, "lineas.0.materialId"],
    ];
    for (const operacion of ["consumir", "devolver"] as const) {
      for (const [cuerpo, campo] of casos) {
        const respuesta = await llamarSinCambios(material.id, { ...base, operacion, cuerpo });
        expect(respuesta.status).toBe(422);
        expect(respuesta.error?.campos).toHaveProperty([campo]);
      }
    }
  });

  it("responde 409 por estado de la orden, existencia y tope de devolución", async () => {
    const { orden, material } = await ordenConConsumo();
    const administracion = cookie("ADMINISTRACION");
    const insuficiente = await llamarSinCambios(material.id, { operacion: "consumir", ordenId: orden.id, cookie: administracion,
      cuerpo: { lineas: [{ materialId: material.id, cantidad: "8.001" }] } });
    expect(insuficiente).toMatchObject({ status: 409, error: { codigo: "EXISTENCIA_INSUFICIENTE",
      campos: { "lineas.0.cantidad": expect.stringContaining("disponible 8.000") } } });
    const excede = await llamarSinCambios(material.id, { operacion: "devolver", ordenId: orden.id, cookie: administracion,
      cuerpo: { lineas: [{ materialId: material.id, cantidad: "2.001" }] } });
    expect(excede).toMatchObject({ status: 409, error: { codigo: "DEVOLUCION_EXCEDE_CONSUMO" } });
    await ponerEstado(db, orden.id, "CERRADA");
    for (const operacion of ["consumir", "devolver"] as Operacion[]) {
      const respuesta = await llamarSinCambios(material.id, { operacion, ordenId: orden.id, cookie: administracion,
        cuerpo: { lineas: [{ materialId: material.id, cantidad: "1" }] } });
      expect(respuesta).toMatchObject({ status: 409, error: { codigo: "ORDEN_NO_ADMITE_CONSUMO" } });
    }
  });

  it("muestra costos de movimientos ligados a la orden a todo perfil con inventario:ver y cotizacion:ver", async () => {
    const { orden } = await ordenConConsumo();
    const administracionPost = await llamar({ operacion: "consumir", ordenId: orden.id, cookie: cookie("ADMINISTRACION"),
      cuerpo: { lineas: [{ materialId: (await crearMaterial(entorno, { existencia: "3" })).id, cantidad: "1" }] } });
    expect(administracionPost.status).toBe(201);
    expect(administracionPost.datos.movimientos[0]).toHaveProperty("costoUnitario");
    for (const perfil of ["GERENCIA", "ADMINISTRACION", "OPERACIONES"] as PerfilCodigo[]) {
      const resumen = await llamar<ResumenOrdenInventario>({ operacion: "resumen", ordenId: orden.id, cookie: cookie(perfil) });
      expect(resumen.status).toBe(200);
      expect(resumen.datos.movimientos).toHaveLength(2);
      expect(resumen.datos.movimientos.find((m) => m.costoUnitario === "7.2500")).toBeDefined();
      expect(resumen.datos.movimientos.every((m) => m.costoPromedioResultante !== undefined)).toBe(true);
    }
  });
});
