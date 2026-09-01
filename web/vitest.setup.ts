import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * @testing-library/react only auto-registers its own `afterEach(cleanup)`
 * when it finds a global `afterEach` on `globalThis` (see its dist/index.js:
 * `if (typeof afterEach === 'function') afterEach(cleanup)`). This project's
 * vitest.config.ts deliberately does not set `test.globals: true` (test
 * files import `describe`/`it`/`expect` explicitly from "vitest" instead),
 * so that global never exists and auto-cleanup silently never registered --
 * every `renderHook`/`render` call in journey/useAsyncAction.test.tsx that
 * doesn't explicitly call its own `unmount()` (4 of its 6 cases) left a live
 * React root, and everything React's reconciler/scheduler attaches to one,
 * mounted for the rest of the process's life instead of just the test.
 *
 * This is very likely why `vitest run` was observed not returning to the
 * shell after all tests passed: a mounted root is exactly the kind of
 * resource whose teardown timing (via React's scheduler, which schedules
 * work through a MessageChannel/timer under jsdom) differs enough across
 * platforms and Node builds that it can leave the event loop non-empty on
 * one machine and not another, even though the tests themselves are
 * deterministic and passed in both cases.
 *
 * Explicit setupFiles registration (rather than flipping test.globals to
 * true) fixes exactly this gap without changing how every test file
 * resolves the rest of the Vitest API.
 */
afterEach(() => {
  cleanup();
});
