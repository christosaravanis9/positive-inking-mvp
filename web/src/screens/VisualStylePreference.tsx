import { useJourney } from "../journey/JourneyProvider";
import type { VisualStylePreference as VisualStylePreferenceValue } from "@positive-inking/engine";

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
 */
const OPTIONS: { value: VisualStylePreferenceValue; title: string; description: string }[] = [
  {
    value: "abstract_symbolic",
    title: "Abstract & symbolic",
    description: "An object or image that represents the feeling, not the literal story",
  },
  {
    value: "illustrative_narrative",
    title: "Illustrative & narrative",
    description: "A scene that visually shows what happened",
  },
  {
    value: "typography",
    title: "Typography-based",
    description: "The story told through lettering or words as the design itself",
  },
  {
    value: "comic_strip",
    title: "Comic-strip / panel style",
    description: "The story told across small linked panels",
  },
  {
    value: "montage_collage",
    title: "Montage / collage",
    description: "Several images layered or combined into one composition",
  },
  {
    value: "not_sure",
    title: "Not sure",
    description: "Show me a mix",
  },
];

export function VisualStylePreference() {
  const { patchProject, patchUI } = useJourney();

  function choose(value: VisualStylePreferenceValue) {
    patchProject({ visual_style_preference: value });
    patchUI({ visualStylePreferenceSet: true });
  }

  return (
    <div className="screen">
      <p className="screen-eyebrow">Finding the shape</p>
      <h2 className="screen-heading">Which visual approach appeals to you?</h2>
      <p className="supporting">
        This helps us lean the first ideas toward what you tend to respond to. You can still like or build on
        anything else we show.
      </p>
      <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
        {OPTIONS.map((option) => (
          <button key={option.value} className="option-chip option-chip-card" onClick={() => choose(option.value)}>
            <span className="option-chip-title">{option.title}</span>
            <span className="option-chip-description">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
