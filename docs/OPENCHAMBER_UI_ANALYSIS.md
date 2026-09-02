# OpenChamber UI analysis

An investigation of OpenChamber's interface (http://localhost:3000, inspected
September 2, 2026) as a visual and interaction reference for making Passage's
UI less plain. Screenshots referenced below live in `docs/screenshots/`.

OpenChamber is OpenCode's web frontend, built with React and Tailwind. This
document describes what it looks like and why it feels good, then maps each
finding onto Passage's existing direction in [UI.md](UI.md). It is a
reference analysis, not a license to copy assets.

## Overall personality

OpenChamber feels like a well-made desktop notes/terminal hybrid: warm,
quiet, and dense where it counts. The personality comes from five choices:

1. **A warm paper palette instead of pure gray.** The canvas is warm off-white
   (`rgb(253, 252, 250)`), cards are a slightly deeper cream (`#f5f1ea`-ish),
   and text is a warm dark olive-gray (`rgb(57, 58, 52)`), not black. Nothing
   is pure `#000` or `#fff`, which removes the harsh "developer tool" feel.
2. **Chrome that nearly disappears.** No visible card borders in the
   transcript, no shadows, no filled panels. Separation is done with
   background tone, spacing, and occasional hairlines — never boxes.
3. **Compact, uniform rows.** Almost everything operational (tool calls,
   thinking, files, sessions, settings nav) is a ~24–28 px one-line row at
   14 px text. Detail is progressive: a row expands in place when clicked.
4. **Semantic color used sparingly.** 90 % of the UI is neutral; color marks
   state only: amber for "running", green for success/added lines, red for
   removals, blue for informational banners and effort chips, orange for
   badges and accent actions.
5. **A consistent line-icon language.** One 16 px stroke icon set everywhere
   (terminal, brain, pencil, file, folder, git-branch, mic, paperclip).
   Icons are muted gray; they colorize only for state.

## Layout anatomy (desktop)

See `01-home-new-session.png` and `02-session-transcript.png`.

```
┌──────────┬──────────────────────────────┬───┬──────────────┐
│ Sidebar  │ Header (title, branch, ctx%) │ R │ Panel drawer │
│ ~222 px  │──────────────────────────────│ a │  (optional,  │
│          │                              │ i │   ~460 px)   │
│          │      Transcript column       │ l │              │
│          │      (max ~820 px, centered) │   │              │
│          │──────────────────────────────│   │              │
│          │      Composer (pinned)       │   │              │
└──────────┴──────────────────────────────┴───┴──────────────┘
```

- **Sidebar (~222 px):** project/session navigation, always visible, with a
  hairline right border and a near-canvas background. Collapseable to icons.
- **Header (~44 px):** session title + `project ⎇ branch` in tiny muted
  mono on the left; on the right a **context-usage ring** (`17.4 %` with a
  circular progress stroke), a layout toggle, and the model/status control.
- **Transcript column:** centered reading column (roughly 780–820 px) with
  generous top padding; user cards right-aligned, everything else
  full-width left.
- **Right icon rail (~40 px):** one vertical strip of icon buttons for the
  panel surfaces (Context, Changes, Walkthrough, Files, Terminal, Project
  knowledge, Browser). Active panel is highlighted; surfaces show **small
  orange count badges** (e.g. `10` on Changes when files are dirty).
- **Panel drawer:** clicking a rail icon opens a single right-side drawer
  (~460 px) with its own tab-style header and close button. Chat stays
  visible and live beside it — panels never take over the window.
- **Composer:** pinned to the bottom of the chat column, floating as a
  rounded cream card with a soft border.

## Visual foundation

### Color

- Canvas: `rgb(253, 252, 250)`; sidebar and cards slightly warmer/darker.
- Text: primary `rgb(57, 58, 52)`; muted `rgb(120–140)` grays; subtle meta
  text around 12–13 px.
- Accent/state: amber/orange `#d97706`-ish (running, badges, review action),
  green `#15803d`-ish (success, diffs, added counts), blue `#2563eb`-ish
  (informational banners, effort chip), red (destructive, deleted lines).
- Inline code/results are tinted chips: commit lines render green-on-cream;
  hashes in amber; diff additions get a pale green wash, deletions pale red.

### Typography

- UI/prose: `"SF Pro Text", -apple-system, "Segoe UI", system-ui, sans-serif`
  at a 16 px root; transcript prose ~15–16 px with ~1.6 line height.
- Everything operational (commands, paths, branch names, token counts):
  `ui-monospace, SFMono-Regular, Menlo, "Cascadia Mono", monospace` at
  12–13 px.
- Weight range is narrow: 400 body, 500 row labels, 600 section headings.
  No large display type except the empty-state greeting ("What are we
  working on?", ~32 px, regular weight).

### Density

- Tool/thinking/session/settings rows: ~24–28 px tall, single line,
  truncated with ellipsis.
- Message spacing: ~12–16 px between blocks; ~24 px around user cards.
- Panels and settings use the same row rhythm — one consistent scale across
  the whole app is a big part of why it feels coherent.

### Elevation and borders

Flat. Cards are distinguished by background tone alone; the only borders are
hairlines on the sidebar edge, composer, panel headers, and table dividers.
Rounded corners are moderate (8–12 px on cards/pills, 6 px on rows/inputs).

## Component details

### Sidebar (`01`, `02`)

- Top row of small icon buttons: new session, scheduled tasks, multi-run,
  archive | search, multi-select, display mode. All 16 px stroke icons.
- Collapsible sections with chevrons: `chats`, `recent`, then one section
  per project (project name + its colored icon + hover "new session").
- Session rows: status dot (amber = active), title truncated to one line,
  right-aligned **live timer** in amber for the active session
  (`OpenChamber UI analy… ● 18m`), git-branch icon + age for inactive ones.
  Indentation distinguishes subsessions (chevron to expand).
- Bottom pinned row: Settings (gear), Shortcuts (⌘), About (ⓘ).

### Transcript (`02`, `08`)

- **User message:** right-aligned rounded card in warm cream, plain text,
  no border/shadow. On hover (always on mobile): a small timestamp row with
  icon actions — revert, fork, pin-into-context, copy.
- **Tool row (collapsed):** `🖱 Shell Command 0.1s  git status` — icon,
  500-weight label, duration, then the target/command in muted text,
  ellipsized. Different tools get different icons and extra inline data
  (`Read File 📄 src/…/index.ts`, `Edit File … +4/-0` with green/red counts,
  `Write File … +375`).
- **Tool row (expanded, `03`):** clicking unfolds in place — full command
  line, then output as a plain mono block with **ANSI colors preserved**
  (amber hashes, green types). No card chrome; the block just indents under
  the row.
- **Edit/File diff (`04`):** expanded Edit File renders a unified diff with
  line numbers, syntax highlighting, pale green/red line washes, header row
  with the file path and "open" / "split view" icon buttons.
- **Thinking (`05`):** collapsed: brain icon + "Thinking" + first words.
  Expanded: chevron + full reasoning text in slightly muted gray, with file
  paths underlined in mono. No background — reads as marginalia.
- **Assistant turn footer:** meta row of small chips — model name, effort
  (`high`), mode (`build`), duration, timestamp — followed by icon actions
  (copy, export, edit, pin, fork, branch). Chips are ~12 px muted text with
  tiny icons.
- **Inline results:** success outcomes render inside prose, e.g.
  "Committed in `0eaa8e7 feat(canvas): …`." with the commit in a green
  tinted mono chip. Errors/notes appear as full-width rounded **info
  banners** (pale blue, icon + text).
- **History:** "load older messages" pill at the top when paginating; a
  slim right-edge structure gutter shows tick marks to jump between turns.

### Composer (`01`, `02`, `15`)

- Rounded cream card, generous padding; placeholder teaches syntax:
  `@ for files/agents; / for commands and skills; ! for shell; # for snippets`.
- Bottom toolbar inside the card: left — attach, expand, shield icons;
  right — small **chips**: effort (`xhigh`/`high`, blue), model (logo +
  name), mode (`Build`, green dot), mic, send (arrow, becomes a red stop
  square while streaming).
- Live status line sits just above the composer: spinner + "Z.ai: GLM 5.3
  Flash is running command …".
- On mobile (`13`) it collapses to a white pill: `Use @ / ! # for helpers`,
  mic, and a round `+` attach button, with a `15 files ⌄` changed-files pill
  floating above it.

### Panel surfaces (`07`–`10`)

- **Terminal (`07`):** drawer with `>_ Terminal` header, tabs and a `+`,
  utility icons (search, clear, pop-out); full-width xterm.js content with
  a colored prompt (`[passage] v1.4.0 [mod:3 new:71 | ⎇ main]`).
- **Files (`08`):** tabbed header; empty state is a centered icon + "No
  file open" + hint; a narrow file tree column with a search box, folder
  rows (with a green `+3` dirty badge on `docs`), and color-coded
  file-type icons.
- **Changes (`09`):** header with `Changed: 10 ⌄`, `expand all`, an orange
  `🔍 review` action, and inline/split diff toggle icons. Each file row:
  status letter icon (`?`, `M`), chevron, mono path, open actions. Right
  rail badge shows the same count in orange.
- **Context (`10`):** session stats — title, model/date, a labeled context
  gauge (`182,897 / 1,048,576`, `17.4% used`), 2×2 stat cards (Messages,
  User, Assistant, Cost `$2.36`), token breakdown for the last assistant
  message (input/output/cache read/cache hit %), a stacked horizontal usage
  bar (User 0 % / Assistant 19 % / Tool Calls 80 % / Other 0 %), and a raw
  per-message table. All numbers mono, all labels muted.

### Settings (`11`, `12`)

Large centered modal (~90 vw) with left nav (grouped: OpenChamber /
Workspace / OpenCode), a search field, and plain forms: radio rows,
underlined selects, quiet text buttons, hairline section dividers. The
appearance page exposes System/Light/Dark plus **separate light and dark
theme packs** ("OpenChamber" default, reloadable) — theming is a first-class
setting, not a hardcoded palette.

### Mobile (`13`)

Single-column chat. Header becomes: hamburger (sidebar drawer) + session
title with dropdown + context ring + share. Message action icons are always
visible (no hover). Tool rows keep the exact same compact one-line format as
desktop — density is preserved, not re-flowed. Panels/terminals are not
squeezed in; surfaces swap via drawer/full-screen destinations.

## Interaction patterns worth copying

1. **One row, one line, click to expand.** The universal unit. Everything
   operational follows it, which makes the app feel predictable.
2. **State color + badge, never state color alone.** Running = amber dot
   *and* timer; dirty = green `+3` *and* count badge; changes = icon letter
   *and* path.
3. **Context always visible.** The context-usage ring in the header and the
   composer status line mean the session's health is glanceable from
   anywhere.
4. **Teaching placeholders.** The composer placeholder documents its own
   syntax.
5. **Hover-revealed actions, but never hover-only on mobile** — mobile
   shows the same actions persistently at small size.
6. **Panels beside chat, not instead of it.** Right-rail + drawer keeps the
   agent conversation as the constant spine.

## Mapping to Passage

Passage's `docs/UI.md` already specifies the right bones: workspace-first
peers, hybrid transcript, compact tool rows, semantic teal/cyan accent,
light theme. What this investigation adds is the *finish* that makes those
decisions feel non-plain:

| Area | OpenChamber evidence | Passage adaptation |
| --- | --- | --- |
| Palette warmth | Warm off-white canvas, olive-gray text, cream cards; nothing pure black/white | Keep UI.md's cool-neutral scale but ban pure `#000/#fff` on surfaces and text; soften `--foreground` toward `#16232d` (already warm) and verify muted tiers are used, not just primary |
| Chrome weight | No borders/shadows in transcript; separation by tone + spacing | Transcript, tool rows, and cards use `--surface-subtle` washes and spacing; reserve `--border` for sidebar edge, composer, panel headers |
| Row system | ~24–28 px rows, 14 px text, icon + 500-weight label + duration + muted target | Match UI.md "tool row" to this exact geometry; one shared row component for tools, thinking, files, sessions |
| Expansion | In-place expansion, no modals, ANSI output and diffs inline | Tool row expansion renders inline mono output and unified diff per UI.md "progressive disclosure" |
| Status color | Amber running, green success, blue info, badges paired with text/icons | UI.md already defines semantic roles; add amber "active" treatment for agent headers and orange count badges on surfaces |
| Context legibility | Header ring + composer status line + Context panel stats | Agent header live model/status summary (UI.md) + per-turn compact stats; consider a context-usage ring in the workspace bar |
| Composer | Cream card with chip toolbar and teaching placeholder | Composer as a soft card with model/mode/effort chips and a placeholder documenting `@`/`/` helpers |
| Panels | Right rail + single drawer with tab headers and badges | Matches UI.md inspector; add surface badges (dirty count, running terminals) |
| Themes | System/Light/Dark + swappable theme packs | Confirms UI.md's "one selected theme, semantic roles preserved" decision; theme pack plumbing is cheap |
| Mobile | Same row density, persistent action icons, drawer/full-screen surfaces | Matches UI.md mobile direction; keep tool rows one-line on mobile |

The single highest-leverage change for Passage: adopt the **uniform compact
row** (icon, label, duration, muted target, in-place expansion) and the
**quiet no-border card language** (tone-based surfaces, cream composer,
tinted inline result chips). Those two moves account for most of what makes
OpenChamber feel crafted rather than plain.
