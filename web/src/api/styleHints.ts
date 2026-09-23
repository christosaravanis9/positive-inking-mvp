import { postJson } from "./client";
import type { StyleHintsData } from "./types";
import { clientTimeoutForRoute } from "@positive-inking/engine";

/**
 * 2026-09-23: personalized per-lane hint text for VisualStylePreference.tsx.
 * Deliberately the one call in this app whose caller is expected to catch
 * and silently fall back on failure -- see that screen's own effect, which
 * never routes this through useAsyncAction/the shared journey error state.
 */
export async function requestStyleHints(confirmedMeaningOrProvenance: string): Promise<StyleHintsData> {
  const result = await postJson<{ data: StyleHintsData }>(
    "/api/style-hints",
    { confirmed_meaning_or_provenance: confirmedMeaningOrProvenance },
    clientTimeoutForRoute("style_hints"),
  );
  return result.data;
}
