import { useEffect, useRef, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { requestStyleHints } from "../api/styleHints";
import { confirmedMeaningOrProvenanceText } from "../journey/confirmedMeaning";
import { ModelWaitIndicator } from "../components/ModelWaitIndicator";
import type { VisualStylePreference as VisualStylePreferenceValue, AssociationLane } from "@positive-inking/engine";

/**
 * Pre-qualifying visual-style question (2026-09). Asked once, right before
 * Association is ever called for the first time -- after the client's
 * meaning/story (full mode) or provenance (attraction/expert mode) is
 * established, which is exactly where all journey modes already converge
 * (§7). The answer biases the very first Association batch toward the
 * client's stated taste (see ASSOCIATION_SYSTEM_PROMPT's rule 1 biasing
 * instruction) rather than leaving the model to guess a visual approach with
 * no signal at all. "Not sure" is a real, equally-weighted answer, not a
 * skip -- it tells Association to spread evenly across all 5 lanes instead
 * of leaning on one.
 *
 * 2026-09-23: multi-select -- the client may pick more than one lane at
 * once (mutually exclusive with "Not sure", enforced by toggle() below), so
 * this now requires an explicit Continue rather than auto-advancing on the
 * first click.
 */
const OPTIONS: { value: VisualStylePreferenceValue; title: string; description: string }[] = [
  {
    value: "abstract_symbolic",
    title: "Abstract & symbolic",
    description: "An object or image that represents the feeling, not the literal story",
  },
  {
    value: "illustrative",
    title: "Illustrative",
    description: "A single clear subject or scene, shown plainly rather than combined with other elements",
  },
  {
    value: "typography",
    title: "Typography-based",
    description: "The story told through lettering or words as the design itself",
  },
  {
    value: "framed",
    title: "Framed",
    description: "A scene or sequence set inside its own visible frame -- a small run of linked panels, a Polaroid-style vignette, or a badge/crest shape",
  },
  {
    value: "narrative_collage",
    title: "Narrative Collage / Layered Montage",
    description: "Several of the story's own elements layered or combined into one composition -- a storyboard, a moodboard, or a themed grouping",
  },
  {
    value: "not_sure",
    title: "Not sure",
    description: "Show me a mix",
  },
];

export function VisualStylePreference() {
  const { state, patchProject, patchUI } = useJourney();
  // 2026-09-23: per-lane personalized subheadings, replacing the identical-
  // for-everyone generic text above for whichever lanes the hint call
  // actually returns something for. Deliberately plain useState, not
  // useAsyncAction -- see the effect below for why.
  const [hints, setHints] = useState<Partial<Record<AssociationLane, string>>>({});
  const [hintsLoading, setHintsLoading] = useState(true);
  const [selected, setSelected] = useState<VisualStylePreferenceValue[]>(state.project.visual_style_preferences);
  const mountedRef = useRef(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // fetchedRef (not a plain effect-body call) guards against firing this
    // real model call twice under React StrictMode's dev-mode double-invoke
    // of an effect -- same "run exactly once" idiom ElementsDiscovery.tsx's
    // own historySeededRef already uses for the same reason.
    //
    // Deliberately relies on mountedRef ALONE for staleness, not a second,
    // per-invocation "cancelled" closure flag combined with a cleanup
    // function here -- live-tested bug (2026-09-23): under StrictMode's
    // mount -> cleanup -> remount cycle, a cleanup-set `cancelled = true`
    // poisons the FIRST invocation's closure permanently, since fetchedRef
    // stops the second invocation from ever starting a fresh fetch or
    // returning a fresh cleanup. The one real in-flight request then
    // resolves against a `cancelled` flag stuck true forever, silently
    // discarding the result and leaving hintsLoading stuck true forever --
    // exactly the shape of bug this file's own established
    // guard.isStale()/mountedRef pattern (useAsyncAction.ts) avoids by
    // never overlaying a second, independently-scoped cancellation flag on
    // top of it. mountedRef is correctly true again by the time this
    // effect's one real fetch resolves (it flips back to true synchronously
    // during the remount that follows the synthetic unmount), so it alone
    // is both necessary and sufficient here.
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Deliberately NOT routed through useAsyncAction/the shared journey
    // error state (setError): a failure here must degrade silently to the
    // static OPTIONS descriptions above, never surface the shared
    // AsyncError banner (this screen doesn't render one, but a leftover
    // shared error could still surface on whichever screen the client
    // reaches next that does) and never block choosing an option. This is
    // the one call in the app whose caller is expected to catch and
    // silently ignore its own failure -- see docs/timeout-matrix.md's
    // "Style hints" section.
    requestStyleHints(confirmedMeaningOrProvenanceText(state.project))
      .then((result) => {
        if (!mountedRef.current) return;
        setHints(result.hints);
      })
      .catch(() => {
        // Silent, deliberate: hints stays {} and every option below falls
        // back to its own static description.
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setHintsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Not sure" is mutually exclusive with the 5 real lanes: picking it
  // clears any lane picks, and picking a lane clears "Not sure".
  function toggle(value: VisualStylePreferenceValue) {
    setSelected((prev) => {
      if (value === "not_sure") {
        return prev.includes("not_sure") ? [] : ["not_sure"];
      }
      const withoutNotSure = prev.filter((v) => v !== "not_sure");
      return withoutNotSure.includes(value) ? withoutNotSure.filter((v) => v !== value) : [...withoutNotSure, value];
    });
  }

  function confirm() {
    patchProject({ visual_style_preferences: selected });
    patchUI({ visualStylePreferenceSet: true });
  }

  return (
    <div className="screen">
      <p className="screen-eyebrow">Finding the shape</p>
      <h2 className="screen-heading">Which visual approach appeals to you?</h2>
      <p className="supporting">
        This helps us lean the first ideas toward what you tend to respond to. You can still like or build on
        anything else we show. Pick as many as apply.
      </p>
      {hintsLoading && <ModelWaitIndicator label="Getting a feel for your story..." route="style_hints" />}
      {!hintsLoading && (
        <>
          <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {OPTIONS.map((option) => {
              // "not_sure" never gets a personalized hint -- it has no lane to ground one in.
              const hint = option.value === "not_sure" ? undefined : hints[option.value];
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  className={`option-chip option-chip-card${isSelected ? " selected" : ""}`}
                  onClick={() => toggle(option.value)}
                >
                  <span className="option-chip-title">{option.title}</span>
                  <span className="option-chip-description">{hint ?? option.description}</span>
                </button>
              );
            })}
          </div>
          <button disabled={selected.length === 0} onClick={confirm}>
            Continue
          </button>
        </>
      )}
    </div>
  );
}
