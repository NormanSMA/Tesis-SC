import { afterAll, beforeAll, expect, it } from "vitest";

import { CATALOGO_PERMISOS, PERFILES, PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { crearClientePropietario, describeConBase } from "../helpers/db";

describeConBase("sembrarReferencia", () => {
  const db = crearClientePropietario();

  beforeAll(async () => {
    await sembrarReferencia(db);
    await sembrarReferencia(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("crea los seis perfiles con sus nombres, sin duplicar al repetir", async () => {
    const perfiles = await db.perfil.findMany();
    expect(perfiles).toHaveLength(6);
    for (const { codigo, nombre } of PERFILES) {
      expect(perfiles.find((p) => p.codigo === codigo)?.nombre).toBe(nombre);
    }
  });

  it("crea el catálogo completo de permisos sin duplicados", async () => {
    const permisos = await db.permiso.findMany();
    expect(permisos.map((p) => `${p.recurso}:${p.accion}`).sort()).toEqual(
      CATALOGO_PERMISOS.map((c) => c.permiso).sort(),
    );
  });

  it("deja en la base la matriz por defecto de cada perfil", async () => {
    const filas = await db.perfilPermiso.findMany({ include: { perfil: true, permiso: true } });
    for (const codigo of Object.keys(PERMISOS_POR_PERFIL) as PerfilCodigo[]) {
      const concedidos = filas
        .filter((f) => f.perfil.codigo === codigo)
        .map((f) => `${f.permiso.recurso}:${f.permiso.accion}`)
        .sort();
      expect(concedidos).toEqual([...PERMISOS_POR_PERFIL[codigo]].sort());
    }
  });
});
