# Positive Inking Sites UX Migration Specification

Implementation-ready reference for reproducing the strongest design and journey decisions from the current Positive Inking Sites prototype in a separate, engineering-hardened codebase.

**Audited source:** Sites project `positive-inking-intake`, commit `7af12af`  
**Audit date:** 2 September 2026  
**Scope:** The currently implemented build, not the earlier conversational specification or an intended future version.

Status terms used below:

- **FIXED:** hardcoded in the client and the same for every journey.
- **GENERATED:** returned by a live model request and therefore varies by project.
- **FALLBACK:** deterministic client-side content used when the corresponding model request is unavailable or invalid.
- **CLIENT-DERIVED:** assembled in the browser from prior answers; it varies, but it is not model-generated.
- **NOT YET IMPLEMENTED:** absent from the audited build.

The welcome page is an unnumbered Step 0. The intake itself contains Steps 1–10, followed by the unnumbered Blueprint result at internal state 11.

## 1. Design system

### 1.1 Typography

No webfont is loaded. The visual character comes from a deliberately restrained system-font pairing:

- **Display/editorial:** `Georgia, "Times New Roman", serif`
- **Interface/sans:** `Arial, Helvetica, sans-serif`

| Use | Family | Weight | Size | Line height | Tracking / transform |
|---|---|---:|---:|---:|---|
| Welcome title | Georgia | 400 | `clamp(48px, 7vw, 94px)`; mobile `clamp(49px, 14vw, 72px)` | `0.96` | `-0.035em` |
| Intake screen title / H1 | Georgia | 400 | `clamp(40px, 5.2vw, 68px)`; mobile `42px` | `1.02` | `-0.035em` |
| Blueprint title | Georgia | 400 | `clamp(42px, 6vw, 70px)`; print `48px` | browser default | `-0.035em` |
| Welcome lead | Georgia | 400 | `clamp(17px, 2vw, 22px)` | `1.55` | none |
| Screen introductory copy | Georgia | 400 | `17px` | `1.6` | none |
| Screen H2 | Georgia | 400 | `28px` | `1.2` | none |
| Suggested treatment H2 | Georgia | 400 | `24px` | `1.35` | none |
| Screen H3 / question label | Arial | 700 | `10px` | `1.2` | `0.13em`, uppercase |
| Eyebrow | Arial | 700 | `10px` | `1.2` | `0.19em`, uppercase |
| Reflection blockquote | Georgia | 400 | `clamp(20px, 3vw, 30px)` | `1.45` | none |
| Intention blockquote | Georgia | 400 | `clamp(27px, 4vw, 44px)` | `1.3` | none |
| Intention editor | Georgia | 400 | `24px` | `1.45` | none |
| Story input | Georgia | 400 | `18px` | `1.55` | none |
| Vision / arrangement input | Georgia | 400 | `16px` | `1.55` | none |
| Choice title | Arial | 600 | `14px` | `1.35` | none |
| Choice description | Arial | 400 | `12px` | `1.4` | none |
| Relay interpretation | Georgia | 400 | `15px` | `1.55` | none |
| Relay label | Arial | 700 | `9px` | `1` | `0.16em`, uppercase |
| Side-panel field label | Arial | 700 | `9px` | browser default | `0.13em`, uppercase |
| Side-panel field value | Georgia | 400 | `13px` | `1.55` | none |
| Hint / microphone status | Arial | 400 | `11px` | default or `1.5` for status | none |
| Analysis status | Arial | 400 | `10px` | `1.5` | `0.025em` |
| Blueprint section H2 | Georgia | 400 | `27px` | `1.2` | none |
| Blueprint paragraph / list | Georgia | 400 | `15px` | `1.65` | none |
| Blueprint blockquote | Georgia | 400 | `18px` | `1.55` | none |
| Standard button | Arial | 500 | `14px` | framework default | no wrapping |

The brand wordmark uses Georgia at `18px` on desktop and `15px` below 640px. Its boxed `PI` monogram uses Arial, weight 700, `12px`, and `-0.05em` tracking.

### 1.2 Colour palette

| Token / literal | Hex | Current use |
|---|---|---|
| `paper` / background | `#F4F0E8` | Page, primary form background, outline-button background |
| `paper-deep` / secondary | `#E9E2D7` | Secondary surface and muted background token |
| `ink` / foreground / primary | `#171614` | Main text, hard borders, selected checkboxes, primary buttons |
| `muted` | `#6D685F` | Instructions, hints, descriptions, secondary text |
| `line` / border / input | `#C9C0B3` | Default borders, separators, progress track |
| `red` / ring | `#8E2F2A` | Eyebrows, selected-card accent, progress fill, active voice state, focus ring, Blueprint readiness stamp |
| `blue` | `#304F68` | Design-interpretation blockquote rule and faint page-axis texture |
| `white` / card | `#FFFDF8` | Selected cards, text areas, Blueprint paper, primary-button text |
| `accent` | `#DED6CA` | Outline/ghost button hover background |
| `destructive` | `#A52620` | Destructive component token; not used in the normal intake path |
| Lead text literal | `#4E4A43` | Welcome lead paragraph |
| Reflection literal | `#35312C` | Reflection and generated design interpretation text |
| Blueprint body literal | `#403C36` | Blueprint paragraphs and list items |
| Blueprint quote literal | `#302D29` | Blueprint blockquote |
| Fallback warning | `#B08B43` | Left border of fallback-status message |
| Print white | `#FFFFFF` | Printed page background |

Current translucent surfaces:

- Header: `rgba(244, 240, 232, 0.94)` with a `14px` backdrop blur.
- Default choice card: `rgba(255, 253, 248, 0.45)`.
- Suggested-treatment card: `rgba(255, 253, 248, 0.55)`.
- Analysis status: `rgba(255, 255, 255, 0.55)`.
- Listening halo: `rgba(142, 47, 42, 0.10)`.
- Listening secondary text: `rgba(255, 255, 255, 0.72)`.
- Page-axis texture: `rgba(48, 79, 104, 0.04)` in a one-pixel vertical centre line.

### 1.3 Page shell, spacing and responsive layout

#### Header

- Sticky at the top with `z-index: 20`.
- Height: `74px` desktop; `64px` below 640px.
- Horizontal padding: `clamp(20px, 4vw, 62px)` desktop; `16px` below 640px.
- Bottom border: `1px solid #171614`.
- Contains the wordmark on the left and progress cluster on the right.

#### Main two-column workspace

- Maximum total width: `1320px`, centred.
- Grid: `minmax(0, 1fr) 330px`.
- At the maximum width the content stage receives 990px and the understanding rail 330px: approximately 75% / 25%. The right column is fixed-width rather than percentage-based.
- Minimum height: viewport height minus the 74px header.
- Main stage padding: top `clamp(44px, 7vw, 92px)`, horizontal `clamp(22px, 6vw, 86px)`, bottom `60px`.
- A `1px #C9C0B3` rule separates the stage from the side panel.
- Standard screens are capped at `800px`; Step 9 uses a `960px` wide screen.
- The side panel has `54px 28px` padding, is sticky below the header (`top: 74px`), fills the remaining viewport height, and scrolls independently.

#### Welcome layout

- Minimum height: viewport minus 74px header.
- Three-column grid: `0.8fr minmax(320px, 720px) 0.6fr`, vertically centred, with a `5vw` gap.
- Padding: `7vh clamp(22px, 5vw, 82px)`.
- Left column is the vertical outlined `P · P · F` axis; centre is the copy/CTA; right is a 64vh time rail.
- At 900px and below it collapses to one column, hides the axis and time rail, and uses `55px 22px` padding.

#### Breakpoints

- **At 900px and below:** collapse to a single column; hide the desktop side panel; remove the stage divider; use `38px 20px 50px` stage padding; insert a collapsed `<details>` summary titled **“What we’ve understood”** above the current screen.
- **At 640px and below:** header becomes 64px; screen title becomes 42px; all two-column choice, question, treatment and adaptive grids become one column; default choice minimum height becomes 68px; confirmation rows become one column; inline action buttons stack full-width; Blueprint tightens to `27px 20px` padding.

#### Repeated spacing rhythm

- Screen intro: `20px` top margin, `32px` bottom margin.
- Major question block: `34px` top margin.
- Two-column question groups: `28px` gap.
- Choice grids: `10px` gap; compact single-column groups: `7px` gap.
- Reflective relay: `28px` top margin, `18px 4px` padding.
- Bottom navigation: `44px` top margin, `18px` top padding and a `1px` separator.
- Screen entry animation: 320ms ease-out, from opacity 0 and `translateY(8px)` to the resting state.

### 1.4 Selection cards

Selection cards are labels around visually hidden native radio buttons or checkboxes. Preserve native input semantics and keyboard operation in the target implementation.

#### Default card

- Two-column grid unless the group is marked compact.
- Minimum height `84px` (`68px` on small mobile).
- Border `1px solid #C9C0B3`.
- Background `rgba(255,253,248,0.45)`.
- Padding `17px`.
- Internal flex gap `14px`; content top-aligned.
- Indicator: `18px × 18px`, `1px #C9C0B3` border.
- Hover: border changes to `#171614`; card moves up 1px; transition 160ms.

#### Selected card

- Border becomes `#171614`.
- Background becomes `#FFFDF8`.
- Inset `3px` red rule on the left (`#8E2F2A`).
- Indicator background and border become `#171614`; check icon becomes `#FFFDF8`.

#### Compact card

- Used for denser single-choice lists and all multi-select lists.
- Minimum height `57px`, padding `13px 15px`, vertically centred.
- Multi-select items do not display descriptions in the current component.

### 1.5 Progress indicator

The header shows `Step N of 10` for intake states 1–10 and `Blueprint` for result state 11. The fill calculation is:

```text
if state == 11: 100
else: max(0, ((state - 1) / 9) * 100)
```

Therefore Step 1 is 0%, Step 2 is 11.11%, …, Step 10 is 100%. This treats the first screen as the starting point rather than 10% complete.

Styling:

- Cluster width `min(310px, 43vw)`; below 640px it becomes `52vw` and stacks label above bar.
- Label: Arial `10px`, uppercase, `0.12em`, no wrap.
- Track: `3px` high, square corners, `#C9C0B3`.
- Fill: `#8E2F2A`; width is implemented by translating a full-width indicator.

### 1.6 Button hierarchy

| Hierarchy | Current variant | Visual rules | Current uses |
|---|---|---|---|
| Primary | `default` | `#171614` background, `#FFFDF8` text, 90% opacity ink on hover | Continue, Discover my tattoo, Build my Blueprint, Print/save |
| Secondary | `outline` | `1px` border, `#F4F0E8` background, subtle shadow; `#DED6CA` hover | Add custom item, Recommend it, Start another |
| Tertiary | `ghost` | Transparent; `#DED6CA` hover with ink text | Back, Edit this, Change something |

Shared behavior:

- Font `14px`, weight 500, inline-flex with centred content and `8px` gap.
- Default height `36px`, horizontal padding `16px`; large size is `40px` high with `24px` horizontal padding.
- Disabled: pointer events removed and opacity 0.5.
- Keyboard focus: red focus border and a `3px` ring at 50% red opacity.
- Framework default corner radius is 4px, but all important journey contexts explicitly flatten buttons to `0px`: inline actions, navigation, Blueprint footer, add rows, recommendation row and welcome CTA. Reproduce square buttons throughout this journey for consistency.

The component library also defines a filled `secondary` variant, but this journey does not use it. “Secondary” in the product hierarchy above means the visibly outlined action actually used by the intake.

## 2. The “What we’ve understood” panel — full specification

### 2.1 Rendering and behavior

The panel is a continuously updating, non-editable summary of selected project state. It is visible as the fixed 330px right rail above 900px. At 900px and below it appears in a collapsed native `<details>` block before each screen. The mobile block is collapsed by default and is not programmatically opened when a value changes.

Rows with empty values are omitted. Before any answer exists, the desktop/mobile panel displays:

> Your direction will build here as you move through the experience.

The desktop panel ends with this exact copy:

> Nothing here is fixed. Use Back or Edit whenever the direction stops feeling accurate.

That note is **not shown inside the mobile `<details>` implementation**; only the field summary is rendered there.

### 2.2 Complete field inventory and update rules

The real current implementation has eight possible fields—not a distinct field for every intake concept.

| Panel field | Populated / updated | Panel value | Truncation or summarisation |
|---|---|---|---|
| **Viewpoint** | Immediately when a Step 1 option is selected; changing it keeps the new viewpoint visible while invalidating all downstream discovery/design state | Exact option label: `Past`, `Present`, `Future`, or `A mixture` | None |
| **Story** | Live on every typed or dictated update in Step 2 | User’s story verbatim | If length is greater than 105 JavaScript characters: first 105 characters plus `…`. No semantic summary and no word-boundary handling |
| **Meaning** | Live as themes are selected/deselected in Step 3 | All selected theme labels joined with ` · ` | None; can become long |
| **Visual material** | Live as generated or custom visual sources are selected/deselected in Step 5 | All selected source labels joined with ` · ` | None; can become long |
| **Emerging vision** | Live while the user types the Step 5 design-vision text; hidden when blank or when the recommendation path clears it | User’s design description verbatim | Same 105-character slice plus `…` rule as Story |
| **Composition** | Live from Step 7 | Composition mode and arrangement joined with ` · ` | Density and source are omitted even when selected; no truncation |
| **Treatment** | Initially populated when the Step 8 → 9 direction request returns or falls back; updates if the user adjusts treatment in Step 9 | Drawing, linework, shading and colour joined with ` · ` | Contrast is omitted; no truncation |
| **Placement** | Live as Step 8 choices are selected | Side, body area and scale joined with ` · ` | Body flow is omitted; no truncation |

### 2.3 Information not represented in the current panel

The following captured values do **not** have panel rows: generated reflection, confirmed intention, primary subject, reference fidelity, reference readiness, emerging-vision mode, creative-control preference, supporting-image density/source, placement flow, generated concept-specific answers, treatment contrast, safeguards, reference needs, and open decisions.

For a faithful migration, preserve the eight-row model above. For a more complete hardened version, add fields only as an explicit product change; do not describe those additions as behavior inherited from Sites.

### 2.4 Styling

- Heading: standard red eyebrow, margin-bottom `24px`.
- Every row begins with a `1px #C9C0B3` top rule and uses `15px 0` padding.
- Field labels: red, 9px, weight 700, uppercase, `0.13em`, margin-bottom 7px.
- Values: Georgia 13px / 1.55.
- Footer note: Georgia 13px / 1.55, muted; `1px #171614` top rule, 18px top padding, 30px top margin.

## 3. Full question flow, step by step

Unless a step defines its own inline actions, the footer navigation is **Back** on the left and **Continue** on the right. Continue is disabled until that step’s completion rule is satisfied. Step 4, Step 10 and the Blueprint replace the shared navigation with their own actions.

### Unnumbered welcome screen

This is fixed presentation, not one of the ten intake steps.

- Eyebrow: **“Your story, made visible”**
- Heading: **“Discover the tattoo already inside your experience.”**
- Lead: **“You do not need to know what you want yet. Start with what matters, and Positive Inking will help turn it into a clear tattoo direction.”**
- Primary action: **“Discover my tattoo”**
- Supporting note: **“Around 5 minutes · No account required”**
- Decorative time rail: **PAST / PRESENT / FUTURE**

### Step 1 — Viewpoint

**Type: FIXED**

- Eyebrow: **“Start with time”**
- Heading: **“Where does this tattoo come from?”**
- Instruction: **“Choose the viewpoint that feels closest. It can contain more than one.”**

| Option label | Description |
|---|---|
| Past | Something or someone that shaped me |
| Present | What matters in my life now |
| Future | Who I am becoming or what I am building |
| A mixture | More than one part of my story |

After selection, show a CLIENT-DERIVED relay labeled **“What this changes”**:

> We’ll use **{selected viewpoint lowercased}** as the opening lens without forcing the rest of your story into one period.

Completion rule: one viewpoint is required.

### Step 2 — Story

**Type: FIXED question with free-text answer**

- Eyebrow: **“Tell it naturally”**
- Heading: **“What do you want this tattoo to be about?”**
- Instruction: **“Mention who or what is involved, why it matters, and what you want to remember, express or become. Do not worry about imagery yet.”**
- Textarea placeholder: **“Start wherever the story begins…”**
- Voice action when idle: **“Talk about it”** / **“Uses your browser microphone”**
- Voice action when active: **“Stop listening”** / **“Microphone active”**
- Hint before 20 trimmed characters: **“A few honest sentences are enough.”**
- Hint at 20 or more trimmed characters: **“That gives us enough to interpret the meaning.”**

Completion rule: at least 20 trimmed characters. Continuing triggers `POST /api/discovery`; see Sections 5 and 6.

While that request is pending, the Continue label becomes **“Finding the meaning…”** and navigation is disabled.

### Step 3 — Meaning reflection

**Type: GENERATED when the discovery request succeeds; FALLBACK otherwise**

- Eyebrow: **“Meaning reflection”**
- Heading: **“Here is what we heard.”**
- Reflection: GENERATED `reflection`, shown in a blockquote.
- Live-success status: **“Interpretation generated from your story.”**
- Missing-key fallback status: **“Using the prototype interpretation until the AI connection is activated.”**
- Other fallback status: **“The AI connection was temporarily unavailable, so the prototype interpretation is shown instead.”**
- Secondary heading: **“Which parts feel important?”**
- Instruction: **“Select everything that belongs. We’ll consolidate the values without losing your themes.”**
- Options: GENERATED list of 5–8 story-specific theme strings; they have labels only, no subtext.

After selection, show a CLIENT-DERIVED relay labeled **“What this means”**. It names the first three selected themes. If more than three are selected it appends **“, while the remaining themes stay in the brief.”** Otherwise it ends with a period.

The exact deterministic FALLBACK content is selected by keyword matching:

#### Father/craft fallback

Activated when the lowercased story contains `father` or `dad` and also one of `tattoo`, `artist`, `craft`, or `work`.

- Reflection: **“This appears to connect the relationship with your father to the craft and experience that grew from it. The tattoo would not only look back at where the journey began; it would also recognise what you have developed and what you intend to carry forward.”**
- Theme options: **Relationship; The craft I was taught; Development; Continuity; Trust; What I am building now; The next stage**

#### Children fallback

Activated when the story contains `child`, `children`, `daughter`, `son`, or `kids` and the father/craft rule did not match.

- Reflection: **“This appears to be about your relationship with your children and the person that relationship asks you to become. The tattoo may need to hold both what you feel now and what you hope to build or protect over time.”**
- Theme options: **Family; Connection; Protection; Growth; Responsibility; The future**

#### Generic fallback

- Reflection: **“This appears to connect {viewpoint-dependent phrase} with what matters now. The strongest visual direction should come from the actual people, places, objects and experiences within the story rather than default symbolism.”**
- The viewpoint-dependent phrase is `where you have come from` for **A mixture**, otherwise the selected viewpoint lowercased.
- Theme options: **Connection; Identity; Growth; Change; Commitment; What comes next**

Completion rule: select at least one theme.

### Step 4 — Intention confirmation

**Type: GENERATED when discovery succeeds; FALLBACK otherwise; confirmation UI is FIXED**

- Eyebrow: **“Your intention”**
- Heading: **“Your tattoo is about…”**
- Statement: generated/fallback `intention`, kept visible on the same screen as its actions.
- Normal actions: **“Continue”** and **“Edit this”**.
- Editing actions: **“Save change”** and **“Cancel”**.
- Hint: **“The complete statement stays visible while you continue or edit it.”**

Exact FALLBACK intentions:

- Father/craft: **“To mark the relationship and experience that shaped me, recognise what I have developed from it, and carry that meaning into what comes next.”**
- Children: **“To represent the connection, responsibility and future that my relationship with my children has given me.”**
- Generic: **“To give visible form to an experience that has shaped me and carry its meaning into what comes next.”**

Current limitation: this screen has no non-empty validation after editing. A user can save an empty intention and still continue. The hardened implementation should require a non-empty trimmed statement.

### Step 5 — Personal visual material and emerging vision

**Type: mixed. Visual-source candidates are GENERATED/FALLBACK; hierarchy, fidelity, reference and vision-mode questions are FIXED; primary options are CLIENT-DERIVED from selected sources.**

- Eyebrow: **“Personal visual material”**
- Heading: **“What could represent it?”**
- Instruction: **“Choose the real people, marks, objects or places that belong to the story. Then capture any design beginning to form in your mind.”**

#### Visual-source candidates

The live discovery response supplies 5–8 source labels without descriptions. Multi-select is enabled. A user can add a custom item through:

- Placeholder: **“Add an exact person, object, mark or source”**
- Action: **“Add”**

Exact FALLBACK visual-source options:

- Father/craft: **A real working hand or gesture; An actual tool connected to the craft; A personal mark or handwriting; A detail from the first workplace; An early drawing beside a current one; Materials from the work being developed now**
- Children: **A drawing made by them; Their handwriting; A place you share; An everyday family object; A photograph of an ordinary moment; Something you are building together**
- Generic: **A personal photograph; An object connected to the story; A meaningful place; A handwritten phrase or mark; Something made specifically for this tattoo; A repeated memory or ritual**

#### Primary hierarchy

Shown once at least one visual source is selected.

- Question: **“What should be noticed first?”**
- Options: every currently selected visual source, verbatim. This list is CLIENT-DERIVED, not a new model generation.

#### Reference fidelity

Shown alongside primary hierarchy.

- Question: **“How faithfully should personal material be treated?”**

| Option label | Description |
|---|---|
| Copy exact references closely | None |
| Keep them recognisable but simplify | None |
| Allow open interpretation | None |

#### Reference decision status

Shown once a primary subject is selected.

- Question: **“Have the exact personal references been chosen?”**

| Option label | Description |
|---|---|
| Yes — I can provide the exact references | None |
| Some references still need deciding | None |
| No exact references — interpretation is intentional | None |

#### Emerging design vision

Shown once a primary subject is selected.

- Question: **“Has this visual material sparked a design idea?”**

| Option label | Description |
|---|---|
| A design is forming | Capture the image or arrangement you can now see |
| I still want the system to recommend it | Keep the hierarchy, but leave the arrangement open |

If **A design is forming** is selected:

- Field label: **“Describe the design taking shape in your mind”**
- Placeholder: **“Describe the subjects, their arrangement, what is absent, and any important visual relationship…”**
- Hint: **“These words will be preserved in your Blueprint rather than translated into generic selections.”**

The relay is labeled **“Visual hierarchy”** and states:

> **{primary}** becomes the main subject. {If a vision exists: “Your own emerging design now leads the next questions.” Otherwise: “The system will help resolve how the selected material fits together.”}

Completion rule: at least one source, a primary subject, fidelity, reference status and vision mode. If a design is forming, its description must contain at least 10 trimmed characters.

### Step 6 — Authorship

**Type: FIXED**

- Eyebrow: **“Authorship”**
- Heading: **“Who should shape the final design?”**
- Instruction: **“This changes how prescriptive the final Artist Brief should be.”**

| Option label | Description |
|---|---|
| I want to direct it closely | The brief should retain my decisions |
| I want to develop it with the artist | Priorities stay fixed; solutions remain open |
| I want the artist to interpret it | Meaning is fixed; composition stays flexible |
| I want to surrender control | Receiving the interpretation is part of the meaning |

CLIENT-DERIVED relay label: **“How this affects the brief”**. Exact outputs:

- Direct closely: **“The client wants to direct the design closely and approve the arrangement before final artwork begins.”**
- Develop with artist: **“The client wants to develop the solution collaboratively while keeping the confirmed meaning and hierarchy intact.”**
- Artist interpretation: **“The artist may interpret the composition while preserving the confirmed meaning, subjects and safeguards.”**
- Surrender control: **“The artist has broad compositional freedom, while the meaning and essential personal material remain protected.”**

Completion rule: one option required.

### Step 7 — Composition

**Type: FIXED questions plus free-text arrangement. No model request occurs on this step.**

- Eyebrow: **“Composition”**
- Heading: **“How should the subjects exist as a tattoo?”**
- Instruction: **“First decide whether any background exists. Then describe the relationship between the selected elements.”**

#### Composition type

| Option label | Description |
|---|---|
| Main subject only — no background | Only the confirmed subject material appears |
| Subject with subtle supporting elements | Small accents may support the main subject |
| Subject within an immersive setting | A place, environment or scene carries part of the story |

If **Main subject only — no background** is selected, the two following questions are not shown and any prior density/source answers are cleared.

#### Amount of supporting imagery

Shown only when background/support is allowed.

- **Minimal** — no subtext
- **Balanced** — no subtext
- **Full** — no subtext

#### Where should it come from?

Shown only when background/support is allowed.

- **A real personal place or environment** — no subtext
- **The story and journey** — no subtext
- **Abstract atmospheric flow** — no subtext
- **A controlled combination** — no subtext

#### Arrangement

- Label: **“How should the elements relate or be arranged?”**
- Placeholder: **“For example: the handwriting crosses the object; the main figure sits above the smaller family references…”**
- Prompt beside fallback action: **“If you cannot see the arrangement yet:”**
- Action: **“Recommend it”**
- Clicking that action inserts the literal text: **“Recommend the strongest arrangement from the confirmed hierarchy and personal material.”** It does not call a model at that moment.

Completion rule: composition mode plus at least 10 trimmed characters of arrangement. Density and source are additionally required unless `Main subject only — no background` is selected.

When complete, a CLIENT-DERIVED relay labeled **“Composition so far”** shows:

- No-background path: `Keep the composition focused on the selected subject material only, with no background or decorative surrounding imagery. {arrangement}`
- Other path: `{mode}. Use {density lowercased} supporting imagery drawn from {source lowercased}. {arrangement}`

### Step 8 — Placement and flow

**Type: FIXED**

- Eyebrow: **“Placement and flow”**
- Heading: **“Where will the tattoo live?”**
- Instruction: **“Placement comes before the final artistic questions so those decisions can respond to the actual body area.”**

#### Side

- **Left** — no subtext
- **Right** — no subtext
- **Undecided** — no subtext

#### Body area

- **Outer upper arm** — no subtext
- **Inner upper arm** — no subtext
- **Outer forearm** — no subtext
- **Inner forearm** — no subtext
- **Chest** — no subtext
- **Torso or ribs** — no subtext
- **Back** — no subtext
- **Leg** — no subtext
- **Another area** — no subtext

Current limitation: selecting **Another area** does not reveal a free-text field, so the actual area cannot be captured.

#### Scale

- **Small and contained** — no subtext
- **Medium and focused** — no subtext
- **Large — most of the area** — no subtext
- **Expandable into future work** — no subtext

#### Body flow

- **Mostly front-facing** — no subtext
- **Partially wrapping** — no subtext
- **Full wraparound foundation** — no subtext
- **Let the artist recommend the flow** — no subtext

CLIENT-DERIVED relay label: **“Placement implication”**:

> The design will be developed for the **{side lowercased} {area lowercased}** as a **{scale lowercased}** composition with **{flow lowercased}** flow.

Completion rule: all four answers required. Continuing triggers `POST /api/direction` before Step 9 opens.

While that request is pending, the Continue label becomes **“Shaping the design…”** and navigation is disabled.

### Step 9 — Concept-specific design decisions

**Type: GENERATED when the direction request succeeds; FALLBACK otherwise. The optional manual technical-control set is FIXED.**

- Eyebrow: **“Concept-specific decisions”**
- Heading: **“How should this particular idea be handled?”**
- Instruction: **“These questions are generated from your subjects, your own vision, the composition and the placement — not from a fixed tattoo-style questionnaire.”**
- Live-success status: **“These decisions were generated for your specific subjects and design direction.”**
- Fallback status: **“The adaptive design pass was temporarily unavailable, so a safe concept-based version is shown.”**

#### Generated interpretation and questions

The model returns one 2–4 sentence interpretation and 2–4 adaptive questions. Every question contains:

- a generated title;
- a generated reason;
- 3–4 generated mutually exclusive options;
- a FIXED interface-appended **“Something else”** option.

Selecting **Something else** reveals a field with placeholder **“Describe the decision in your own words”**.

Because these questions are genuinely generated, there is no fixed exhaustive option list. The deterministic FALLBACK is exact and always contains these three questions:

1. **“How should {primary lowercased} relate to the supporting material?”**  
   Reason: **“This controls whether the design reads as one integrated idea or as distinct personal elements.”**  
   Options: **Integrated into one composition; Primary subject clearly dominant; Kept visually separate; Something else**
2. **“Which quality must remain most authentic?”**  
   Reason: **“Personal material can lose its character if it is cleaned, stylised or simplified too heavily.”**  
   Options: **The exact original shapes; The natural irregularities; The emotional impression; Something else**
3. **“Where should the strongest visual emphasis sit?”**  
   Reason: **“A single focal decision prevents the selected elements from competing equally.”**  
   Options: **On the primary subject; Where the elements connect; Across the complete silhouette; Something else**

FALLBACK interpretation:

- If a user vision exists, use that text verbatim.
- Otherwise: **“{primary} will lead the design, with {supporting material or ‘any supporting material’} kept subordinate. {No-background sentence or supporting-arrangement sentence}”**
- No-background sentence: **“It will remain isolated, with no background imagery.”**
- Other sentence: **“Supporting material will be arranged around it without weakening the hierarchy.”**

#### Suggested technical treatment

The model returns a generated summary plus one value for each of five fixed enums. The user then chooses:

| Option label | Description |
|---|---|
| Use the suggested treatment | Keep the concept-specific recommendation |
| Adjust the treatment myself | Open the technical controls |

If adjustment is selected, show these FIXED controls:

| Question | Options |
|---|---|
| Drawing language | Graphic and simplified; Illustrative; Realistic |
| Linework | Light and delicate; Structured and clear; Heavy and dominant |
| Shading | Line-led with minimal shading; Smooth tonal shading; Richly rendered |
| Contrast | Soft and restrained; Balanced; Dramatic light and dark |
| Colour | Black and grey; Selective colour; Full colour |

Exact FALLBACK recommendation:

- Summary: **“Use an illustrative, clearly structured treatment that keeps the personal material recognisable and gives the primary subject the strongest contrast.”**
- Drawing: **Illustrative**
- Linework: **Structured and clear**
- Shading: **Smooth tonal shading**
- Contrast: **Balanced**
- Colour: **Black and grey**

#### Essential safeguards

- Question: **“Essential safeguards”**
- Reason: **“These likely failure modes come from this concept. Keep, remove or add to them.”**
- Options: 4–7 GENERATED safeguards, initially all selected.
- Custom field placeholder: **“Add something this design must avoid”**
- Action: **“Add”**

The exact FALLBACK safeguards are:

1. `Do not replace {primary lowercased} with a generic substitute`
2. `Do not allow {supporting material lowercased} to overpower the primary subject`
3. If fidelity contains the case-sensitive substring `exact`: **“Do not redraw authentic personal marks as polished typography or stock artwork”**; otherwise **“Do not simplify the personal material until it becomes unrecognisable”**
4. No-background path: **“Do not add decorative scenery, filler or atmospheric background”**; otherwise **“Do not add unsupported imagery merely to fill space”**

Current bug to avoid in migration: the selected fidelity label is **“Copy exact references closely”**, where `exact` is lowercased and therefore matches. This works today, but the logic is brittle because it depends on display-copy substring matching rather than an enum.

Completion rule: answer every adaptive question; custom text is required for every **Something else** answer; select treatment mode; if adjusting, answer all five technical controls. Safeguards may all be deselected.

### Step 10 — Complete direction confirmation

**Type: FIXED, entirely CLIENT-DERIVED. No model request occurs.**

- Eyebrow: **“Complete direction”**
- Heading: **“Ready to build your Blueprint.”**
- Instruction: **“Everything being confirmed remains visible here. Continue or go back to change it.”**

The same screen displays these exact confirmation labels:

1. **Your visual idea** — verbatim vision, or **“No fixed image yet — use the confirmed hierarchy and recommendations”**
2. **Main subject** — selected primary
3. **Supporting material** — sources joined with ` · `, or **“None selected”**
4. **Composition** — client-composed sentence from Step 7
5. **Specific decisions** — each generated question title and selected/custom answer joined with ` · `
6. **Treatment** — drawing, linework, shading, contrast and colour joined with ` · `
7. **Safeguards** — selected safeguards joined with ` · `, or **“None added”**
8. **Placement** — `{side} {area} · {scale} · {flow}`
9. **Reference status** — exact Step 5 selection
10. **Creative control** — exact Step 6 selection

Actions:

- Primary: **“Build my Blueprint”**
- Tertiary: **“Change something”**, which returns only to Step 9. To change an earlier screen, the user must then use Back repeatedly.

There is no additional readiness validation and no server request when the Blueprint is built.

## 4. Readiness/completion model

### 4.1 Current badge logic

The Blueprint badge has only two possible values:

```text
referenceComplete =
  referenceStatus == "Yes — I can provide the exact references"
  OR referenceStatus == "No exact references — interpretation is intentional"

hasOpenDecisions =
  direction.openDecisions has one or more items
  OR referenceStatus == "Some references still need deciding"
  OR visionMode != "A design is forming"

badge =
  if referenceComplete AND NOT hasOpenDecisions: "DESIGN READY"
  else: "DIRECTION READY"
```

### 4.2 Current five-component Readiness section

| Component | Possible displayed text | Current determining rule |
|---|---|---|
| **Meaning** | `Complete` | Unconditional; does not validate that edited intention is non-empty |
| **Visual direction** | `Complete` | `hasOpenDecisions == false` |
|  | `Clear, with decisions still to resolve` | `hasOpenDecisions == true` |
| **References** | `Available to provide` | `referenceComplete == true` |
|  | exact raw reference-status answer | `referenceComplete == false`; in practice this is `Some references still need deciding` |
| **Artist discussion** | `Ready` | Unconditional |
| **Final artwork** | `Ready to begin` | `referenceComplete == true` and `hasOpenDecisions == false` |
|  | `Begin after the listed open decisions and references are resolved` | Otherwise |

### 4.3 Current semantic limitations — do not reproduce as hardened logic

These are facts about the audited build:

1. **Intentional absence of exact references is mislabeled.** `No exact references — interpretation is intentional` counts as `referenceComplete`, but the Blueprint displays **“References: Available to provide”** rather than “Not required” or “Interpretation intentionally reference-free.”
2. **Model-returned open decisions do not resolve automatically when adaptive questions are answered.** `direction.openDecisions` is preserved unchanged. Unless the model returns an empty array, answering Step 9 questions does not necessarily make the project `DESIGN READY`.
3. **The recommendation path can never be design-ready.** If vision mode is `I still want the system to recommend it`, `hasOpenDecisions` remains true even after the user accepts generated decisions.
4. **Meaning and artist discussion are always declared complete/ready.** They are presentation labels, not validated gates.
5. **Final artwork readiness means “ready to begin artwork.”** No artwork is produced or verified by this build.
6. **No reference files are uploaded or inspected.** Readiness uses the user’s declaration only.

### 4.4 Hardened migration requirement

Retain the five-row presentation but implement each status as a typed, evidence-backed state rather than string comparisons. At minimum use separate enums for `referenceRequirement` (`required`, `not_required`, `undecided`) and `referenceAvailability` (`available`, `missing`, `not_applicable`). Mark a generated recommendation as resolved only after explicit acceptance. Map every `openDecision` to a stable ID and clear it when the corresponding answer satisfies it. The target codebase should preserve the current wording only where it is truthful.

## 5. Voice input implementation

### 5.1 API and browser behavior

Dictation uses the browser’s Web Speech API:

```text
window.SpeechRecognition || window.webkitSpeechRecognition
```

Configuration:

- `continuous = true`
- `interimResults = true`
- `lang = "en-GB"`

No Positive Inking backend endpoint receives audio. The application does not call Whisper, OpenAI audio transcription, MediaRecorder, or a custom streaming service.

The flow is:

1. Capture the current trimmed story as `startingText` when dictation starts.
2. On each `onresult`, append final segments to an in-memory `completedText` buffer.
3. Rebuild the textarea value from `startingText + completedText + current interim segments`.
4. On stop/end, keep the text editable.
5. Abort recognition when the component unmounts.

### 5.2 Latency truth

The UI is **event-streaming from the browser recognition service**, because interim hypotheses are written to the textarea whenever `onresult` fires. It is not guaranteed zero-latency, word-by-word local transcription.

- There is no app-controlled audio buffer or batch upload.
- There may still be browser/vendor buffering, remote processing latency, pauses before an interim event, and revision of interim words. The implementation cannot measure or guarantee a latency budget.
- Final segments may arrive later than their interim versions.
- Browser support and service availability vary. The code provides a typed-story fallback when `SpeechRecognition` is absent.

### 5.3 User-visible states and errors

- Start: **“Listening… Speak naturally. Your words will appear above.”**
- Normal end: **“Dictation stopped. You can edit the transcript before continuing.”**
- Unsupported: **“Live dictation is not supported by this browser. You can still type your story below.”**
- Permission denied: **“Microphone permission was denied. Allow microphone access in your browser settings, then try again.”**
- No speech: **“No speech was detected. Tap the microphone and try again.”**
- Aborted: **“Dictation stopped.”**
- Other recognition error: **“Dictation paused unexpectedly. Your existing transcript has been preserved.”**
- Synchronous start failure: **“The microphone could not start. Check browser permission and try again.”**

Current robustness limitation: transcription state is tied to the story updater, which invalidates discovery state on every interim result. That is acceptable before discovery but should be isolated in the target state machine. The target should also test browser support explicitly and decide whether vendor-dependent Web Speech is sufficient or whether a controlled transcription service is required.

## 6. Backend reality check

### 6.1 Honest current architecture

The build contains two real server routes and both can make real OpenAI model calls when `OPENAI_API_KEY` is configured. It is not a fully canned mock. However, most of the journey is browser state and string assembly.

The hosting configuration declares no D1 database and no R2 storage. There is no account, saved project, upload, analytics event model, resumable session or server-side Blueprint record.

| Journey action | Network behavior | Downstream behavior |
|---|---|---|
| Load application | Normal framework asset/document requests | No project data load |
| Continue from Step 1 | None | Client state only |
| Continue from Step 2 | `POST /api/discovery` | Server calls OpenAI Responses API when configured |
| Select/continue Steps 3–7 | None | Client state and deterministic rendering only |
| Continue from Step 8 | `POST /api/direction` | Server calls OpenAI Responses API when configured |
| Complete Steps 9–10 | None | Client validation and string assembly only |
| Build Blueprint | None | Entire 12-section document assembled in React from in-memory state |
| Print/save Blueprint | None from application | `window.print()` opens the browser print dialog |
| Voice dictation | No Positive Inking endpoint | Browser speech service may itself use vendor network infrastructure |

### 6.2 `POST /api/discovery`

#### Client request

```json
{
  "viewpoint": "Past | Present | Future | A mixture",
  "story": "trimmed user story"
}
```

Server validation:

- viewpoint must match one of the four exact labels;
- story must be 20–4000 characters;
- malformed JSON returns HTTP 400 `INVALID_REQUEST`;
- invalid fields return HTTP 400 `INVALID_INPUT`;
- missing `OPENAI_API_KEY` returns HTTP 503 `AI_NOT_CONFIGURED`.

#### Downstream call

- `POST https://api.openai.com/v1/responses`
- Model: `gpt-5.6`
- `max_output_tokens: 1400`
- Bearer key is read server-side from `OPENAI_API_KEY` and is not sent to the browser.
- Input contains a fixed Positive Inking discovery system prompt plus selected viewpoint and story.
- Response is constrained with a strict JSON Schema named `positive_inking_discovery`.

#### Success response

```ts
{
  data: {
    reflection: string; // 80–700 characters
    themes: string[];   // 5–8 items, each 2–80 characters
    visuals: string[];  // 5–8 items, each 3–120 characters
    intention: string;  // 40–380 characters
  }
}
```

The prompt asks for a tentative 2–4 sentence reflection, specific selectable themes, personal sources of imagery rather than completed designs, and a concise first-person intention beginning with “To”. It explicitly discourages automatic lion/compass/clock/wings symbolism, invented facts, psychoanalysis and grandiose language.

#### Failure handling

- Non-2xx OpenAI response: HTTP 502 `AI_UNAVAILABLE`.
- Missing or unparseable structured output: HTTP 502 `AI_INVALID_RESPONSE` or `AI_UNAVAILABLE`.
- Client catches any failure and uses the deterministic `analyse()` fallback described in Steps 3–5.

### 6.3 `POST /api/direction`

#### Client request

```ts
{
  story: string;
  intention: string;
  themes: string[];
  visuals: string[];
  primary: string;
  fidelity: string;
  referenceStatus: string;
  visionMode: string;
  designVision: string;
  control: string;
  composition: {
    mode: string;
    density: string;
    source: string;
    arrangement: string;
  };
  placement: {
    side: string;
    area: string;
    scale: string;
    flow: string;
  };
}
```

Server validation is intentionally light in the current build:

- primary must be non-empty;
- story must be at least 20 characters;
- composition and placement must merely be non-empty objects;
- string fields are trimmed and length-limited;
- themes are sliced to ten values; visuals to twelve;
- composition and placement are not deeply schema-validated at the route boundary.

Before sending the project to the model, the route renames and sanitises the client fields into this downstream object:

```ts
{
  story,
  intention,
  themes,
  visual_material: visuals,
  primary,
  fidelity,
  reference_status: referenceStatus,
  vision_status: visionMode,
  user_visual_idea_verbatim: designVision,
  creative_control: control,
  composition,
  placement
}
```

#### Downstream call

- `POST https://api.openai.com/v1/responses`
- Model: `gpt-5.6`
- `max_output_tokens: 2200`
- Fixed design-direction system prompt plus a JSON serialization of the confirmed project data.
- Strict JSON Schema named `positive_inking_direction`.

#### Success response

```ts
{
  data: {
    interpretation: string; // 60–700 characters
    questions: Array<{       // 2–4 items
      id: string;            // 2–40 characters; IDs must be unique
      title: string;         // 10–180 characters
      reason: string;        // 20–280 characters
      options: string[];     // 3–4 items, each 2–120 characters
    }>;
    treatment: {
      summary: string;       // 40–420 characters
      drawing: "Graphic and simplified" | "Illustrative" | "Realistic";
      linework: "Light and delicate" | "Structured and clear" | "Heavy and dominant";
      shading: "Line-led with minimal shading" | "Smooth tonal shading" | "Richly rendered";
      contrast: "Soft and restrained" | "Balanced" | "Dramatic light and dark";
      colour: "Black and grey" | "Selective colour" | "Full colour";
    };
    suggestedAvoid: string[]; // 4–7 items, each 12–180 characters
    referenceNeeds: string[]; // 1–6 items, each 5–180 characters
    openDecisions: string[];  // 0–6 items, each 5–180 characters
  }
}
```

The prompt directs the model to follow the user’s own vision, preserve a no-background choice, ask only high-impact unresolved questions, return concept-specific failure modes and refrain from adding generic symbols. The route checks that generated question IDs are unique after parsing.

#### Failure handling

- Same HTTP error pattern as discovery.
- Client uses `fallbackDirection()` on any error or invalid response.
- The fallback is not a model call; its exact questions, treatment and safeguard rules are documented in Step 9.

### 6.4 Pure client-side logic

These behaviors make no application network request:

- progress calculation and all navigation;
- every fixed option set;
- side-panel construction and truncation;
- “reflect → interpret → advance” relay text;
- custom visual and safeguard additions;
- composition sentence and **Recommend it** placeholder insertion;
- all completion rules;
- Step 10 confirmation sheet;
- readiness badge and five readiness lines;
- all 12 Blueprint sections and Artist Brief;
- print/save and reset (`window.location.reload()`).

### 6.5 Current production-hardening gaps

These features are **NOT YET IMPLEMENTED** in the Sites build and should come from the hardened codebase rather than be inferred from the prototype:

- request timeouts or abort-based model budgets;
- automatic retry/backoff;
- re-entrancy protection against rapid double submit;
- stale-response or unmount guards before applying model output;
- request IDs, idempotency or response fingerprinting;
- persisted project/session state;
- real reference uploads or validation;
- authenticated user ownership;
- final server-side readiness computation;
- final Blueprint generation or storage on the server;
- image generation or final artwork generation;
- telemetry for latency, fallbacks, abandonment or output quality.

The target architecture should keep the two-stage AI contract—discovery after Story, direction after Placement—but execute it through the hardened project’s existing timeout, staleness, deterministic-readiness and Working Notes mechanisms.

## 7. Blueprint output structure

The Blueprint is generated entirely in the browser. There is no third model pass. It is a 12-section document inside a white bordered sheet, with a header badge of `DESIGN READY` or `DIRECTION READY` and two footer actions: **Print or save Blueprint** and **Start another**.

### 01 — Your story

- Source: `analysis.reflection` from live discovery or deterministic fallback.
- Rendered as one paragraph.
- It is not the verbatim user story; it is the interpretation.

### 02 — Your intention

- Source: generated/fallback intention, including any Step 4 edit.
- Rendered as one paragraph.
- All selected Step 3 themes appear beneath it as uppercase bordered chips.

### 03 — The design you’re imagining

- First blockquote: verbatim `designVision` if supplied.
- Otherwise exact fallback copy: **“No fixed image was imposed. The design should be developed from the confirmed hierarchy, composition and concept-specific decisions below.”**
- Second paragraph: generated or fallback direction `interpretation`.

Current fallback quirk: when a user supplied a design vision and the direction request fails, the fallback interpretation is that same vision verbatim, so the section repeats the text in both the blockquote and paragraph. The migration should suppress the duplicate while retaining the user’s verbatim statement.

### 04 — Confirmed visual subjects

- **Primary:** selected Step 5 primary subject.
- **Supporting:** every selected visual source except the primary, comma-separated; fallback **“No supporting subject selected”**.
- **Reference treatment:** exact fidelity option from Step 5.

### 05 — Composition and arrangement

- Source: deterministic `compositionText()` from Step 7.
- No-background form: **“Keep the composition focused on the selected subject material only, with no background or decorative surrounding imagery. {arrangement}”**
- Background/support form: **“{mode}. Use {density lowercased} supporting imagery drawn from {source lowercased}. {arrangement}”**

### 06 — Concept-specific decisions

- One list item per generated/fallback Step 9 adaptive question.
- Each item contains the question title in bold followed by the selected answer.
- For **Something else**, use the custom text instead of the label.

### 07 — Artistic treatment

One deterministic sentence:

> {drawing} treatment with {linework lowercased} linework, {shading lowercased}, {contrast lowercased} contrast and {colour lowercased}.

Values originate in the Step 9 generated/fallback recommendation and may be overwritten by the five manual controls.

### 08 — Placement and body flow

One deterministic sentence:

- If side is known: `{side} {area}, {scale lowercased}, with {flow lowercased} flow.`
- If side is undecided: `{area} (side undecided), {scale lowercased}, with {flow lowercased} flow.`

### 09 — Essential safeguards

- List of safeguards still selected at the end of Step 9, including custom additions.
- If empty: **“No additional exclusions were confirmed.”**

### 10 — References and open decisions

Always show:

- **Reference status:** exact Step 5 selection.

If direction `referenceNeeds` is non-empty, show **“References to prepare:”** followed by the generated/fallback list.

If `hasOpenDecisions` is true, show **“Still to resolve:”** followed by:

1. every generated/fallback `direction.openDecisions` item;
2. **“Confirm which exact personal references will be supplied.”** when reference status is `Some references still need deciding`;
3. **“Approve the recommended arrangement before final artwork begins.”** when vision mode is not `A design is forming`.

### 11 — Artist Brief

The Artist Brief is not model-generated. It concatenates these deterministic fragments into one paragraph:

1. `Develop a {scale lowercased} tattoo for the {location lowercased}.`
2. `{Primary sentence-cased} is the primary subject{optional supporting clause}.`
3. If a user vision exists: `The client’s visual direction is: “{designVision}”`; otherwise insert the direction interpretation without a prefix.
4. Insert the full composition sentence from Section 05.
5. `Use a {artistic treatment sentence with initial letter lowercased}`.
6. Insert the authorship/control sentence from Step 6.

The optional supporting clause is `, supported by {naturally joined supporting list lowercased}`. Lists of two or more use commas and `and` before the final item.

Current grammar quirk: the template always begins `Develop a {scale} tattoo…`; therefore **Expandable into future work** produces “Develop a expandable…”. Use semantic scale IDs and grammatically correct output in the migration.

### 12 — Readiness

Shows the five current status lines exactly as specified in Section 4:

1. **Meaning**
2. **Visual direction**
3. **References**
4. **Artist discussion**
5. **Final artwork**

This section is client-derived and presentation-oriented. In the hardened migration, preserve its visible structure while sourcing the statuses from the existing deterministic engine and correcting the semantic defects listed in Section 4.3.

### Blueprint and print presentation

- Sheet: maximum width 900px, `#FFFDF8` background, `1px #171614` border, padding `clamp(28px, 6vw, 66px)`.
- Header: title left, readiness stamp right, 34px bottom padding, `2px #171614` bottom rule.
- Stamp: red 1px border/text, `9px 12px 7px` padding, 10px uppercase-style tracked text, rotated 2 degrees; hidden below 640px.
- Section grid: 52px number column plus content, 20px gap, `28px 0` padding and a 1px muted divider. Mobile uses 35px plus content with a 10px gap.
- Print: A4, 14mm top/bottom and 15mm left/right margins; hide app chrome, side/mobile summary, navigation and Blueprint footer; remove sheet border/padding; avoid page breaks within sections; use three-line orphan/widow control.

---

### Migration acceptance criteria

The migration reproduces the Sites build’s strengths when all of the following are true:

1. The exact editorial/sans visual hierarchy, paper palette, square controls, selection states, desktop rail and mobile disclosure are recognisable against this specification.
2. The journey contains the same ten conceptual steps, while generated versus fixed questions remain truthfully separated.
3. The user’s own emerging visual idea is stored verbatim and takes precedence over generic recommendations.
4. `Main subject only — no background` is a first-class composition state and prevents background questions and generated background language.
5. Only Story discovery and post-Placement direction require AI; deterministic interaction remains usable through explicit fallbacks or Working Notes.
6. Every asynchronous response is protected by the hardened codebase’s existing timeout, re-entrancy and stale-response rules.
7. The Blueprint preserves the 12-section information architecture but uses evidence-backed readiness states.
8. No implementation or product claim implies persistence, reference verification, final artwork, or model generation where none exists.
