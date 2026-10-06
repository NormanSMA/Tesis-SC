import { hash, verify } from "@node-rs/argon2";

// Parámetros mínimos recomendados por OWASP para argon2id: 19 MiB, 2 iteraciones, 1 hilo.
const OPCIONES = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashearContrasena(contrasena: string): Promise<string> {
  return hash(contrasena, OPCIONES);
}

export async function verificarContrasena(hashGuardado: string, contrasena: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, contrasena);
  } catch {
    // Un hash ilegible equivale a una clave incorrecta: no debe filtrar un error distinto.
    return false;
  }
}

let hashFicticio: Promise<string> | undefined;

// Gasta el mismo tiempo que una verificación real cuando el usuario no existe, para no revelarlo por latencia.
export async function verificarContraFicticio(contrasena: string): Promise<void> {
  hashFicticio ??= hashearContrasena("contrasena-ficticia-sin-usuario");
  await verificarContrasena(await hashFicticio, contrasena);
}
