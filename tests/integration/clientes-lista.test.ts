import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CAMPOS_ORDEN_CLIENTE, type ClienteFila } from "@/modules/clientes/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  abrirSesion,
  cargarModuloClientes,
  crearClienteDirecto,
  invocar,
  type ModuloClientes,
  type RespuestaApi,
  type Sesion,
} from "./clientes-ayudas";

describeConBase("clientes: lista con búsqueda, filtros y paginación", () => {
  const db = crearClientePropietario();
  let modulos: ModuloClientes;
  let ventas: Sesion;
  const marca = `Lst${randomUUID().slice(0, 6)}`;

  beforeAll(async () => {
    await sembrarReferencia(db);
    modulos = await cargarModuloClientes();
    ventas = await abrirSesion(db, modulos, "ATENCION_CLIENTE");
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  function consultar(parametros: Record<string, string>): Promise<RespuestaApi<ClienteFila[]>> {
    const texto = new URLSearchParams(parametros).toString();
    return invocar<ClienteFila[]>(
      modulos.lista.GET,
      peticion("GET", `/api/v1/clientes?${texto}`, { cookie: ventas.cookie, origen: null }),
    );
  }

  describe("búsqueda", () => {
    it("busca por código sin distinguir mayúsculas y devuelve el código en lista y ficha", async () => {
      const cliente = await crearClienteDirecto(db);
      const lista = await consultar({ q: cliente.codigoCliente.toLowerCase() });
      expect(lista.status).toBe(200);
      expect(lista.datos).toMatchObject([{ id: cliente.id, codigoCliente: cliente.codigoCliente }]);
      const ficha = await invocar(modulos.ficha.GET,
        peticion("GET", `/api/v1/clientes/${cliente.id}`, { cookie: ventas.cookie }), cliente.id);
      expect(ficha.status).toBe(200);
      expect(ficha.datos).toMatchObject({ codigoCliente: cliente.codigoCliente });
    });
    it("busca por coincidencia parcial sin distinguir mayúsculas en nombre, RUC, contacto y correo", async () => {
      const token = randomUUID().slice(0, 8);
      const porNombre = await crearClienteDirecto(db, { nombre: `Zeta-${token}-Taller` });
      const porRuc = await crearClienteDirecto(db, { ruc: `RUC${token}`.toUpperCase() });
      const porContacto = await crearClienteDirecto(db, { contactoPrincipal: `Contacto ${token} Pérez` });
      const porCorreo = await crearClienteDirecto(db, { correo: `ventas.${token}@ejemplo.test` });
      await crearClienteDirecto(db);

      const encontrados = await consultar({ q: token.toUpperCase() });
      expect(encontrados.status).toBe(200);
      const ids = encontrados.datos.map((fila) => fila.id).sort();
      expect(ids).toEqual([porNombre.id, porRuc.id, porContacto.id, porCorreo.id].sort());
      expect(encontrados.cuerpo.total).toBe(4);

      expect((await consultar({ q: `zeta-${token}-TALLER` })).datos.map((f) => f.id)).toEqual([porNombre.id]);
      expect((await consultar({ q: `ruc${token}`.toLowerCase() })).datos.map((f) => f.id)).toEqual([porRuc.id]);
    });

    it("trata % y _ como texto, no como comodines", async () => {
      const token = randomUUID().slice(0, 6);
      const literal = await crearClienteDirecto(db, { nombre: `Oferta ${token} 100%_final` });
      await crearClienteDirecto(db, { nombre: `Oferta ${token} 100 final` });
      const resultado = await consultar({ q: `${token} 100%_` });
      expect(resultado.datos.map((fila) => fila.id)).toEqual([literal.id]);
      const soloPorcentaje = await consultar({ q: "%" });
      expect(soloPorcentaje.datos.map((fila) => fila.id)).toEqual([literal.id]);
    });

    it("no devuelve nada cuando no hay coincidencias", async () => {
      const { datos, cuerpo } = await consultar({ q: `inexistente-${randomUUID()}` });
      expect(datos).toEqual([]);
      expect(cuerpo.total).toBe(0);
      expect(cuerpo.conteos).toEqual({ todos: 0, EMPRESA: 0, PERSONA: 0 });
    });
  });

  describe("filtros", () => {
    it("muestra solo activos por defecto y archivados con activo=false", async () => {
      const token = randomUUID().slice(0, 8);
      const activo = await crearClienteDirecto(db, { nombre: `Filtro ${token} activo` });
      const archivado = await crearClienteDirecto(db, { nombre: `Filtro ${token} archivado`, activo: false });
      expect((await consultar({ q: token })).datos.map((f) => f.id)).toEqual([activo.id]);
      expect((await consultar({ q: token, activo: "false" })).datos.map((f) => f.id)).toEqual([archivado.id]);
    });

    it("filtra por tipo", async () => {
      const token = randomUUID().slice(0, 8);
      const persona = await crearClienteDirecto(db, { nombre: `Tipo ${token} A`, tipo: "PERSONA" });
      const empresa = await crearClienteDirecto(db, { nombre: `Tipo ${token} B`, tipo: "EMPRESA" });
      expect((await consultar({ q: token, tipo: "PERSONA" })).datos.map((f) => f.id)).toEqual([persona.id]);
      expect((await consultar({ q: token, tipo: "EMPRESA" })).datos.map((f) => f.id)).toEqual([empresa.id]);
      expect((await consultar({ q: token })).datos).toHaveLength(2);
    });

    it("cuenta tipos sin depender del tipo, orden o página y conserva búsqueda y activo", async () => {
      const token = `Conteos${randomUUID().slice(0, 8)}`;
      await crearClienteDirecto(db, { nombre: `${token} A`, tipo: "EMPRESA" });
      await crearClienteDirecto(db, { nombre: `${token} B`, tipo: "EMPRESA" });
      await crearClienteDirecto(db, { nombre: `${token} C`, tipo: "PERSONA" });
      await crearClienteDirecto(db, { nombre: `${token} D`, tipo: "PERSONA", activo: false });
      await crearClienteDirecto(db, { nombre: `${token} E`, tipo: "EMPRESA", activo: false });
      await crearClienteDirecto(db, { tipo: "EMPRESA" });
      for (const tipo of ["", "EMPRESA", "PERSONA"]) {
        const lista = await consultar({ q: token.toUpperCase(), tipo, orden: "codigo:desc", pagina: "9", porPagina: "1" });
        expect(lista.status).toBe(200);
        expect(lista.datos).toEqual([]);
        expect(lista.cuerpo).toMatchObject({
          total: tipo === "" ? 3 : tipo === "EMPRESA" ? 2 : 1,
          conteos: { todos: 3, EMPRESA: 2, PERSONA: 1 },
        });
        const archivados = await consultar({ q: token, tipo, activo: "false" });
        expect(archivados.cuerpo.conteos).toEqual({ todos: 2, EMPRESA: 1, PERSONA: 1 });
        expect(archivados.datos).toHaveLength(tipo === "" ? 2 : 1);
      }
      expect((await consultar({ q: `${token} C`, tipo: "EMPRESA" })).cuerpo)
        .toMatchObject({ total: 0, conteos: { todos: 1, EMPRESA: 0, PERSONA: 1 } });
      expect((await consultar({ q: `${token} C`, activo: "false" })).cuerpo.conteos)
        .toEqual({ todos: 0, EMPRESA: 0, PERSONA: 0 });
    });

    it.each(["tipo:asc", "codigoCliente:desc", "nombre:invalido", "nombre:asc:desc"])(
      "responde 422 para orden=%s",
      async (orden) => {
        const respuesta = await consultar({ orden });
        expect(respuesta.status).toBe(422);
        expect(respuesta.error?.codigo).toBe("VALIDACION");
        expect(respuesta.error?.campos?.orden).toBeTruthy();
      },
    );

    it("ignora los parámetros vacíos", async () => {
      const { status } = await consultar({ q: "", tipo: "", activo: "", pagina: "", porPagina: "" });
      expect(status).toBe(200);
    });

    it("responde 422 con un campo por parámetro inválido", async () => {
      const { status, error } = await consultar({ tipo: "ONG", activo: "quizá", pagina: "0", porPagina: "101" });
      expect(status).toBe(422);
      expect(Object.keys(error?.campos ?? {}).sort()).toEqual(["activo", "pagina", "porPagina", "tipo"]);
    });
  });

  describe("paginación y orden", () => {
    it.each(CAMPOS_ORDEN_CLIENTE)("ordena por %s en ambas direcciones y pagina con desempate", async (campo) => {
      const token = `Orden${randomUUID().slice(0, 8)}`;
      const filas = [];
      for (const [indice, letra] of ["B", "A", "B", "C"].entries()) {
        filas.push(await crearClienteDirecto(db, {
          nombre: `${token} ${letra}`,
          creadoEn: new Date(indice < 2 ? "2026-10-01T12:00:00Z" : "2026-10-02T12:00:00Z"),
        }));
      }
      for (const direccion of ["asc", "desc"]) {
        const columna = campo === "codigo" ? "codigoCliente" : campo;
        const signo = direccion === "asc" ? 1 : -1;
        const esperado = [...filas].sort((a, b) => {
          const primero = a[columna];
          const segundo = b[columna];
          if (primero < segundo) return -signo;
          if (primero > segundo) return signo;
          return (a.id < b.id ? -1 : 1) * signo;
        }).map((fila) => fila.id);
        const lista = await consultar({ q: token, orden: `${campo}:${direccion}` });
        expect(lista.status).toBe(200);
        expect(lista.datos.map((fila) => fila.id)).toEqual(esperado);
        const vistos: string[] = [];
        for (const pagina of [1, 2]) {
          const parcial = await consultar({ q: token, orden: `${campo}:${direccion}`, pagina: String(pagina), porPagina: "2" });
          vistos.push(...parcial.datos.map((fila) => fila.id));
        }
        expect(vistos).toEqual(esperado);
      }
    });

    async function crearIgualesPorNombre(cantidad: number): Promise<{ nombre: string; ids: string[] }> {
      const nombre = `${marca} Mismo nombre ${randomUUID().slice(0, 6)}`;
      const ids: string[] = [];
      for (let i = 0; i < cantidad; i += 1) ids.push((await crearClienteDirecto(db, { nombre })).id);
      return { nombre, ids };
    }

    it("pagina clientes con el mismo nombre sin repetir ni omitir ninguno, ordenados por nombre y luego id", async () => {
      const { nombre, ids } = await crearIgualesPorNombre(5);
      const vistos: string[] = [];
      for (const pagina of [1, 2, 3]) {
        const respuesta = await consultar({ q: nombre, porPagina: "2", pagina: String(pagina) });
        expect(respuesta.cuerpo).toMatchObject({ total: 5, pagina, porPagina: 2 });
        vistos.push(...respuesta.datos.map((fila) => fila.id));
      }
      expect(vistos).toHaveLength(5);
      expect(new Set(vistos).size).toBe(5);
      expect(vistos).toEqual([...ids].sort());
    });

    it("una página más allá de la última responde vacía con el total real", async () => {
      const { nombre } = await crearIgualesPorNombre(3);
      const respuesta = await consultar({ q: nombre, porPagina: "2", pagina: "9" });
      expect(respuesta.status).toBe(200);
      expect(respuesta.datos).toEqual([]);
      expect(respuesta.cuerpo.total).toBe(3);
    });

    it("ordena por nombre ascendente", async () => {
      const token = randomUUID().slice(0, 8);
      for (const letra of ["C", "A", "B"]) await crearClienteDirecto(db, { nombre: `${token} ${letra}` });
      const nombres = (await consultar({ q: token })).datos.map((fila) => fila.nombre);
      expect(nombres).toEqual([`${token} A`, `${token} B`, `${token} C`]);
    });

    it("usa 20 por página por defecto y admite hasta 100", async () => {
      const token = `Masa${randomUUID().slice(0, 6)}`;
      await db.cliente.createMany({
        data: Array.from({ length: 105 }, (_, i) => ({
          nombre: `${token} ${String(i).padStart(3, "0")}`,
          tipo: "EMPRESA" as const,
          telefono: "8888 0000",
        })),
      });
      const porDefecto = await consultar({ q: token });
      expect(porDefecto.datos).toHaveLength(20);
      expect(porDefecto.cuerpo).toMatchObject({ total: 105, pagina: 1, porPagina: 20 });
      const maximo = await consultar({ q: token, porPagina: "100" });
      expect(maximo.datos).toHaveLength(100);
      expect((await consultar({ q: token, porPagina: "100", pagina: "2" })).datos).toHaveLength(5);
    });

    it("la lista no expone dirección ni notas", async () => {
      const token = randomUUID().slice(0, 8);
      await crearClienteDirecto(db, { nombre: `Reservado ${token}`, notas: "privado", direccion: "oculta" });
      const [fila] = (await consultar({ q: token })).datos;
      expect(fila).not.toHaveProperty("notas");
      expect(fila).not.toHaveProperty("direccion");
    });
  });
});
