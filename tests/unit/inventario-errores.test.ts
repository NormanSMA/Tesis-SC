import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errores";
import { leerIdMaterial, traducirError } from "@/modules/inventario/errores";

function errorSql(codigo: string, mensaje: string) {
  return { meta: { driverAdapterError: { cause: { originalCode: codigo, originalMessage: mensaje } } } };
}
describe("inventario: errores del libro", () => {
  it("traduce CHECK de existencia con el código del módulo", () => {
    try { traducirError(errorSql("23514", 'violates check constraint "material_existencia_no_negativa"')); }
    catch (error) { expect(error).toMatchObject({ codigo: "EXISTENCIA_INSUFICIENTE", status: 409 }); return; }
    throw new Error("Falta el error de existencia.");
  });
  it.each(["SC001", "SC005", "SC006", "SC007"])("traduce %s a conflicto legible", (codigo) => {
    expect(() => traducirError(errorSql(codigo, "Regla de inventario incumplida."))).toThrow("Regla de inventario incumplida.");
    try { traducirError(errorSql(codigo, "Regla de inventario incumplida.")); }
    catch (error) { expect(error).toMatchObject({ codigo, status: 409 }); }
  });
  it("traduce desborde decimal", () => {
    try { traducirError(errorSql("22003", "numeric field overflow")); }
    catch (error) { expect(error).toMatchObject({ codigo: "VALOR_FUERA_DE_RANGO", status: 409 }); return; }
    throw new Error("Falta el error de rango.");
  });
  it("conserva errores de negocio y errores inesperados", () => {
    const regla = new AppError({ codigo: "MATERIAL_ARCHIVADO", mensaje: "Material archivado.", status: 409 });
    const inesperado = new Error("Desconectado");
    expect(() => traducirError(regla)).toThrow(regla);
    expect(() => traducirError(inesperado)).toThrow(inesperado);
  });
  it("identificador inválido responde como material inexistente", () => {
    try { leerIdMaterial("incorrecto"); }
    catch (error) { expect(error).toMatchObject({ status: 404, codigo: "NO_ENCONTRADO" }); return; }
    throw new Error("Falta el error de identificador.");
  });
});
