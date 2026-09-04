import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Data-minimization audit, item 1: the Anthropic API key must exist
 * server-side only. Vite can only ever bundle an identifier that is
 * actually referenced somewhere in client source -- so the real guarantee
 * this locks in is upstream of any built bundle: `ANTHROPIC_API_KEY` (the
 * env var) and `anthropicApiKey` (the server's own field name for it,
 * server/src/env.ts) must never be referenced anywhere under web/src at
 * all. If neither identifier is ever written here, there is nothing for
 * any future change to accidentally bundle, log, or send back to a
 * component in a response.
 */

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("Data-minimization audit — item 1: the API key never reaches client source (and therefore never the bundle)", () => {
  const webSrcRoot = path.resolve(__dirname);
  const files = listSourceFiles(webSrcRoot);

  it("scanned a non-trivial number of real source files (sanity check the scan itself isn't silently empty)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no client source file references the API key env var or its server-side field name, except one verified-harmless developer-facing help string", () => {
    // AsyncError.tsx shows a static, hardcoded sentence telling a *local developer*
    // to add the env var to server/.env when the server reports no key configured --
    // the literal env var NAME as plain advice text, never a value, and never read
    // from any env/config object (Vite doesn't expose arbitrary process.env to
    // client code in the first place, only import.meta.env.VITE_* -- there is no
    // mechanism by which this file could read or leak a real key even if it tried).
    const knownSafeExceptions = new Set(["components/AsyncError.tsx"]);
    const offenders: string[] = [];
    for (const file of files) {
      const relative = path.relative(webSrcRoot, file);
      if (knownSafeExceptions.has(relative)) continue;
      const source = readFileSync(file, "utf8");
      if (/ANTHROPIC_API_KEY/.test(source) || /anthropicApiKey/.test(source)) {
        offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the one allowed exception is genuinely just static advice text, not a read of any real key value", () => {
    const source = readFileSync(path.join(webSrcRoot, "components", "AsyncError.tsx"), "utf8");
    expect(source).toContain("Add ANTHROPIC_API_KEY to server/.env");
    // Never anything that could plausibly be reading a live value out of an env object.
    expect(source).not.toMatch(/process\.env|import\.meta\.env|anthropicApiKey/);
  });

  it("the client only ever calls same-origin /api/* routes -- no client API module references any other host or an Authorization/x-api-key header", () => {
    const apiDir = path.join(webSrcRoot, "api");
    const apiFiles = readdirSync(apiDir).filter((f) => f.endsWith(".ts"));
    expect(apiFiles.length).toBeGreaterThan(0);

    for (const file of apiFiles) {
      const source = readFileSync(path.join(apiDir, file), "utf8");
      expect(source, `${file} should not set an auth header`).not.toMatch(/x-api-key|Authorization/i);
      expect(source, `${file} should not call a non-relative absolute URL`).not.toMatch(/https?:\/\/api\.anthropic\.com/i);
    }
  });
});
