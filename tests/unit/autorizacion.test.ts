import { describe, expect, it } from "vitest";

import { can, exigir, type Actor } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";

const actor: Actor = {
  id: "u1",
  nombre: "Valentina",
  correo: "valentina@example.com",
  perfil: "VENTAS",
  permisos: ["cliente:ver", "cliente:gestionar"],
};

describe("can", () => {
  it("concede un permiso presente", () => {
    expect(can(actor, "cliente:ver")).toBe(true);
  });

  it("niega un permiso ausente", () => {
    expect(can(actor, "inventario:ajustar")).toBe(false);
  });

  it("niega todo a un actor sin permisos", () => {
    expect(can({ ...actor, permisos: [] }, "cliente:ver")).toBe(false);
  });
});

describe("exigir", () => {
  it("no lanza si el actor tiene el permiso", () => {
    expect(() => exigir(actor, "cliente:gestionar")).not.toThrow();
  });

  it("lanza AppError 403 SIN_PERMISO en español si falta", () => {
    try {
      exigir(actor, "usuario:gestionar");
      expect.unreachable("debía lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const error = e as AppError;
      expect(error.status).toBe(403);
      expect(error.codigo).toBe("SIN_PERMISO");
      expect(error.mensaje).toBe("No tiene permiso para realizar esta acción.");
    }
  });
});
