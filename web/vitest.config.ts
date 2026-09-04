import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Separate from vite.config.ts (the dev/build server config) so the two
 * concerns don't tangle. Covers the React/state-boundary logic that engine/'s
 * pure-function tests structurally cannot reach -- see journey/useAsyncAction.test.tsx.
 */
export default defineConfig({
  plugins: [react()],
  // vite.config.ts injects real git commit/branch info here for BuildIdentifier.tsx/
  // TelemetryInspector.tsx (dev-only components, always mounted when import.meta.env.DEV
  // is true -- which vitest's own default mode also satisfies). Without a matching define
  // here, any test that renders Journey.tsx (or App.tsx) crashes on those two components'
  // literal `__GIT_COMMIT__`/`__GIT_BRANCH__` references. Static placeholder values --
  // no test asserts on them, they only need to exist.
  define: {
    __GIT_COMMIT__: JSON.stringify("test"),
    __GIT_BRANCH__: JSON.stringify("test"),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
