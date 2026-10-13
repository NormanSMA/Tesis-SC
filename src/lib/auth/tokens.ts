import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

// En la base solo vive el SHA-256: una fuga de la tabla sesion no permite usar las sesiones.
export function hashearToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
