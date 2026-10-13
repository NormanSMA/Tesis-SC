import { describe, expect, it } from "vitest";

import { esquemaEntorno } from "@/env";

const entornoBase = {
  DATABASE_URL: "postgresql://usuario:clave@127.0.0.1:5432/prueba",
};

describe("validacion del entorno", () => {
  it("aplica los valores predeterminados", () => {
    expect(esquemaEntorno.parse(entornoBase)).toEqual({
      ...entornoBase,
      SESSION_COOKIE_NAME: "sc_sesion",
      SESSION_COOKIE_SECURE: "false",
      SESSION_TTL_HOURS: 12,
      NODE_ENV: "development",
    });
  });

  it.each(["1", "168"])("convierte SESSION_TTL_HOURS=%s a entero", (horas) => {
    const entorno = esquemaEntorno.parse({ ...entornoBase, SESSION_TTL_HOURS: horas });
    expect(entorno.SESSION_TTL_HOURS).toBe(Number(horas));
  });

  it.each(["0", "169", "1.5"])("rechaza SESSION_TTL_HOURS=%s", (horas) => {
    const resultado = esquemaEntorno.safeParse({ ...entornoBase, SESSION_TTL_HOURS: horas });
    expect(resultado.success).toBe(false);
  });

  it("rechaza SESSION_COOKIE_SECURE=si", () => {
    const resultado = esquemaEntorno.safeParse({ ...entornoBase, SESSION_COOKIE_SECURE: "si" });
    expect(resultado.success).toBe(false);
  });
});
