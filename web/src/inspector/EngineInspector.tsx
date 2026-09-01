import {
  getNextScreen,
  computeQuestionBudget,
  evaluateCompositionFlow,
  evaluateArtisticDimensions,
  routeAfterDiscovery,
} from "@positive-inking/engine";
import { useJourney } from "../journey/JourneyProvider";
import { deriveProgress } from "../journey/deriveProgress";
import { deriveConceptSignals } from "../journey/deriveConceptSignals";

/**
 * Dev-only engine inspector. This is a test instrument, not a debugging
 * console: every value shown here is read directly from the same engine
 * calls the live screens use to decide what to ask, so if this panel and
 * the screen ever disagree, that disagreement is a real bug, not a display
 * lag. Not rendered in production builds (see App.tsx).
 */
export function EngineInspector() {
  const { state } = useJourney();
  const { project, ui } = state;
  const progress = deriveProgress(state);
  const currentScreen = getNextScreen(progress);
  const signals = deriveConceptSignals(state);

  const budget = computeQuestionBudget({
    creative_control: signals.creative_control,
    user_is_tattoo_literate: signals.user_is_tattoo_literate,
    literacy_bonus_eligible: project.journey_mode !== "expert" || ui.advancedControlsOpened,
  });

  const compositionFlow = evaluateCompositionFlow({
    concept_shape: signals.concept_shape,
    place_role: project.place_role,
    element_count: signals.element_count,
    size_class: signals.size_class,
    connects_to_other_work: signals.connects_to_other_work,
    has_text_or_handwriting: signals.has_text_or_handwriting,
    composition_background: project.composition_background,
    already_answered: ui.compositionAnswers,
    priorBudgetSpent: ui.compositionBudgetSpent,
    budget,
  });

  const hasExactFidelityElement = project.visual_elements.some((e) => e.fidelity === "exact");
  const artisticFlow = evaluateArtisticDimensions({
    has_colour_signal: signals.has_colour_signal,
    colour_signal_ambiguous: false,
    primary_is_likeness_place_or_animal: signals.has_likeness || project.place_role === "subject" || signals.primary_element_type === "animal",
    size_class: signals.size_class,
    concept_shape: signals.concept_shape,
    design_density: (project.design_density || "") as "" | "minimal" | "balanced" | "full",
    low_visibility_placement: ui.lowVisibilityPlacement,
    has_exact_fidelity_element: hasExactFidelityElement,
    user_is_tattoo_literate: signals.user_is_tattoo_literate,
    advanced_controls_opened: ui.advancedControlsOpened,
    creative_control: signals.creative_control,
    text_led_interpretive_or_open_fidelity:
      signals.concept_shape === "text_led" && project.visual_elements.some((e) => e.fidelity === "interpretive" || e.fidelity === "open"),
    style_under_specified: false,
    style_resolves: project.style_resolves,
    style_reference: project.style_reference,
    already_answered: ui.artisticAnswers,
    priorBudgetSpent: ui.artisticBudgetSpent,
    budget,
  });

  const discoveryRoute =
    project.confidence > 0 || project.visual_confidence > 0
      ? routeAfterDiscovery(project.confidence, project.visual_confidence, ui.clarificationUsed)
      : null;

  return (
    <details className="inspector">
      <summary>Engine Inspector (dev only)</summary>

      <h4>Journey</h4>
      <dl>
        <dt>journey_mode</dt>
        <dd>{project.journey_mode}</dd>
        <dt>current screen</dt>
        <dd>{currentScreen}</dd>
        <dt>readiness (if set)</dt>
        <dd>{ui.blueprint?.readiness ?? "(not yet computed)"}</dd>
      </dl>

      <h4>Concept signals</h4>
      <dl>
        <dt>concept_shape</dt>
        <dd>{signals.concept_shape}</dd>
        <dt>element_count</dt>
        <dd>{signals.element_count}</dd>
        <dt>place_role</dt>
        <dd>{signals.place_role}</dd>
        <dt>size_class</dt>
        <dd>{signals.size_class}</dd>
        <dt>creative_control</dt>
        <dd>{signals.creative_control}</dd>
        <dt>has_text_or_handwriting</dt>
        <dd>{String(signals.has_text_or_handwriting)}</dd>
        <dt>has_likeness</dt>
        <dd>{String(signals.has_likeness)}</dd>
        <dt>has_exact_fidelity_element</dt>
        <dd>{String(signals.has_exact_fidelity_element)}</dd>
        <dt>has_colour_signal</dt>
        <dd>{String(signals.has_colour_signal)}</dd>
        <dt>spatial_language_present</dt>
        <dd>{String(signals.spatial_language_present)}</dd>
      </dl>

      <h4>Clarification (§9)</h4>
      <dl>
        <dt>meaning confidence</dt>
        <dd>{project.confidence.toFixed(2)}</dd>
        <dt>visual confidence</dt>
        <dd>{project.visual_confidence.toFixed(2)}</dd>
        <dt>routing</dt>
        <dd>{discoveryRoute ?? "(no story submitted yet)"}</dd>
        <dt>clarification used (budget of 1)</dt>
        <dd>{String(ui.clarificationUsed)}</dd>
        <dt>interpretation_confidence</dt>
        <dd>{project.interpretation_confidence || "(unset)"}</dd>
      </dl>

      <h4>Question budget</h4>
      <dl>
        <dt>discretionary composition ceiling</dt>
        <dd>{budget.discretionary_composition}</dd>
        <dt>composition spent</dt>
        <dd>{compositionFlow.budgetSpent}</dd>
        <dt>discretionary artistic ceiling</dt>
        <dd>{budget.discretionary_artistic}</dd>
        <dt>artistic spent</dt>
        <dd>{artisticFlow.budgetSpent}</dd>
        <dt>advanced controls</dt>
        <dd>{budget.advanced_controls}</dd>
      </dl>

      <h4>Composition questions (§12.5)</h4>
      <table>
        <tbody>
          {compositionFlow.questions.map((q) => (
            <tr key={q.key}>
              <td>{q.key}</td>
              <td>
                {q.status}
                {q.mandatory && <span className="recommendation-tag">mandatory</span>}
              </td>
              <td>{q.value ?? "—"}</td>
              <td style={{ color: "var(--muted)", fontSize: "0.8em" }}>{q.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Artistic dimensions (§12.8)</h4>
      <table>
        <tbody>
          {artisticFlow.dimensions.map((d) => (
            <tr key={d.key}>
              <td>{d.key}</td>
              <td>
                {d.status}
                {d.status === "skipped_defaulted" && <span className="recommendation-tag">recommendation</span>}
                {d.status === "confirmed" && <span className="recommendation-tag">confirmed</span>}
              </td>
              <td>{d.value ?? "—"}</td>
              <td style={{ color: "var(--muted)", fontSize: "0.8em" }}>{d.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Confirmed vs. recommended (§18, AC 63)</h4>
      <dl>
        <dt>confirmed_themes</dt>
        <dd>{project.confirmed_themes.join(", ") || "—"}</dd>
        <dt>confirmed_core_values</dt>
        <dd>{project.confirmed_core_values.join(", ") || "—"}</dd>
        <dt>fidelity_treatment</dt>
        <dd>{project.fidelity_treatment || "(not applicable / not yet answered)"}</dd>
        <dt>avoid_list_status</dt>
        <dd>{project.avoid_list_status}</dd>
      </dl>

      <h4>Failure state</h4>
      <dl>
        <dt>consecutive failures</dt>
        <dd>{ui.consecutiveFailures}</dd>
        <dt>manual path active</dt>
        <dd>{String(ui.manualPathActive)}</dd>
      </dl>
    </details>
  );
}
