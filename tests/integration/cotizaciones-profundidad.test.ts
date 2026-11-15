import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearBorrador, prepararCotizaciones, type EntornoCotizaciones } from "./cotizaciones-ayudas";

describeConBase("cotizaciones: profundidad opcional en los trabajos", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  describe("trabajo por m²", () => {
    it("cobra frente y cuatro laterales y la base acepta el importe", async () => {
      const cotizacion = await crearBorrador(entorno, { items: [{ tipo: "CATALOGO", productoId: entorno.referencias.superficie.id,
        cantidad: "2", ancho: "1", alto: "0.5", profundidad: "0.1" }] });
      const [item] = cotizacion.items;
      expect(item.profundidad).toBe("0.100");
      // 1 × 0,5 + 2 × 0,1 × 1,5 = 0,8 m² por pieza; 2 piezas × 0,8 × 1025 = 1640.
      expect(item.importe).toBe("1640.00");
      const guardado = await db.itemCotizacion.findUniqueOrThrow({ where: { id: item.id } });
      expect(guardado.profundidad?.toFixed(3)).toBe("0.100");
    });

    it("sin profundidad conserva el cálculo anterior", async () => {
      const cotizacion = await crearBorrador(entorno, { items: [{ tipo: "CATALOGO", productoId: entorno.referencias.superficie.id,
        cantidad: "2", ancho: "1", alto: "0.5" }] });
      expect(cotizacion.items[0].profundidad).toBeNull();
      expect(cotizacion.items[0].importe).toBe("1025.00");
    });

    it("la base rechaza un importe que no use la profundidad", async () => {
      const cotizacion = await crearBorrador(entorno, { items: [{ tipo: "CATALOGO", productoId: entorno.referencias.superficie.id,
        cantidad: "1", ancho: "1", alto: "0.5", profundidad: "0.1" }] });
      await expect(db.itemCotizacion.update({ where: { id: cotizacion.items[0].id }, data: { importe: "512.50" } })).rejects.toThrow();
    });
  });
});
