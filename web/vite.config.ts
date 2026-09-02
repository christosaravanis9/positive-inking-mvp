import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Read fresh on every `vite` config load (i.e. every dev-server start, and
 * every production build) -- never cached or baked in earlier. That's the
 * entire point: the commit/branch shown in the running app (see
 * web/src/dev/BuildIdentifier.tsx) has to reflect whatever is actually on
 * disk right now, so "am I looking at old code" is answerable without
 * leaving the browser. Falls back to "unknown" rather than failing the
 * build if git isn't available.
 */
function gitInfoForBuild() {
  const run = (args: string[]) => {
    try {
      return execSync(`git ${args.join(" ")}`, { encoding: "utf8" }).trim();
    } catch {
      return "unknown";
    }
  };
  return {
    commit: run(["rev-parse", "--short", "HEAD"]),
    branch: run(["rev-parse", "--abbrev-ref", "HEAD"]),
  };
}

const { commit, branch } = gitInfoForBuild();

export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_COMMIT__: JSON.stringify(commit),
    __GIT_BRANCH__: JSON.stringify(branch),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
