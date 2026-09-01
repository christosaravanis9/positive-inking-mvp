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

  return (
    <div className="app-shell">
      {globalError && (
        <div className="error-banner">
          Unhandled {globalError.source}: {globalError.message}
        </div>
      )}
      <ScreenComponent key={screen} />
      {import.meta.env.DEV && <EngineInspector />}
    </div>
  );
}
