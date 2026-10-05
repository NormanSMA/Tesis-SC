import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
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
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-NI",
    timezoneId: "America/Managua",
  },
  projects: [
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "portatil",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "tableta-horizontal",
      use: { ...devices["iPad Pro landscape"] },
    },
    {
      name: "tableta",
      use: { ...devices["iPad Pro"] },
    },
  ],
});
