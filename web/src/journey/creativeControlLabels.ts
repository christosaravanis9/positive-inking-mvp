import type { CreativeControl } from "@positive-inking/engine";

/**
 * Human-facing label for the internal CreativeControl enum, shared by every
 * screen that displays a confirmed creative-control choice back to the user
 * (Design Confirmation, Working Notes) so the raw enum value -- e.g.
 * "client_led" -- never leaks into user-facing copy.
 */
export const CREATIVE_CONTROL_LABEL: Record<CreativeControl, string> = {
  client_led: "You're directing this closely",
  collaborative: "Developing this together with the artist",
  artist_led: "The artist is interpreting your direction",
  surrendered: "You've handed creative control to the artist",
};

export function describeCreativeControl(value: string): string {
  return CREATIVE_CONTROL_LABEL[value as CreativeControl] ?? value;
}
