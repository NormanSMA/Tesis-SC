import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../../next.config";

afterEach(() => vi.unstubAllEnvs());

async function cabecerasGlobales() {
  const reglas = await nextConfig.headers!();
  const regla = reglas.find(({ source }) => source === "/:path*");
  expect(regla).toBeDefined();
  return Object.fromEntries(regla!.headers.map(({ key, value }) => [key, value]));
}

describe("cabeceras de seguridad", () => {
  it("aplica las políticas solicitadas a todas las rutas", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    expect(await cabecerasGlobales()).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy-Report-Only":
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
        "script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; " +
        "base-uri 'self'; form-action 'self'",
    });
  });

  it("agrega HSTS cuando la cookie exige HTTPS", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    expect((await cabecerasGlobales())["Strict-Transport-Security"]).toBe("max-age=31536000");
  });

  it.each([undefined, "false", "", "TRUE", "1"])(
    "omite HSTS cuando SESSION_COOKIE_SECURE es %s",
    async (valor) => {
      vi.stubEnv("SESSION_COOKIE_SECURE", valor);
      expect(await cabecerasGlobales()).not.toHaveProperty("Strict-Transport-Security");
    },
  );

  it("evalúa el entorno en cada llamada sin conservar HSTS", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    await cabecerasGlobales();
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    expect(await cabecerasGlobales()).not.toHaveProperty("Strict-Transport-Security");
  });

  it("conserva las cabeceras de caché de la API", async () => {
    const reglas = await nextConfig.headers!();
    expect(reglas.find(({ source }) => source === "/api/(.*)")).toEqual({
      source: "/api/(.*)",
      headers: [
        { key: "Cache-Control", value: "no-store, must-revalidate" },
        { key: "Vary", value: "Cookie" },
      ],
    });
  });
});
