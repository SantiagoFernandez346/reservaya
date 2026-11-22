import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" corta el build si se importa desde el navegador; en los tests no hace falta
      "server-only": fileURLToPath(new URL("./test/vacio.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    env: { PGLITE_DIR: "memoria" },
    testTimeout: 20_000,
  },
});
