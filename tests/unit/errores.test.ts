import { describe, it, expect } from "vitest";
import { AppError, aErrorHttp } from "@/lib/errores";

describe("errores", () => {
  it("AppError devuelve status y campos", () => {
    const err = new AppError("TEST001", "Test error", 409, { campo1: "fallo" });
    const res = aErrorHttp(err);

    expect(res.status).toBe(409);
    expect(res.cuerpo.error.codigo).toBe("TEST001");
    expect(res.cuerpo.error.mensaje).toBe("Test error");
    expect(res.cuerpo.error.campos).toEqual({ campo1: "fallo" });
  });

  it("Traduce SC001 a SC007 a 409", () => {
    const err = new Error("SQL error") as unknown as Record<string, unknown>;
    err.code = "SC001";

    const res = aErrorHttp(err);
    expect(res.status).toBe(409);
    expect(res.cuerpo.error.codigo).toBe("SC001");
  });

  it("Traduce 23505 a 409", () => {
    const err = new Error("Duplicate key") as unknown as Record<string, unknown>;
    err.code = "23505";

    const res = aErrorHttp(err);
    expect(res.status).toBe(409);
    expect(res.cuerpo.error.codigo).toBe("CONFLICTO");
  });

  it("Error desconocido devuelve 500", () => {
    const err = new Error("Random error");

    const res = aErrorHttp(err);
    expect(res.status).toBe(500);
    expect(res.cuerpo.error.codigo).toBe("ERROR_INTERNO");
  });
});
