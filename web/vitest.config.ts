import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Separate from vite.config.ts (the dev/build server config) so the two
 * concerns don't tangle. Covers the React/state-boundary logic that engine/'s
 * pure-function tests structurally cannot reach -- see journey/useAsyncAction.test.tsx.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
