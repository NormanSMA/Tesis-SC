import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodObject } from "zod";

import { esquemaConsultaClientes } from "@/modules/clientes/schema";
import { esquemaConsultaCotizaciones } from "@/modules/cotizaciones/schema";
import { esquemaConsultaMateriales } from "@/modules/inventario/schema";
import { esquemaConsultaOrdenes } from "@/modules/ordenes/schema";

const raiz = path.resolve(import.meta.dirname, "..", "..");
const fuente = readFileSync(path.join(raiz, "src", "modules", "panel", "paneles.ts"), "utf8");
const destinos = [...fuente.matchAll(/destino: "([^"]+)"/g)].map(([, destino]) => destino);

const ESQUEMAS: Record<string, ZodObject> = {
  "/ordenes": esquemaConsultaOrdenes,
  "/inventario": esquemaConsultaMateriales,
  "/cotizaciones": esquemaConsultaCotizaciones,
  "/clientes": esquemaConsultaClientes,
};

describe("destinos del panel", () => {
  it("detecta los destinos del panel", () => {
    expect(destinos.length).toBeGreaterThan(10);
  });

  it("cada parámetro de filtro existe en el esquema de consulta de la lista y su valor es válido", () => {
    for (const destino of destinos) {
      const [ruta, consulta = ""] = destino.split("?");
      const esquema = ESQUEMAS[ruta];
      if (!esquema || !consulta) continue;
      const parametros = Object.fromEntries(new URLSearchParams(consulta));
      for (const clave of Object.keys(parametros)) {
        expect(Object.keys(esquema.shape), `${destino}: el filtro "${clave}" no existe`).toContain(clave);
      }
      expect(esquema.safeParse(parametros).success, `${destino}: valor de filtro inválido`).toBe(true);
    }
  });
});
