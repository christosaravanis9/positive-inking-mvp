import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { logTelemetryEvent } from "../instrumentation/telemetry";

type Category = "personal_people" | "personal_places" | "personal_objects" | "personal_events" | "personal_memories" | "personal_phrases";

const CATEGORY_LABELS: Record<Category, string> = {
  personal_people: "People",
  personal_places: "Places",
  personal_objects: "Objects",
  personal_events: "Events",
  personal_memories: "Memories",
  personal_phrases: "Phrases",
};

const CATEGORIES: Category[] = ["personal_people", "personal_places", "personal_objects", "personal_events", "personal_memories", "personal_phrases"];

/**
 * §9.6 — the correction interaction. Not a second clarification question:
 * the system stops asking the user to explain and shows what it extracted
 * for direct editing instead. "People who cannot articulate why something
 * matters can usually still say whether a detail is right."
 */
export function Correction() {
  const { state, patchProject, patchUI } = useJourney();
  const [lists, setLists] = useState<Record<Category, string[]>>(() => ({
    personal_people: [...state.project.personal_people],
    personal_places: [...state.project.personal_places],
    personal_objects: [...state.project.personal_objects],
    personal_events: [...state.project.personal_events],
    personal_memories: [...state.project.personal_memories],
    personal_phrases: [...state.project.personal_phrases],
  }));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [missed, setMissed] = useState("");

  function remove(category: Category, index: number) {
    setLists((prev) => ({ ...prev, [category]: prev[category].filter((_, i) => i !== index) }));
    logTelemetryEvent("meaning_edit", state.project.project_id, { category, action: "removed" });
  }

  function startEdit(category: Category, index: number) {
    setEditingKey(`${category}:${index}`);
    setEditingValue(lists[category][index]!);
  }

  function commitEdit(category: Category, index: number) {
    const changed = lists[category][index] !== editingValue;
    setLists((prev) => ({ ...prev, [category]: prev[category].map((v, i) => (i === index ? editingValue : v)) }));
    setEditingKey(null);
    if (changed) logTelemetryEvent("meaning_edit", state.project.project_id, { category, action: "edited" });
  }

  function confirm() {
    const finalLists = { ...lists };
    if (missed.trim().length > 0) {
      finalLists.personal_phrases = [...finalLists.personal_phrases, missed.trim()];
      logTelemetryEvent("meaning_edit", state.project.project_id, { category: "personal_phrases", action: "added" });
    }
    patchProject({
      ...finalLists,
      personal_material_source: "user_corrected",
      interpretation_confidence: "low",
      interpretation_mode: "tentative",
    });
    patchUI({ lowConfidenceCorrectionDone: true });
  }

  const hasAnyMaterial = CATEGORIES.some((c) => lists[c].length > 0);

  return (
    <div className="screen">
      <h2>Here is what we picked up.</h2>
      <p className="supporting">
        We don't have a clear enough picture of what this is about yet, but we caught some concrete details. Check
        them, fix anything wrong, and tell us if we missed something.
      </p>

      {!hasAnyMaterial && <p className="supporting">Nothing specific came through yet — that's alright. Add anything below.</p>}

      {CATEGORIES.map((category) =>
        lists[category].length > 0 ? (
          <div key={category}>
            <p className="supporting" style={{ marginBottom: 4 }}>
              {CATEGORY_LABELS[category]}
            </p>
            <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
              {lists[category].map((item, i) => {
                const key = `${category}:${i}`;
                return (
                  <div key={key} className="option-chip selected" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    {editingKey === key ? (
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => commitEdit(category, i)}
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => startEdit(category, i)} style={{ cursor: "text", flex: 1 }}>
                        {item}
                      </span>
                    )}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => remove(category, i)}
                      aria-label={`Remove ${item}`}
                      style={{ padding: "2px 8px" }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null,
      )}

      <div>
        <p className="supporting">Anything we have missed?</p>
        <input type="text" value={missed} onChange={(e) => setMissed(e.target.value)} placeholder="Add a person, place, object, or detail" />
      </div>

      <button onClick={confirm}>Continue</button>
    </div>
  );
}
