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
    setupFiles: ["tests/helpers/forzar-base-prueba.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
    // globalSetup no se hereda de la raiz: solo integration prepara la base.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          exclude: ["tests/unit/**/*-interfaz.test.ts"],
        },
      },
      {
        // Render completo con axe: lento, fuera del ciclo rapido de unit.
        extends: true,
        test: { name: "interfaz", include: ["tests/unit/**/*-interfaz.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/helpers/global-setup.ts"],
          // Todas las pruebas comparten una base: un archivo a la vez.
          fileParallelism: false,
        },
      },
    ],
  },
});
