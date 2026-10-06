import { afterAll, expect, test } from "vitest";
import { describeConBase, crearClientePropietario } from "../helpers/db";

const db = crearClientePropietario();

afterAll(() => db.$disconnect());

function insertarCliente(telefono: string | null, correo: string | null) {
  return db.$executeRaw`
    INSERT INTO cliente (nombre, tipo, telefono, correo, actualizado_en)
    VALUES (${`Cliente restricciones ${crypto.randomUUID()}`}, 'EMPRESA'::tipo_cliente, ${telefono}, ${correo}, now())`;
}

describeConBase("restricciones endurecidas de cliente", () => {
  test("acepta teléfono y correo válidos", async () => {
    await expect(insertarCliente("+505 8765 4321", "contacto@empresa.test")).resolves.toBe(1);
  });

  test("rechaza teléfono vacío sin correo", async () => {
    await expect(insertarCliente("", null)).rejects.toThrow(/cliente_contacto_no_vacio/);
  });

  test("rechaza teléfono de solo espacios", async () => {
    await expect(insertarCliente("   ", "contacto@empresa.test")).rejects.toThrow(/cliente_contacto_no_vacio/);
  });

  test("rechaza correo en mayúsculas", async () => {
    await expect(insertarCliente(null, "Contacto@Empresa.test")).rejects.toThrow(/cliente_correo_valido/);
  });

  test("rechaza correo con espacios en los extremos", async () => {
    await expect(insertarCliente(null, " contacto@empresa.test")).rejects.toThrow(/cliente_correo_valido/);
  });

  test("sigue exigiendo un medio de contacto", async () => {
    await expect(insertarCliente(null, null)).rejects.toThrow(/cliente_medio_contacto/);
  });
});
