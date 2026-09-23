/**
 * Persona 5: Editor -- uses "Build upon" with a real edited description on
 * at least one candidate, to exercise the refine_user_edit path and
 * confirm the edit is respected rather than the model reimposing the
 * original structure. fakeAnthropic.mjs's refine branch echoes the edit
 * back verbatim as a prefix ("${edit}, refined: ..."), so this can be
 * checked exactly: the resulting candidate description must start with
 * this persona's own edited text, not a fresh, differently-worded
 * alternative.
 */
export default {
  id: "editor",
  label: "Editor",
  storyText:
    "I inherited my father's woodworking tools when he passed. I still use his hand plane every time I build something -- it's the one tool of his I reach for first.",
  viewpointChipIndex: 0,
  expectDepthGate: false,
  screen7: {
    buildUpon: {
      matchDescriptionPrefix: "a new mark made by overlapping the outlines of both your initials",
      editText: "a small engraved mark shaped like the curve of a hand plane's blade, not the initials",
    },
  },
};
