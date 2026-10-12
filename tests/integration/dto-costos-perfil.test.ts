import { afterAll, beforeAll, expect, it } from "vitest";

import type { FichaProducto } from "@/modules/catalogo/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion, cargarModuloCatalogo, conPermisoRevocado, invocar, type ModuloCatalogo, type Sesion } from "./catalogo-ayudas";
import { crearReferencias, type Referencias } from "./cotizaciones-ayudas";

describeConBase("DTO: costos según permisos del perfil", () => {
  const db = crearClientePropietario();
  let catalogo: ModuloCatalogo;
  let referencias: Referencias;
  const sesiones = {} as Record<"PRODUCCION" | "GERENCIA", Sesion>;

  beforeAll(async () => {
    await sembrarReferencia(db);
    catalogo = await cargarModuloCatalogo();
    for (const perfil of ["PRODUCCION", "GERENCIA"] as const) {
      sesiones[perfil] = await abrirSesion(db, catalogo, perfil);
    }
    referencias = await crearReferencias(db);
    await db.producto.update({ where: { id: referencias.unidad.id }, data: {
      costoUnitario: "12.3456",
      receta: { create: { materialId: referencias.material.id, cantidad: "2.500" } },
    } });
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  async function consultarFicha(cookie: string) {
    const id = referencias.unidad.id;
    const respuesta = await invocar<FichaProducto>(catalogo.ficha.GET,
      peticion("GET", `/api/v1/productos/${id}`, { cookie }), id);
    expect(respuesta.status).toBe(200);
    expect(respuesta.datos.receta).toHaveLength(1);
    expect(respuesta.datos.receta[0]).toMatchObject({
      materialId: referencias.material.id, cantidad: "2.500",
      material: { id: referencias.material.id, nombre: referencias.material.nombre, unidad: "UNIDAD" },
    });
    return respuesta.datos;
  }

  it("Producción recibe la receta sin costoPromedio", async () => {
    const ficha = await consultarFicha(sesiones.PRODUCCION.cookie);
    expect(ficha.receta[0].material).not.toHaveProperty("costoPromedio");
    expect(ficha).not.toHaveProperty("costoUnitario");
  });

  it("Gerencia conserva costoPromedio y costoUnitario", async () => {
    const ficha = await consultarFicha(sesiones.GERENCIA.cookie);
    expect(ficha.receta[0].material.costoPromedio).toBe("2850.0000");
    expect(ficha.costoUnitario).toBe("12.3456");
  });

  it.each(["cotizacion:ver", "inventario:ver"])("conserva costoPromedio al revocar únicamente %s", async (permiso) => {
    await conPermisoRevocado(db, { perfil: "GERENCIA", permiso }, async () => {
      const ficha = await consultarFicha(sesiones.GERENCIA.cookie);
      expect(ficha.receta[0].material.costoPromedio).toBe("2850.0000");
      if (permiso === "cotizacion:ver") expect(ficha).not.toHaveProperty("costoUnitario");
    });
  });

  it("omite costoPromedio al revocar ambos permisos de Gerencia", async () => {
    await conPermisoRevocado(db, { perfil: "GERENCIA", permiso: "cotizacion:ver" }, async () => {
      await conPermisoRevocado(db, { perfil: "GERENCIA", permiso: "inventario:ver" }, async () => {
        const ficha = await consultarFicha(sesiones.GERENCIA.cookie);
        expect(ficha.receta[0].material).not.toHaveProperty("costoPromedio");
      });
    });
  });
});
