import { existsSync } from "node:fs";
import path from "node:path";

import type { PerfilCodigo } from "../../src/core/permisos";

// Las claves de la siembra vienen solo del entorno. No hay valor por defecto en el código.
export const VARIABLE_CLAVE: Readonly<Record<PerfilCodigo, string>> = {
  GERENCIA: "SEED_PASSWORD_GERENCIA",
  VENTAS: "SEED_PASSWORD_VENTAS",
  PRODUCCION: "SEED_PASSWORD_PRODUCCION",
  ADMIN: "SEED_PASSWORD_ADMIN",
};

export const LONGITUD_MINIMA_CLAVE = 14;

export type ClavesSiembra = Readonly<Record<PerfilCodigo, string>>;
export type EntornoLeido = Readonly<Record<string, string | undefined>>;

// Nunca incluye el valor de una clave en un mensaje de error.
export function leerClaves(entorno: EntornoLeido): ClavesSiembra {
  const problemas: string[] = [];
  const claves = {} as Record<PerfilCodigo, string>;
  for (const [perfil, variable] of Object.entries(VARIABLE_CLAVE) as [PerfilCodigo, string][]) {
    const valor = entorno[variable];
    if (!valor) {
      problemas.push(`Falta la variable de entorno ${variable}.`);
    } else if (valor.length < LONGITUD_MINIMA_CLAVE) {
      problemas.push(`La variable ${variable} debe tener al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`);
    } else {
      claves[perfil] = valor;
    }
  }
  if (problemas.length > 0) {
    throw new Error(`No se puede sembrar usuarios. ${problemas.join(" ")} Revisa .env.example.`);
  }
  return claves;
}

// Mismo orden que vitest.config.mts: el entorno real gana a .env y .env gana a .env.example.
// loadEnvFile no pisa las variables ya definidas.
export function cargarArchivosDeEntorno(): void {
  for (const archivo of [".env", ".env.example"]) {
    const ruta = path.resolve(process.cwd(), archivo);
    if (existsSync(ruta)) process.loadEnvFile(ruta);
  }
}
