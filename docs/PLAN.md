# Implementation Plan: Custom OpenChamber-Style UI for Paseo

A comprehensive plan to build a modern, high-density, warm-aesthetic web interface for the Paseo daemon, matching the OpenChamber design language and verified via `agent-browser`.

---

## 1. Executive Summary & Goals

- **Objective**: Build a clean, responsive web client for the Paseo daemon that replaces the default Expo/React UI with an OpenChamber-inspired interface.
- **Visual Personality**: Warm paper palette (`#fdfcfa` canvas, `#f5f1ea` cream cards, `#393a34` olive text), zero harsh borders/drop-shadows, universal 26px compact tool rows with progressive in-place expansion, floating composer card, right-rail panel drawer, and a header context-usage ring.
- **Stack**: Native Bun runtime (`Bun.serve()` with HTML imports and `bun --hot src/index.ts` watch mode — no Vite, Fastify, Hono, or Express), React 19, TypeScript, Tailwind CSS v4, shadcn/ui components, Lucide Icons, `@xterm/xterm` for binary terminal streaming.
- **Backend**: Direct WebSocket RPC & binary streaming against Paseo daemon (`ws://127.0.0.1:6767/ws` locally, or remote via configurable URL/bearer token).
- **Quality Assurance**: Continuous headless visual and functional inspection using `agent-browser` against the reference screenshots in `docs/screenshots/` and live OpenChamber at `http://localhost:3000`.

---

## 2. Architecture & Tech Stack

```
                     ┌──────────────────────────────────────────┐
                     │          Browser UI (React 19)           │
                     │  - Warm paper theme / Tailwind CSS       │
                     │  - Sidebar / Transcript / Rail / Drawer  │
                     │  - Xterm.js terminal integration         │
                     └────────────────────┬─────────────────────┘
                                          │
                        WebSocket (JSON RPC + Binary Frames)
                                          │
                     ┌────────────────────▼─────────────────────┐
                     │       Paseo Transport Client Core        │
                     │  - Hello handshake & session resume      │
                     │  - RPC correlation (request/response)    │
                     │  - Binary frame demuxer (terminals/files)│
                     │  - Liveness heartbeat (10s ping)         │
                     └────────────────────┬─────────────────────┘
                                          │
                     ┌────────────────────▼─────────────────────┐
                     │        Paseo Daemon (0.0.0.0:6767)       │
                     │  - Agent lifecycle & Timeline streaming  │
                     │  - Workspaces, Projects, Git & Checkout  │
                     │  - Terminal PTY manager, File system     │
                     └──────────────────────────────────────────┘
```

### Key Dependencies & Component System
- **Runtime, Server & Bundler**: Native Bun only (`Bun.serve()` with HTML imports in `src/index.ts`, `bun --hot src/index.ts` for watch/HMR; no Vite, Hono, Fastify, or Express).
- **UI Framework**: React 19 + TypeScript
- **Component Primitives (shadcn/ui)**:
  - Accessible Radix UI primitives configured via `components.json` (`style: "new-york"`, CSS variables).
  - Core components: `Button`, `Card`, `Dialog`, `DropdownMenu`, `Popover`, `Select`, `Input`, `Textarea`, `Tooltip`, `Badge`, `Separator`, `ScrollArea`, `Tabs`, `Progress`, `Collapsible`, `Sheet`.
  - Custom styled tokens: Overriding shadcn default neutrals with OpenChamber's warm paper palette (`#fdfcfa` background, `#f5f1ea` card/muted, `#393a34` foreground).
- **Styling**: Tailwind CSS v4 + `clsx` + `tailwind-merge` + `tw-animate-css`
- **Icons**: `lucide-react` (16px stroke icons)
- **Terminal**: `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links`
- **Code & Diff Rendering**: Lightweight syntax highlighter + diff parser

---

## 3. Design Tokens & Visual Specs

| Element | Light (Warm Paper Default) | Dark Theme | Semantic Variable |
|---|---|---|---|
| **Canvas Background** | `#fdfcfa` (`rgb(253, 252, 250)`) | `#181816` | `--background` (`bg-background`) |
| **Surface / Sidebar / Drawer** | `#f7f4ed` (`rgb(247, 244, 237)`) | `#1e1e1b` | `--sidebar` (`bg-sidebar`) |
| **Card / Composer Surface** | `#f5f1ea` (`rgb(245, 241, 234)`) | `#242420` | `--card` (`bg-card`) |
| **Hairline Border** | `#e8e4dc` | `#33332d` | `--border` (`border-border`) |
| **Primary Text** | `#393a34` (`rgb(57, 58, 52)`) | `#e5e5df` | `--foreground` (`text-foreground`) |
| **Muted Meta Text** | `#82847a` | `#8a8a82` | `--muted-foreground` (`text-muted-foreground`) |
| **Amber Accent (Active / Running)** | `#d97706` | `#f59e0b` | `--accent-amber` |
| **Green Accent (Success / Added)** | `#15803d` / wash `#edf7ee` | `#22c55e` / wash `#142918` | `--accent-green` |
| **Red Accent (Error / Removed)** | `#dc2626` / wash `#fdf2f2` | `#ef4444` / wash `#2b1414` | `--destructive` (`text-destructive`) |
| **Blue Accent (Info / Effort Chip)**| `#2563eb` / wash `#eff6ff` | `#3b82f6` / wash `#172554` | `--accent-blue` |
| **Orange Accent (Badges)** | `#ea580c` | `#f97316` | `--accent-orange` |

### 3.1 Tailwind Semantic Class Discipline & Future Theming
To ensure full themeability (System, Light Warm Paper, Dark, and future theme packs) with zero regressions:
1. **No Hardcoded Hex/RGB Colors in Components**: Never use arbitrary color utilities like `bg-[#fdfcfa]` or `text-[#393a34]` in TSX/JSX.
2. **Semantic Class Hierarchy**:
   - Canvas/Panels: `bg-background text-foreground`
   - Sidebar/Rail/Drawer: `bg-sidebar text-sidebar-foreground border-sidebar-border`
   - Cards/Composer: `bg-card text-card-foreground border-border`
   - Muted Labels/Metadata: `text-muted-foreground bg-muted`
   - Interactive Elements: `hover:bg-accent hover:text-accent-foreground`
   - Borders: `border-border` (hairlines only, no thick boxes)
3. **Status & Diff Semantics**: Use theme-aware semantic color variables (e.g. `text-amber-600 dark:text-amber-400`, `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`, `bg-rose-500/10 text-rose-600 dark:text-rose-400`) or custom CSS properties so themes can swap accent palettes cleanly.
4. **Theme Pack Switching**: Managed at the document root via CSS classes (`.dark`, `.theme-warm`, etc.) overriding standard CSS variables in `styles/globals.css`.

---

## 4. Paseo Protocol & API Integration

### 4.1 Connection & Session Lifecycle
1. Connect to `ws://127.0.0.1:6767/ws` (or user-defined endpoint). If a password is required, provide the subprotocol `paseo.bearer.<token>`.
2. On open, immediately send hello matching `WSHelloMessageSchema` (`messages.ts:6965-6987`):
   ```json
   {
     "type": "hello",
     "clientId": "amble-client-uuid",
     "clientType": "browser",
     "protocolVersion": 1,
     "appVersion": "0.1.0",
     "capabilities": {
       "custom_mode_icons": true,
       "reasoning_merge_enum": true,
       "terminal_reflowable_snapshot": true,
       "provider_subagents": true,
       "project_updates": true,
       "compact_provider_snapshots": true,
       "timeline_replacement_invalidation": true,
       "selective_agent_timeline": true
     }
   }
   ```
   *Note: Capability keys use snake_case (`CLIENT_CAPS`). `browser_host` is an object (`BrowserAutomationHostCapabilitySchema`), not a boolean, and should be omitted unless exposing an automation host.*
3. Receive `server_info` payload (`ServerInfoStatusPayloadSchema`); inspect `features` (`selectiveAgentTimeline`, `rewind`, `checkoutRefresh`, etc.) and `permissions`.
4. Run application ping `{ "type": "ping" }` every 10 seconds to maintain socket lease (server closes socket on lease expiration).

### 4.2 Agents & Transcript Spine
- **List Agents**: `fetch_agents_request` and `fetch_agent_history_request`.
- **Create / Cancel**: `create_agent_request` and `cancel_agent_request`.
- **Timeline Hydration**:
  - Call `fetch_agent_timeline_request` with `{ agentId, limit: 50, direction: "backward" }`.
  - Subscribe live via `agent_stream` and `agent.timeline.set_subscription.request` (if `selectiveAgentTimeline` supported).
  - Handle timeline replacement via `agent.timeline.replacement`.
- **Permissions**: Listen for `agent_permission_request`, render decision banner, send `agent_permission_response`.
- **Prompts**: Send via `send_agent_message_request`.

### 4.3 Terminal Binary Framing
- Subscribe list via `subscribe_terminals_request`.
- Create terminal: `create_terminal_request`.
- Attach terminal: `subscribe_terminal_request` (receives slot `0..255`).
- Demux binary frames:
  - `0x01` (Output): forward Uint8Array payload to `xterm.write()`.
  - `0x04` (Snapshot): render initial terminal screen state.
  - `0x05` (Restore): restore screen buffer.
- Input & Resize:
  - Send input as binary frame `[0x02, slot, ...utf8Bytes]`.
  - Send resize as binary frame `[0x03, slot, ...json({ rows, cols, intent: "claim" })]`.

### 4.4 Drawer Panels Data Binding
- **Context Panel**: Compute session stats (token gauge, cache hit %, prompt breakdown, raw message log) from timeline turns and agent metadata.
- **Changes Panel**: `getCheckoutStatus` and `subscribeCheckoutDiff` for staged/unstaged file lists, additions/deletions counts, and git commit/push actions.
- **Files Panel**: `listDirectory`, `readFile`, and `writeFile`.

---

## 5. UI Layout & Component Breakdown (shadcn Mapping)

| UI Surface | OpenChamber Element | shadcn/ui Implementation Base |
|---|---|---|
| **App Shell & Layout** | Resizable 3-pane shell, drawer, mobile sheet | `Sheet`, `Collapsible`, `Separator`, custom grid layout |
| **Sidebar Navigation** | Workspace list, session items, active badges | `Button` (ghost variants), `Badge`, `ScrollArea`, `Tooltip` |
| **Header** | Breadcrumb, context usage ring, layout toggles | `DropdownMenu`, `Progress` (circular SVG adaptation), `Button` |
| **Transcript Spine** | User message bubble, turn actions, load older | `Card` (warm cream variant), `Tooltip`, `Button` (subtle icon actions) |
| **Tool Rows (26px)** | Collapsed 1-line tool execution, in-place diff | `Collapsible`, `Badge` (diff `+N/-M` counters), `Button` |
| **Composer Card** | Pinned rounded card, model selector, mode picker | `Card`, `Textarea`, `Select` / `DropdownMenu`, `Badge`, `Button` |
| **Context Panel** | Stat cards, token gauge, raw message list | `Card`, `Progress`, `Table`, `ScrollArea` |
| **Changes & Git** | File list, diff drawer, commit/push actions | `Tabs`, `ScrollArea`, `Badge`, `Button`, `Input` |
| **Settings & Modals** | Connection settings, appearance, theme picker | `Dialog`, `Label`, `Input`, `Select`, `Tabs` |

---

## 6. Execution Steps & Milestones

### Milestone 1: Transport Core & Protocol Client
- [ ] Create `src/lib/paseo/` transport module with WebSocket connection manager, hello handshake, ping heartbeat, RPC correlation, and binary stream decoder.
- [ ] Implement typed React hooks: `usePaseoClient`, `useConnectionStatus`, `useWorkspaces`, `useAgents`, `useAgentTimeline`.
- [ ] Build connection settings dialog using shadcn `Dialog`, `Input`, `Label`, and `Button` (supporting `ws://127.0.0.1:6767/ws` default + custom host/password).

### Milestone 2: App Layout & Sidebar Navigation
- [ ] Configure shadcn CSS variables in `styles/globals.css` to map to OpenChamber's warm palette (`--background`, `--card`, `--muted`, `--accent`, `--border`).
- [ ] Build the base layout: Sidebar (`220px`), Top Header (`44px`), Right Rail (`40px`), Panel Drawer (`460px`), and Center Content.
- [ ] Implement Sidebar using shadcn `ScrollArea`, `Collapsible`, and `Tooltip`: top utility icons (`+ New Session`, `Search`, `Archive`), `chats`, `recent`, and per-workspace lists with amber active dots and live elapsed timers.
- [ ] Implement Top Header: session breadcrumbs, context percentage SVG ring (`0–100%`), panel layout controls with shadcn `Button` and `DropdownMenu`.

### Milestone 3: Transcript Spine & Universal 26px Tool Rows
- [ ] User message bubble: shadcn `Card` styled with cream tone (`#f5f1ea`), right-aligned, hover action toolbar with shadcn `Tooltip` and `Button` (revert, fork, pin, copy).
- [ ] Expandable thinking trace with brain icon and subtle marginalia styling using shadcn `Collapsible`.
- [ ] Universal tool row component (26px height, single line collapsed using shadcn `Collapsible` & `Badge`):
  - Shell command row with duration and expandable ANSI output.
  - File Read row with file path pill.
  - File Edit / Write row with `+N / -M` badges and syntax-highlighted inline diff viewer.
  - Permission request banner with inline Grant / Deny shadcn `Button` variants.
- [ ] Assistant turn footer: metadata pills (model, effort, mode, duration, timestamp) using shadcn `Badge` and action buttons.

### Milestone 4: Floating Composer & Command Palette
- [ ] Floating cream card composer pinned to the bottom of the transcript using shadcn `Card` and `Textarea`.
- [ ] Placeholder teaching syntax: `@ for files/agents; / for commands and skills; ! for shell; # for snippets`.
- [ ] Live status line above composer (spinner + running action text).
- [ ] Integrated toolbar using shadcn `Select`, `DropdownMenu`, `Badge`, and `Button`: Effort dropdown (`xhigh`, `high`, `medium`), Model selector, Mode selector (`Build`), dictation mic button, and Send / Stop button.

### Milestone 5: Right Rail Panel Drawer Surfaces
- [ ] **Context Panel**: Session gauge ring, stat cards using shadcn `Card`, token stats (Messages, User, Assistant, Cost), cache hit rate breakdown, stacked usage bar with shadcn `Progress`, raw message timeline with `ScrollArea`.
- [ ] **Changes Panel**: File changes list with status letters (`M`, `?`, `+`), orange count badge on rail using shadcn `Badge`, unified git diff viewer, commit/push actions with shadcn `Input` and `Button`.
- [ ] **Files Panel**: Workspace file tree with search input (`Input`) and dirty markers.
- [ ] **Terminal Panel**: Multi-tab PTY terminal using shadcn `Tabs` and `@xterm/xterm` bound to Paseo binary stream opcodes `0x01`–`0x05`.

### Milestone 6: Visual Verification & Polish via `agent-browser`
- [ ] Run native Bun server with watch mode (`bun --hot src/index.ts`).
- [ ] Use `agent-browser` to take snapshots and screenshots across Desktop (1280x800) and Mobile (390x844) viewports.
- [ ] Validate against `docs/screenshots/*` and compare with live OpenChamber at `http://localhost:3000`.
- [ ] Verify light and dark mode color parity and contrast across all shadcn components.

---

## 7. Verification Matrix

| Area | Reference Artifact | Automated Verification Method |
|---|---|---|
| **Home / Empty State** | `docs/screenshots/01-home-new-session.png` | `agent-browser open http://localhost:5555 && agent-browser screenshot` |
| **Session Transcript** | `docs/screenshots/02-session-transcript.png` | `agent-browser snapshot -c` & verify row classes / heights |
| **Tool Row (Shell)** | `docs/screenshots/03-tool-expanded-git.png` | Click tool row via `agent-browser click` & verify ANSI styling |
| **Diff Viewer (Edit)** | `docs/screenshots/04-edit-file-diff.png` | Expand edit tool & verify green/red line wash and line numbers |
| **Thinking Trace** | `docs/screenshots/05-reasoning-trace-expanded.png` | Toggle thinking & inspect font styling and marginalia layout |
| **Context Panel** | `docs/screenshots/10-context-panel.png` | Open Context panel & verify gauge, token stats, and bar chart |
| **Changes Panel** | `docs/screenshots/09-changes-panel.png` | Open Changes panel & verify dirty badge count and diff tree |
| **Terminal Panel** | `docs/screenshots/07-terminal-panel.png` | Open Terminal panel & verify xterm canvas / stream connection |
| **Mobile Layout** | `docs/screenshots/13-mobile-session.png` | `agent-browser set viewport 390 844 && agent-browser screenshot` |
