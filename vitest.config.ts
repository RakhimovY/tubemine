import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // .test.tsx files opt into jsdom via a per-file pragma at the top:
    //   // @vitest-environment jsdom
    // (Vitest 4 removed environmentMatchGlobs; pragma is the supported replacement.)
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // server-only throws at import time outside RSC. In Vitest (node env),
      // map it to an empty stub so server modules can be unit-tested.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
})
