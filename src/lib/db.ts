import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/env";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function crearCliente(connectionString: string | undefined): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    }),
    // El valor por defecto (5 s) es corto para consumos que esperan el bloqueo de fila de un material.
    transactionOptions: { maxWait: 5_000, timeout: 15_000 },
  });
}

export const prisma = globalForPrisma.prisma ?? crearCliente(env.DATABASE_URL);

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
