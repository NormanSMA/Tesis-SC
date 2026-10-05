import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { crearClienteApp, crearClientePropietario, describeConBase } from "../helpers/db";

describeConBase("permisos del rol sc_app", () => {
  const propietario = crearClientePropietario();
  const app = crearClienteApp();
  let usuarioId: string;
  let eventoId: string;

  beforeAll(async () => {
    const perfil = await propietario.perfil.upsert({
      where: { codigo: "VENTAS" },
      update: {},
      create: { codigo: "VENTAS", nombre: "Ventas" },
    });
    const usuario = await propietario.usuario.create({
      data: { nombre: "Rol de prueba", correo: `rol-${randomUUID()}@example.com`, hashContrasena: "hash", perfilId: perfil.id },
    });
    usuarioId = usuario.id;
    eventoId = (
      await propietario.bitacora.create({
        data: { entidad: "USUARIO", entidadId: usuarioId, accion: "CREAR", usuarioId },
      })
    ).id;
  });

  afterAll(async () => {
    await Promise.all([propietario.$disconnect(), app.$disconnect()]);
  });

  it("no es superusuario ni dueno de las tablas", async () => {
    const filas = await app.$queryRaw<{ superusuario: boolean; duenoDeBitacora: boolean }[]>`
      SELECT r.rolsuper AS "superusuario", (t.tableowner = current_user) AS "duenoDeBitacora"
        FROM pg_roles r, pg_tables t
       WHERE r.rolname = current_user AND t.schemaname = 'public' AND t.tablename = 'bitacora'`;
    expect(filas[0]).toEqual({ superusuario: false, duenoDeBitacora: false });
  });

  it("lee y escribe tablas de negocio", async () => {
    const cliente = await app.cliente.create({ data: { nombre: "Cliente del rol", tipo: "PERSONA", telefono: "1" } });
    await app.cliente.update({ where: { id: cliente.id }, data: { nombre: "Cliente renombrado" } });
    await app.cliente.delete({ where: { id: cliente.id } });
  });

  it("inserta y lee la bitacora", async () => {
    const evento = await app.bitacora.create({
      data: { entidad: "USUARIO", entidadId: usuarioId, accion: "EDITAR", usuarioId },
    });
    expect(await app.bitacora.findUnique({ where: { id: evento.id } })).not.toBeNull();
  });

  it("UPDATE de bitacora falla por permiso", async () => {
    await expect(app.$executeRaw`UPDATE bitacora SET detalle = '{}' WHERE id = ${eventoId}::uuid`).rejects.toThrow(
      /permission denied/,
    );
  });

  it("DELETE de bitacora falla por permiso", async () => {
    await expect(app.$executeRaw`DELETE FROM bitacora WHERE id = ${eventoId}::uuid`).rejects.toThrow(/permission denied/);
  });

  it.each(["bitacora", "movimiento_inventario", "consumo_orden"])("TRUNCATE de %s falla por permiso", async (tabla) => {
    await expect(app.$executeRawUnsafe(`TRUNCATE ${tabla}`)).rejects.toThrow(/permission denied/);
  });

  it.each(["movimiento_inventario", "consumo_orden"])("UPDATE y DELETE de %s fallan por permiso", async (tabla) => {
    await expect(app.$executeRawUnsafe(`UPDATE ${tabla} SET id = id`)).rejects.toThrow(/permission denied/);
    await expect(app.$executeRawUnsafe(`DELETE FROM ${tabla}`)).rejects.toThrow(/permission denied/);
  });

  it("no puede borrar ni alterar tablas", async () => {
    await expect(app.$executeRawUnsafe("DROP TABLE bitacora")).rejects.toThrow(/must be owner/);
    await expect(app.$executeRawUnsafe("ALTER TABLE cliente ADD COLUMN x int")).rejects.toThrow(/must be owner/);
  });

  it("no puede desactivar triggers ni crear objetos", async () => {
    await expect(app.$executeRawUnsafe("ALTER TABLE bitacora DISABLE TRIGGER USER")).rejects.toThrow(/must be owner/);
    await expect(app.$executeRawUnsafe("CREATE TABLE intruso (id int)")).rejects.toThrow(/permission denied/);
  });

  it("no toca la tabla de migraciones", async () => {
    await expect(app.$queryRawUnsafe("SELECT * FROM _prisma_migrations")).rejects.toThrow(/permission denied/);
  });

  it("usa las funciones de numeracion y sus secuencias", async () => {
    const filas = await app.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('COTIZACION'::tipo_documento) AS numero`;
    expect(filas[0].numero).toMatch(/^COT-\d{4}-\d{4,}$/);
  });
});
