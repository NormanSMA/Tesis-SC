import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Cliente } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { aClienteDto, aClienteFila } from "@/modules/clientes/dto";
import { leerContenidoLogo, LIMITE_LOGO_BYTES, validarLogo } from "@/modules/clientes/logo";
import { buscarCliente, consultarClientes } from "@/modules/clientes/repo";
import { esquemaConsultaClientes } from "@/modules/clientes/schema";

const consultas = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { cliente: consultas } }));

beforeEach(() => {
  vi.resetAllMocks();
  consultas.findUnique.mockResolvedValue(null);
  consultas.findMany.mockResolvedValue([]);
  consultas.count.mockResolvedValue(0);
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe("logo de cliente: firma y tamaño", () => {
  it.each([
    [PNG, "image/png"],
    [JPEG, "image/jpeg"],
    [WEBP, "image/webp"],
  ] as const)("reconoce la firma %j como %s", (contenido, tipo) => {
    expect(validarLogo(contenido)).toBe(tipo);
  });

  it.each([
    new Uint8Array(),
    PNG.slice(0, 3),
    JPEG.slice(0, 2),
    WEBP.slice(0, 11),
    new TextEncoder().encode("RIFF0000WAVE"),
    new TextEncoder().encode("GIF89a"),
    new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  ])("rechaza una firma inválida %j con 415", (contenido) => {
    expect(() => validarLogo(contenido)).toThrow(expect.objectContaining({ status: 415 }));
  });

  it("acepta exactamente 512 KB y rechaza un byte adicional", () => {
    const contenido = new Uint8Array(LIMITE_LOGO_BYTES);
    contenido.set(PNG);
    expect(validarLogo(contenido)).toBe("image/png");
    expect(() => validarLogo(new Uint8Array(LIMITE_LOGO_BYTES + 1)))
      .toThrow(expect.objectContaining({ status: 413 }));
  });
});

describe("logo de cliente: lectura binaria", () => {
  it("conserva los bytes aunque Content-Type declare SVG", async () => {
    const req = new Request("http://localhost/logo", {
      method: "PUT", headers: { "content-type": "image/svg+xml" }, body: PNG,
    });
    expect(await leerContenidoLogo(req)).toEqual(PNG);
  });

  it("rechaza Content-Length excesivo antes de leer el cuerpo", async () => {
    const req = new Request("http://localhost/logo", {
      method: "PUT", headers: { "content-length": String(LIMITE_LOGO_BYTES + 1) }, body: PNG,
    });
    await expect(leerContenidoLogo(req)).rejects.toMatchObject({ status: 413 });
    expect(req.bodyUsed).toBe(false);
  });

  it.each([undefined, "1"])("rechaza bytes excesivos con Content-Length %s", async (longitud) => {
    const req = new Request("http://localhost/logo", {
      method: "PUT",
      headers: longitud ? { "content-length": longitud } : {},
      body: new Uint8Array(LIMITE_LOGO_BYTES + 1),
    });
    await expect(leerContenidoLogo(req)).rejects.toMatchObject({ status: 413 });
    expect(req.body?.locked).toBe(false);
  });

  it("devuelve bytes vacíos cuando falta el cuerpo", async () => {
    expect(await leerContenidoLogo(new Request("http://localhost/logo", { method: "PUT" })))
      .toEqual(new Uint8Array());
  });
});

describe("logo de cliente: DTO sin contenido", () => {
  const fecha = new Date("2026-10-19T12:00:00.000Z");
  const cliente: Cliente = {
    id: "cliente", codigoCliente: "CLI-0001", nombre: "Cliente", tipo: "PERSONA",
    ruc: null, contactoPrincipal: null, telefono: "8888 0000", correo: null,
    direccion: null, notas: null, activo: true, creadoEn: fecha, actualizadoEn: fecha,
  };

  it("expone null sin logo en ficha y lista", () => {
    expect(aClienteDto(cliente).logoVersion).toBeNull();
    expect(aClienteFila(cliente, undefined).logoVersion).toBeNull();
  });

  it("expone solamente la versión ISO en ficha y lista", () => {
    const conLogo = { ...cliente, logo: { actualizadoEn: fecha, contenido: PNG } };
    for (const dto of [aClienteDto(conLogo), aClienteFila(conLogo, undefined)]) {
      expect(dto.logoVersion).toBe(fecha.toISOString());
      expect(dto).not.toHaveProperty("logo");
      expect(dto).not.toHaveProperty("contenido");
    }
  });

  it("selecciona solamente actualizadoEn del logo en lista y ficha", async () => {
    await consultarClientes(esquemaConsultaClientes.parse({}));
    await buscarCliente(prisma, "cliente");
    const logo = { select: { actualizadoEn: true } };
    expect(consultas.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { _count: { select: { cotizaciones: true } }, logo },
    }));
    expect(consultas.findUnique).toHaveBeenCalledWith({ where: { id: "cliente" }, include: { logo } });
  });
});
