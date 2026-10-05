import { describe, expect, it } from "vitest";
import { AppError, aErrorHttp } from "@/lib/errores";

// Misma forma que lanza Prisma 7 con @prisma/adapter-pg (verificada en tests/integration/errores-bd.test.ts).
function errorDeBase(originalCode: string, originalMessage: string): Error {
  return Object.assign(new Error("Raw query failed"), {
    code: "P2010",
    meta: { driverAdapterError: { name: "DriverAdapterError", cause: { originalCode, originalMessage } } },
  });
}

// Falla del COMMIT de una transaccion interactiva: Prisma deja pasar el DriverAdapterError.
function errorDeCommit(originalCode: string, originalMessage: string): Error {
  return Object.assign(new Error(originalMessage), {
    name: "DriverAdapterError",
    cause: { originalCode, originalMessage, kind: "postgres" },
  });
}

describe("AppError", () => {
  it("conserva codigo, mensaje, status y campos", () => {
    const err = new AppError({ codigo: "TEST001", mensaje: "Prueba", status: 422, campos: { nombre: "Requerido" } });
    expect(err.message).toBe("Prueba");
    expect(aErrorHttp(err)).toEqual({
      status: 422,
      cuerpo: { error: { codigo: "TEST001", mensaje: "Prueba", campos: { nombre: "Requerido" } } },
    });
  });

  it("omite campos cuando no se informan", () => {
    const res = aErrorHttp(new AppError({ codigo: "NO_EXISTE", mensaje: "No existe", status: 404 }));
    expect(res.cuerpo.error).toEqual({ codigo: "NO_EXISTE", mensaje: "No existe" });
  });
});

describe("aErrorHttp con errores de la base", () => {
  it.each(["SC001", "SC002", "SC003", "SC004", "SC005", "SC006", "SC007"])(
    "%s devuelve 409 con el mensaje en espanol de la base",
    (sqlstate) => {
      const res = aErrorHttp(errorDeBase(sqlstate, "La tabla bitacora es de solo insercion"));
      expect(res.status).toBe(409);
      expect(res.cuerpo.error).toEqual({ codigo: sqlstate, mensaje: "La tabla bitacora es de solo insercion" });
    },
  );

  it("23505 indica valor duplicado", () => {
    const res = aErrorHttp(errorDeBase("23505", 'duplicate key value violates unique constraint "cliente_ruc_key"'));
    expect(res.status).toBe(409);
    expect(res.cuerpo.error.codigo).toBe("DUPLICADO");
  });

  it("23503 al insertar indica referencia inexistente", () => {
    const res = aErrorHttp(
      errorDeBase("23503", 'insert or update on table "bitacora" violates foreign key constraint "bitacora_usuario_id_fkey"'),
    );
    expect(res.status).toBe(409);
    expect(res.cuerpo.error.codigo).toBe("REFERENCIA_INEXISTENTE");
  });

  it("23503 al borrar indica registros relacionados", () => {
    const res = aErrorHttp(
      errorDeBase("23503", 'update or delete on table "cliente" violates foreign key constraint "x" on table "cotizacion"'),
    );
    expect(res.status).toBe(409);
    expect(res.cuerpo.error.codigo).toBe("REGISTROS_RELACIONADOS");
  });

  it("23514 indica valor fuera de rango", () => {
    const res = aErrorHttp(errorDeBase("23514", 'new row for relation "permiso" violates check constraint "permiso_formato"'));
    expect(res.status).toBe(409);
    expect(res.cuerpo.error.codigo).toBe("VALOR_FUERA_DE_RANGO");
    expect(res.cuerpo.error.mensaje).toBe("El valor está fuera del rango permitido.");
  });

  it("23514 de existencia negativa usa el mensaje de inventario", () => {
    const res = aErrorHttp(
      errorDeBase("23514", 'new row for relation "material" violates check constraint "material_existencia_no_negativa"'),
    );
    expect(res.cuerpo.error.mensaje).toBe("La existencia del material no alcanza para la operación.");
  });

  it("SC005 al confirmar la transaccion llega como DriverAdapterError", () => {
    const res = aErrorHttp(errorDeCommit("SC005", "Movimiento x de tipo CONSUMO sin consumo_orden asociado"));
    expect(res.status).toBe(409);
    expect(res.cuerpo.error.codigo).toBe("SC005");
  });

  it("ignora error.code cuando no es un SQLSTATE del adaptador", () => {
    const res = aErrorHttp(Object.assign(new Error("x"), { code: "SC001" }));
    expect(res.status).toBe(500);
  });

  it("otros SQLSTATE devuelven 500", () => {
    expect(aErrorHttp(errorDeBase("22P02", "invalid input syntax")).status).toBe(500);
  });

  it("un error cualquiera devuelve 500 sin detalles", () => {
    const res = aErrorHttp(new Error("secreto interno"));
    expect(res).toEqual({
      status: 500,
      cuerpo: { error: { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" } },
    });
  });

  it("un valor que no es Error devuelve 500", () => {
    expect(aErrorHttp(null).status).toBe(500);
    expect(aErrorHttp("texto").status).toBe(500);
  });
});
