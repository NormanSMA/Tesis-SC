import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "output", "usuarios-reales");
mkdirSync(salida, { recursive: true, mode: 0o700 });
const resultado = spawnSync("docker", ["compose", "run", "--rm", "--no-deps", "--build", "-T",
  "--env", "NODE_OPTIONS=--conditions=react-server", "--volume", `${salida}:/salida`,
  "migrate", "pnpm", "exec", "tsx", "scripts/usuarios-reales/index.ts"],
{ cwd: raiz, stdio: "inherit" });
if (resultado.error) console.error(resultado.error.message);
if (resultado.status === 0) console.log(`Accesos locales: ${path.join(salida, "credenciales.local.md")}`);
process.exitCode = resultado.status ?? 1;
