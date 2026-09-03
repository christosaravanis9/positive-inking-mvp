import { useEffect, useState } from "react";
import { getNextScreen, type ScreenId } from "@positive-inking/engine";
import { useJourney } from "./JourneyProvider";
import { deriveProgress } from "./deriveProgress";
import { GLOBAL_ERROR_EVENT, type GlobalErrorDetail } from "../globalErrors";
import { Welcome } from "../screens/Welcome";
import { Viewpoint } from "../screens/Viewpoint";
import { Story } from "../screens/Story";
import { Clarification } from "../screens/Clarification";
import { Correction } from "../screens/Correction";
import { MeaningReflection } from "../screens/MeaningReflection";
import { IntentionConfirmation } from "../screens/IntentionConfirmation";
import { ImageDescription } from "../screens/ImageDescription";
import { ImageProvenance } from "../screens/ImageProvenance";
import { ElementsDiscovery } from "../screens/ElementsDiscovery";
import { CreativeControl } from "../screens/CreativeControl";
import { RoughScale } from "../screens/RoughScale";
import { CompositionBackground } from "../screens/CompositionBackground";
import { StyleReference } from "../screens/StyleReference";
import { ArtisticDirection } from "../screens/ArtisticDirection";
import { Avoidances } from "../screens/Avoidances";
import { Placement } from "../screens/Placement";
import { DesignConfirmation } from "../screens/DesignConfirmation";
import { BlueprintView } from "../screens/BlueprintView";
import { WorkingNotesView } from "../screens/WorkingNotesView";
import { EngineInspector } from "../inspector/EngineInspector";
import { TelemetryInspector } from "../inspector/TelemetryInspector";
import { StartFreshJourneyButton } from "../dev/StartFreshJourneyButton";
import { BuildIdentifier } from "../dev/BuildIdentifier";
import { UnderstandingPanel } from "../components/UnderstandingPanel";

const SCREEN_COMPONENTS: Record<ScreenId, () => JSX.Element | null> = {
  welcome: Welcome,
  viewpoint: Viewpoint,
  story: Story,
  clarification: Clarification,
  correction: Correction,
  meaning_reflection: MeaningReflection,
  intention_confirmation: IntentionConfirmation,
  image_description: ImageDescription,
  image_provenance: ImageProvenance,
  elements_discovery: ElementsDiscovery,
  creative_control: CreativeControl,
  rough_scale: RoughScale,
  composition_background: CompositionBackground,
  style_reference: StyleReference,
  artistic_direction: ArtisticDirection,
  avoidances: Avoidances,
  placement: Placement,
  design_confirmation: DesignConfirmation,
  blueprint: BlueprintView,
  working_notes: WorkingNotesView,
};

/**
 * Screens with their own distinct layout in the Sites migration spec --
 * Welcome has its own three-column hero (spec §1.3 "Welcome layout"), the
 * Blueprint is a centred print-style sheet (spec §7's "Blueprint and print
 * presentation", no side panel mentioned), and Working Notes is this app's
 * own manual-fallback escape hatch, not one of the ten numbered intake
 * steps the "What we've understood" panel accompanies (spec §2).
 */
const HIDE_UNDERSTANDING_PANEL: ReadonlySet<ScreenId> = new Set(["welcome", "blueprint", "working_notes"]);

export function Journey() {
  const { state } = useJourney();
  const [globalError, setGlobalError] = useState<GlobalErrorDetail | null>(null);

  useEffect(() => {
    const handler = (event: Event) => setGlobalError((event as CustomEvent<GlobalErrorDetail>).detail);
    window.addEventListener(GLOBAL_ERROR_EVENT, handler);
    return () => window.removeEventListener(GLOBAL_ERROR_EVENT, handler);
  }, []);

  const screen = getNextScreen(deriveProgress(state));
  const ScreenComponent = SCREEN_COMPONENTS[screen];
  const showUnderstandingPanel = !HIDE_UNDERSTANDING_PANEL.has(screen);

  return (
    <div className={`app-shell${showUnderstandingPanel ? " journey-with-panel" : ""}`}>
      <div className="journey-stage">
        {showUnderstandingPanel && <UnderstandingPanel variant="details" />}
        {globalError && (
          <div className="error-banner">
            Unhandled {globalError.source}: {globalError.message}
          </div>
        )}
        <ScreenComponent key={screen} />
        {import.meta.env.DEV && <StartFreshJourneyButton />}
        {import.meta.env.DEV && <EngineInspector />}
        {import.meta.env.DEV && <TelemetryInspector />}
        {import.meta.env.DEV && <BuildIdentifier />}
      </div>
      {showUnderstandingPanel && <UnderstandingPanel variant="rail" />}
    </div>
  );
}
