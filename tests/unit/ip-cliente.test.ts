import { beforeEach, describe, expect, it, vi } from "vitest";

import { leerEntorno } from "@/env";
import { cookieSegura, serializarCookieBorrada, serializarCookieSesion } from "@/lib/auth/cookies";
import { ipCliente, ipTruncada, viaProxy } from "@/lib/ip-cliente";

vi.mock("@/env", () => ({ leerEntorno: vi.fn(() => ({})) }));

const CLAVE_PROXY = "a".repeat(32);
const entornoBase = {
  SESSION_COOKIE_NAME: "sc_sesion",
  SESSION_COOKIE_SECURE: "false" as const,
  SESSION_TTL_HOURS: 12,
  NODE_ENV: "test" as const,
  PROXY_CLAVE: CLAVE_PROXY,
};

function peticion(cabeceras: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/auth/login", { headers: cabeceras });
}

beforeEach(() => {
  vi.mocked(leerEntorno).mockReturnValue({ ...entornoBase });
});

describe("viaProxy", () => {
  it("acepta la clave válida del proxy", () => {
    expect(viaProxy(peticion({ "x-proxy-clave": CLAVE_PROXY }))).toBe(true);
  });

  it("rechaza una clave errónea de igual longitud", () => {
    expect(viaProxy(peticion({ "x-proxy-clave": "b".repeat(32) }))).toBe(false);
  });

  it.each(["", "corta", "a".repeat(33)])("rechaza la cabecera de longitud diferente: %s", (clave) => {
    expect(viaProxy(peticion({ "x-proxy-clave": clave }))).toBe(false);
  });

  it("rechaza la cabecera ausente", () => {
    expect(viaProxy(peticion())).toBe(false);
  });

  it("compara la longitud de los buffers antes de comparar sus valores", () => {
    expect(viaProxy(peticion({ "x-proxy-clave": "é".repeat(32) }))).toBe(false);
  });

  it.each([undefined, "", "a".repeat(31)])("rechaza la clave configurada ausente, vacía o corta: %s", (clave) => {
    vi.mocked(leerEntorno).mockReturnValue({ ...entornoBase, PROXY_CLAVE: clave });
    expect(viaProxy(peticion({ "x-proxy-clave": clave ?? "" }))).toBe(false);
  });
});

describe("ipCliente", () => {
  it("recorta el primer valor de X-Forwarded-For con proxy autenticado", () => {
    expect(ipCliente(peticion({
      "x-proxy-clave": CLAVE_PROXY,
      "x-forwarded-for": " 192.168.1.42 , 10.0.0.1",
    }))).toBe("192.168.1.42");
  });

  it("devuelve local sin proxy", () => {
    expect(ipCliente(peticion())).toBe("local");
  });

  it("ignora X-Forwarded-For falsificado sin clave", () => {
    expect(ipCliente(peticion({ "x-forwarded-for": "192.168.1.42" }))).toBe("local");
  });

  it("ignora X-Forwarded-For con clave errónea", () => {
    expect(ipCliente(peticion({
      "x-proxy-clave": "b".repeat(32),
      "x-forwarded-for": "192.168.1.42",
    }))).toBe("local");
  });

  it("devuelve local con proxy autenticado sin X-Forwarded-For", () => {
    expect(ipCliente(peticion({ "x-proxy-clave": CLAVE_PROXY }))).toBe("local");
  });
});

describe("ipTruncada", () => {
  it.each([
    ["192.168.1.42", "192.168.1.0/24"],
    ["2001:db8:abcd:1234:5678:9abc:def0:1234", "2001:db8:abcd::/48"],
    ["2001:db8:abcd::1234", "2001:db8:abcd::/48"],
    ["2001:db8::1", "2001:db8:0::/48"],
    ["::1", "0:0:0::/48"],
    ["2001::abcd:1234:5678:9abc:192.0.2.1", "2001:0:abcd::/48"],
    ["local", "local"],
    ["", "local"],
  ])("trunca %s a %s", (ip, truncada) => {
    expect(ipTruncada(ip)).toBe(truncada);
  });
});

describe("cookieSegura", () => {
  it("activa Secure cuando SESSION_COOKIE_SECURE es true", () => {
    vi.mocked(leerEntorno).mockReturnValue({ ...entornoBase, SESSION_COOKIE_SECURE: "true" });
    expect(cookieSegura(peticion())).toBe(true);
  });

  it("activa Secure con proxy autenticado y HTTPS", () => {
    expect(cookieSegura(peticion({
      "x-proxy-clave": CLAVE_PROXY,
      "x-forwarded-proto": "https",
    }))).toBe(true);
  });

  it("omite Secure con proxy autenticado y HTTP", () => {
    expect(cookieSegura(peticion({
      "x-proxy-clave": CLAVE_PROXY,
      "x-forwarded-proto": "http",
    }))).toBe(false);
  });

  it("omite Secure sin proxy", () => {
    expect(cookieSegura(peticion())).toBe(false);
  });

  it("ignora HTTPS falsificado sin clave", () => {
    expect(cookieSegura(peticion({ "x-forwarded-proto": "https" }))).toBe(false);
  });

  it("ignora HTTPS con clave errónea", () => {
    expect(cookieSegura(peticion({
      "x-proxy-clave": "b".repeat(32),
      "x-forwarded-proto": "https",
    }))).toBe(false);
  });
});

describe("serialización de cookies", () => {
  it.each([true, false])("incluye Secure solamente cuando segura es %s", (segura) => {
    vi.mocked(leerEntorno).mockReturnValue({
      ...entornoBase,
      SESSION_COOKIE_SECURE: segura ? "false" : "true",
    });
    const atributos = `Path=/; HttpOnly; SameSite=Lax${segura ? "; Secure" : ""}`;
    expect(serializarCookieSesion("token", 60.9, segura))
      .toBe(`sc_sesion=token; ${atributos}; Max-Age=60`);
    expect(serializarCookieBorrada(segura))
      .toBe(`sc_sesion=; ${atributos}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  });
});
