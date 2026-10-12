import { afterAll, expect, it } from "vitest";
import type { EstadoOrden } from "@/generated/prisma/enums";
import { exigirTransicion } from "@/modules/ordenes/reglas";
import { crearClientePropietario, describeConBase } from "../helpers/db";

const ESTADOS: EstadoOrden[] = ["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CERRADA", "CANCELADA"];
const DESTINO_ACCION = { entregar: "ENTREGADA", cerrar: "CERRADA", cancelar: "CANCELADA" } as const;
// Las tres transiciones de produccion no pasan por exigirTransicion: las decide
// modules/produccion (iniciar primera etapa, marcar lista, reabrir por retrabajo).
const TRANSICIONES_PRODUCCION: [EstadoOrden, EstadoOrden][] = [
  ["PENDIENTE", "EN_PRODUCCION"],
  ["EN_PRODUCCION", "LISTA"],
  ["LISTA", "EN_PRODUCCION"],
];

function permitidaPorTs(desde: EstadoOrden, hacia: EstadoOrden): boolean {
  if (TRANSICIONES_PRODUCCION.some(([d, h]) => d === desde && h === hacia)) return true;
  for (const accion of Object.keys(DESTINO_ACCION) as (keyof typeof DESTINO_ACCION)[]) {
    if (DESTINO_ACCION[accion] !== hacia) continue;
    try {
      exigirTransicion(desde, accion);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

describeConBase("paridad de transiciones de orden entre TypeScript y PostgreSQL", () => {
  const db = crearClientePropietario();

  afterAll(async () => {
    await db.$disconnect();
  });

  it("todos los pares (desde, hacia) coinciden con transicion_valida('orden', ...)", async () => {
    let validas = 0;
    for (const desde of ESTADOS) {
      for (const hacia of ESTADOS) {
        const [fila] = await db.$queryRaw<{ valida: boolean }[]>`SELECT transicion_valida('orden', ${desde}, ${hacia}) AS valida`;
        expect({ desde, hacia, valida: fila.valida }).toEqual({ desde, hacia, valida: permitidaPorTs(desde, hacia) });
        if (fila.valida) validas += 1;
      }
    }
    expect(validas).toBe(8);
  });

  it("el estado inicial solo admite PENDIENTE", async () => {
    for (const hacia of ESTADOS) {
      const [fila] = await db.$queryRaw<{ valida: boolean }[]>`SELECT transicion_valida('orden', NULL, ${hacia}) AS valida`;
      expect(fila.valida).toBe(hacia === "PENDIENTE");
    }
  });
});
