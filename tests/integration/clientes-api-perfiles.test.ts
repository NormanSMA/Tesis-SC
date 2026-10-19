import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PerfilCodigo } from "@/core/permisos";
import type { ClienteDto } from "@/modules/clientes/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  abrirSesion,
  cargarModuloClientes,
  crearClienteDirecto,
  cuerpoCliente,
  invocar,
  type ModuloClientes,
  type Sesion,
} from "./clientes-ayudas";

type Operacion = "listar" | "crear" | "ver" | "editar" | "archivar" | "reactivar";

const OPERACIONES: Operacion[] = ["listar", "crear", "ver", "editar", "archivar", "reactivar"];

// Matriz v9: solo Atención al cliente gestiona clientes; Gerencia y Operaciones consultan.
const ESPERADO: Record<PerfilCodigo, Record<Operacion, number>> = {
  GERENCIA: { listar: 200, ver: 200, crear: 403, editar: 403, archivar: 403, reactivar: 403 },
  ADMINISTRACION: { listar: 403, ver: 403, crear: 403, editar: 403, archivar: 403, reactivar: 403 },
  OPERACIONES: { listar: 200, ver: 200, crear: 403, editar: 403, archivar: 403, reactivar: 403 },
  ATENCION_CLIENTE: { listar: 200, ver: 200, crear: 201, editar: 200, archivar: 200, reactivar: 200 },
  PRODUCCION: { listar: 403, ver: 403, crear: 403, editar: 403, archivar: 403, reactivar: 403 },
  ADMIN: { listar: 403, ver: 403, crear: 403, editar: 403, archivar: 403, reactivar: 403 },
};

describeConBase("clientes: API por perfil", () => {
  const db = crearClientePropietario();
  let modulos: ModuloClientes;
  const sesiones = {} as Record<PerfilCodigo, Sesion>;

  beforeAll(async () => {
    await sembrarReferencia(db);
    modulos = await cargarModuloClientes();
    for (const perfil of Object.keys(ESPERADO) as PerfilCodigo[]) {
      sesiones[perfil] = await abrirSesion(db, modulos, perfil);
    }
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  async function ejecutar(operacion: Operacion, cookie: string | undefined, destino?: ClienteDto) {
    const opciones = { cookie };
    const id = destino?.id ?? "00000000-0000-4000-8000-000000000000";
    const version = destino?.actualizadoEn ?? new Date().toISOString();
    switch (operacion) {
      case "listar":
        return invocar(modulos.lista.GET, peticion("GET", "/api/v1/clientes", { ...opciones, origen: null }));
      case "crear":
        return invocar(modulos.lista.POST, peticion("POST", "/api/v1/clientes", { ...opciones, cuerpo: cuerpoCliente() }));
      case "ver":
        return invocar(modulos.ficha.GET, peticion("GET", `/api/v1/clientes/${id}`, { ...opciones, origen: null }), id);
      case "editar":
        return invocar(
          modulos.ficha.PATCH,
          peticion("PATCH", `/api/v1/clientes/${id}`, { ...opciones, cuerpo: { version, notas: "x" } }),
          id,
        );
      case "archivar":
        return invocar(
          modulos.archivar.POST,
          peticion("POST", `/api/v1/clientes/${id}/archivar`, { ...opciones, cuerpo: { version } }),
          id,
        );
      case "reactivar":
        return invocar(modulos.reactivar.POST, peticion("POST", `/api/v1/clientes/${id}/reactivar`, { ...opciones, cuerpo: { version } }), id);
    }
  }

  for (const perfil of Object.keys(ESPERADO) as PerfilCodigo[]) {
    describe(`perfil ${perfil}`, () => {
      for (const operacion of OPERACIONES) {
        const esperado = ESPERADO[perfil][operacion];
        it(`${operacion} responde ${esperado}`, async () => {
          // Las operaciones permitidas actúan sobre un cliente real. Reactivar necesita uno archivado.
          const destino = await crearClienteDirecto(db, operacion === "reactivar" ? { activo: false } : {});
          const dto = { id: destino.id, actualizadoEn: destino.actualizadoEn.toISOString() } as ClienteDto;
          const respuesta = await ejecutar(operacion, sesiones[perfil].cookie, dto);
          expect(respuesta.status).toBe(esperado);
          if (esperado === 403) expect(respuesta.error?.codigo).toBe("SIN_PERMISO");
        });
      }
    });
  }

  it("las escrituras rechazadas con 403 no cambian ningún dato", async () => {
    const destino = await crearClienteDirecto(db);
    const dto = { id: destino.id, actualizadoEn: destino.actualizadoEn.toISOString() } as ClienteDto;
    for (const perfil of ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "PRODUCCION", "ADMIN"] as const) {
      for (const operacion of ["editar", "archivar"] as const) {
        expect((await ejecutar(operacion, sesiones[perfil].cookie, dto)).status).toBe(403);
      }
    }
    const guardado = await db.cliente.findUniqueOrThrow({ where: { id: destino.id } });
    expect(guardado.notas).toBeNull();
    expect(guardado.activo).toBe(true);
    expect(guardado.actualizadoEn.toISOString()).toBe(dto.actualizadoEn);
    expect(await db.bitacora.count({ where: { entidad: "CLIENTE", entidadId: destino.id } })).toBe(0);
  });

  it("sin sesión todas las operaciones responden 401", async () => {
    const destino = await crearClienteDirecto(db);
    const dto = { id: destino.id, actualizadoEn: destino.actualizadoEn.toISOString() } as ClienteDto;
    for (const operacion of OPERACIONES) {
      const respuesta = await ejecutar(operacion, undefined, dto);
      expect(respuesta.status, operacion).toBe(401);
      expect(respuesta.error?.codigo).toBe("SIN_SESION");
    }
  });

  it("un POST con Origin ajeno se rechaza aunque Atención al cliente tenga el permiso", async () => {
    const respuesta = await invocar(
      modulos.lista.POST,
      peticion("POST", "/api/v1/clientes", {
        cookie: sesiones.ATENCION_CLIENTE.cookie,
        cuerpo: cuerpoCliente(),
        origen: "https://sitio-malicioso.example",
      }),
    );
    expect(respuesta.status).toBe(403);
    expect(respuesta.error?.codigo).toBe("ORIGEN_NO_PERMITIDO");
  });

  it("GET de un cliente inexistente responde 404 y uno mal formado también", async () => {
    for (const id of ["00000000-0000-4000-8000-000000000000", "abc"]) {
      const respuesta = await invocar(
        modulos.ficha.GET,
        peticion("GET", `/api/v1/clientes/${id}`, { cookie: sesiones.ATENCION_CLIENTE.cookie, origen: null }),
        id,
      );
      expect(respuesta.status).toBe(404);
      expect(respuesta.error?.codigo).toBe("NO_ENCONTRADO");
    }
  });

  it("la respuesta de creación incluye la versión y no incluye campos internos ajenos al contrato", async () => {
    const respuesta = await invocar<ClienteDto>(
      modulos.lista.POST,
      peticion("POST", "/api/v1/clientes", { cookie: sesiones.ATENCION_CLIENTE.cookie, cuerpo: cuerpoCliente({ activo: false }) }),
    );
    expect(respuesta.status).toBe(201);
    expect(respuesta.datos.activo).toBe(true);
    expect(Object.keys(respuesta.datos).sort()).toEqual(
      [
        "activo",
        "actualizadoEn",
        "codigoCliente",
        "contactoPrincipal",
        "correo",
        "creadoEn",
        "direccion",
        "id",
        "logoVersion",
        "nombre",
        "notas",
        "ruc",
        "telefono",
        "tipo",
      ].sort(),
    );
  });
});
