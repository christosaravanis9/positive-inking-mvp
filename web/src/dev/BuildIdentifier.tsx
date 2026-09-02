/**
 * Dev-only (import.meta.env.DEV-gated, see Journey.tsx). Always visible --
 * not inside TelemetryInspector's collapsed <details>, deliberately -- so
 * "what commit is this browser actually running" never requires a click,
 * let alone leaving the browser to compare terminal output by hand. That
 * was the single most time-costly failure mode in a recent session: four
 * separate confusions caused by debugging against stale code without
 * realizing it. __GIT_COMMIT__/__GIT_BRANCH__ come from web/vite.config.ts's
 * `define` block, recomputed from git on every dev-server start.
 */
export function BuildIdentifier() {
  return (
    <div
      title="Dev only: commit and branch this running app was built from"
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        zIndex: 1000,
        fontSize: 11,
        fontFamily: "monospace",
        padding: "3px 8px",
        borderRadius: 4,
        background: "rgba(0, 0, 0, 0.75)",
        color: "#fff",
        pointerEvents: "none",
      }}
    >
      {__GIT_BRANCH__}@{__GIT_COMMIT__}
    </div>
  );
}
