import { defineConfig, devices } from "@playwright/test";

const PUERTO = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // comparten la misma base en memoria
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    trace: "retain-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Prueba la app compilada para producción, con una base nueva en memoria en cada corrida
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PGLITE_DIR: "memoria",
      SESION_SECRETO: "secreto-de-los-tests-e2e",
      MP_ACCESS_TOKEN: "",
      ANTHROPIC_API_KEY: "",
    },
  },
});
