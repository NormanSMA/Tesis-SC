import { defineConfig, devices } from "@playwright/test";

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
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 }, colorScheme: "light" },
    },
    {
      name: "portatil",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "tableta-horizontal",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
    {
      name: "tableta",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
  ],
});
