import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const raiz = import.meta.dirname;

// loadEnvFile no pisa variables ya definidas: el entorno real (CI) gana a .env, y .env a .env.example.
for (const archivo of [".env", ".env.example"]) {
  const ruta = path.join(raiz, archivo);
  if (existsSync(ruta)) process.loadEnvFile(ruta);
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(raiz, "src"),
      "server-only": path.resolve(raiz, "tests/helpers/server-only-vacio.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    setupFiles: ["tests/helpers/forzar-base-prueba.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
