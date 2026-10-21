import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Igual que vitest.config.mts: el entorno real gana a .env, y .env a .env.example (claves de la siembra).
for (const archivo of [".env", ".env.example"]) {
  if (existsSync(archivo)) process.loadEnvFile(archivo);
}

export default defineConfig({
  testDir: "./e2e",
  // La regresión visual solo es válida dentro de la imagen de Playwright (scripts/auditoria/visual-docker.sh).
  testIgnore: process.env.E2E_VISUAL === "1" ? [] : ["**/regresion-visual.spec.ts"],
  outputDir: "./audit/e2e/artefactos",
  snapshotPathTemplate:
    "./e2e/instantaneas/{testFilePath}/{projectName}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "audit/e2e/informe", open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    // Solo para probar el proxy local con su certificado interno (docs/despliegue-https.md).
    ignoreHTTPSErrors: process.env.E2E_IGNORAR_TLS === "1",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-NI",
    timezoneId: "America/Managua",
    reducedMotion: "reduce",
  },
  // RNF-08 (tesis v9): 1920, 1366, 1024 y 768 px.
  projects: [
    // Inicia sesión una vez por perfil y guarda las cookies (playwright.dev/docs/auth).
    { name: "setup", testMatch: /autenticacion\.setup\.ts/ },
    {
      name: "escritorio",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 }, colorScheme: "light" },
    },
    {
      name: "portatil",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "tableta-horizontal",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
    {
      name: "tableta",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
  ],
});
