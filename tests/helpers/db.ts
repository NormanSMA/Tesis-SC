import { describe, inject } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { crearCliente } from "@/lib/db";
import { urlApp, urlPropietario } from "./entorno-bd";

// Omite la suite solo si global-setup no encontro la base. En CI global-setup falla antes.
export const describeConBase = inject("baseDisponible") ? describe : describe.skip;

// Dueno de las tablas (superusuario). Sirve para preparar datos y provocar errores de la base.
export function crearClientePropietario(): PrismaClient {
  return crearCliente(urlPropietario());
}

// Rol sc_app: los mismos permisos que tiene la aplicacion en produccion.
export function crearClienteApp(): PrismaClient {
  return crearCliente(urlApp());
}
