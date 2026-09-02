# Amble Design System & Aesthetic Specification

This document codifies the design principles, visual tokens, typography, iconography, and component patterns of Amble to ensure design continuity and aesthetic fidelity.

---

## 1. Design Philosophy: "Warm Paper & Precision Tooling"

Amble's aesthetic is inspired by OpenChamber: a refined, distraction-free environment that combines the tactile warmth of high-grade editorial paper with the crisp precision of developer tooling.

### Core Principles
1. **Warmth over Clinical Gray**: Backgrounds use warm ivory/paper tones (`#fdfcfa` light, `#181816` dark) rather than stark `#ffffff` or cold blue-grays (`#f1f5f9`).
2. **Hairline Delimitation**: Sections and panels are separated by 1px subtle hairline borders (`#e8e4dc` / `#33332d`) with generous white space, avoiding heavy shadows or thick borders.
3. **Semantic Color Discipline**: Every color has an operational meaning. Never use hardcoded arbitrary colors in components.
4. **Information Density with Breathability**: Compact vertical rhythm (`py-1.5` to `py-2.5`) with comfortable horizontal padding (`px-3` to `px-4`), ensuring dense information remains readable.
5. **Micro-animations for Life**: Subtle spinners on active turns, smooth transitions (`150ms-200ms`), and instant feedback on user actions.

---

## 2. Color Palette & Semantic Tokens

All UI styling must use semantic Tailwind utility classes mapped to CSS variables in `styles/globals.css`.

| Element | Light Theme (Warm Paper) | Dark Theme (Warm Night) | Semantic Tailwind Class | CSS Variable |
|---|---|---|---|---|
| **Canvas Background** | `#fdfcfa` (`rgb(253, 252, 250)`) | `#181816` (`rgb(24, 24, 22)`) | `bg-background` | `--background` |
| **Sidebar / Rail** | `#f7f4ed` (`rgb(247, 244, 237)`) | `#1e1e1b` (`rgb(30, 30, 27)`) | `bg-sidebar` | `--sidebar` |
| **Card / Composer Surface** | `#f5f1ea` (`rgb(245, 241, 234)`) | `#242420` (`rgb(36, 36, 32)`) | `bg-card` | `--card` |
| **Muted Fill / Badges** | `#eee9df` (`rgb(238, 233, 223)`) | `#2c2c27` (`rgb(44, 44, 39)`) | `bg-muted` | `--muted` |
| **Borders & Dividers** | `#e8e4dc` (`rgb(232, 228, 220)`) | `#33332d` (`rgb(51, 51, 45)`) | `border-border` | `--border` |
| **Primary Text** | `#393a34` (`rgb(57, 58, 52)`) | `#e5e5df` (`rgb(229, 229, 223)`) | `text-foreground` | `--foreground` |
| **Secondary / Meta Text** | `#82847a` (`rgb(130, 132, 122)`) | `#8a8a82` (`rgb(138, 138, 130)`) | `text-muted-foreground` | `--muted-foreground` |
| **Primary Button / Focus** | `#1c1c1a` | `#f4f4f0` | `bg-primary text-primary-foreground` | `--primary` |

### Accent & Operational Palette
- **Amber (Active / Running / Thinking)**:
  - Text: `text-amber-600 dark:text-amber-400`
  - Wash: `bg-amber-500/10 border-amber-500/20`
  - Spinner / Dot: `text-amber-500 animate-spin`, `bg-amber-500 animate-pulse`
- **Emerald (Success / Git Added / Ready)**:
  - Text: `text-emerald-600 dark:text-emerald-400`
  - Wash: `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`
  - Status Dot: `bg-emerald-500`
- **Rose / Red (Error / Git Deleted / Interrupt)**:
  - Text: `text-rose-600 dark:text-rose-400` / `text-destructive`
  - Wash: `bg-rose-500/10 text-rose-700 dark:text-rose-300`
- **Blue (Reasoning / Info / Effort Chips)**:
  - Text: `text-blue-600 dark:text-blue-400`
  - Wash: `bg-blue-500/10 text-blue-700 dark:text-blue-300`
- **Purple (Plan Mode / Search / Exploration)**:
  - Text: `text-purple-600 dark:text-purple-400`
  - Wash: `bg-purple-500/10 text-purple-700 dark:text-purple-300`

---

## 3. Typography & Font Hierarchy

### Font Families
- **UI / Body Text**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  - Clean, modern, highly legible at small sizes (11px-14px).
- **Code / Monospace**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`
  - Used for file paths, tool names, terminal streams, token counters, diffs, and code blocks.

### Scale & Hierarchy
- **Header Titles**: `text-base font-semibold text-foreground` (16px / 600 weight)
- **Section Headers / Group Labels**: `text-[10px] font-semibold tracking-wider text-muted-foreground uppercase` (10px / 600 weight)
- **Body / Chat Messages**: `text-sm leading-relaxed text-foreground` (14px / 400 weight / line-height 1.625)
- **Tool Summaries / Badges / Buttons**: `text-xs font-medium` (12px / 500 weight)
- **Timestamps / Code Chips / Micro Badges**: `text-[11px] font-mono text-muted-foreground` (11px / 400-500 weight)

---

## 4. Iconography Standards

We use `lucide-react` with strict semantic consistency:

### Icon Sizes
- **Micro / Inline**: `w-3 h-3` (12px) — Badges, breadcrumb separators, inline mode indicators.
- **Standard Controls / Menu**: `w-3.5 h-3.5` (14px) — Buttons, tool headers, status indicators.
- **Top Rail / Action Buttons**: `w-4 h-4` (16px) — Settings, theme toggle, add session, drawer icons.
- **Empty States / Major Banners**: `w-6 h-6` to `w-8 h-8` (24px-32px) — Welcome banners, placeholders.

### Semantic Icon Mapping
| Concept / Action | Icon | Color Intent |
|---|---|---|
| **Agent / Assistant** | `<Sparkles />` | Amber (`text-amber-500`) |
| **Reasoning / Thinking** | `<Brain />` / `<Sparkles />` | Blue (`text-blue-500`) |
| **Bash / Shell / Exec** | `<Terminal />` | Amber (`text-amber-500`) |
| **File Edit / Write** | `<FileCode />` | Blue (`text-blue-500`) |
| **File Read / Inspect** | `<FileText />` | Emerald (`text-emerald-500`) |
| **Search / Grep / Glob** | `<Search />` | Purple (`text-purple-500`) |
| **Web Fetch / Browse** | `<Globe />` | Cyan (`text-cyan-500`) |
| **Git / Changes / Diffs** | `<GitCommit />` / `<GitBranch />` | Primary (`text-primary`) |
| **Workspaces / Projects** | `<Layers />` / `<Folder />` | Primary (`text-primary`) |
| **Tasks / Planned Todos** | `<ListTodo />` | Primary (`text-primary`) |
| **Success Status** | `<CheckCircle2 />` | Emerald (`text-emerald-500`) |
| **Failure / Error Status**| `<AlertCircle />` | Rose (`text-destructive`) |
| **Running / In Progress** | `<Loader2 className="animate-spin" />` | Amber (`text-amber-500`) |

---

## 5. Component Geometry & Corner Radii

Amble utilizes a tiered radius hierarchy to establish visual structure:
- **`rounded-2xl` (16px)**: Major outer containers — Prompt Composer box, Welcome hero card.
- **`rounded-xl` (12px)**: Interactive cards — User message cards, Settings modal, Popover menus, Todo task cards.
- **`rounded-lg` (8px)**: Tool execution items, Diff viewers, Dropdown items, Mode selector pill group.
- **`rounded-md` (6px)**: Small action buttons, Tab buttons, Code block badges.
- **`rounded-full` (9999px)**: Status badges (`Ready`, `Running`), Model pill tags, Effort level chips, Avatars.

---

## 6. Layout Structure & Responsive Breakpoints

1. **Desktop (>= 768px)**:
   - Left Sidebar: Fixed width `w-64` (256px) showing date-grouped session list.
   - Main Chat Canvas: Centered max-width container `max-w-4xl w-full mx-auto` for optimal reading line length.
   - Bottom Drawer: Collapsible `h-64 sm:h-72` pane containing live terminal & git diff inspector.
2. **Mobile (< 768px)**:
   - Sidebar collapses into a full-height overlay drawer toggled via the hamburger icon (`Menu`).
   - Top Rail collapses breadcrumbs gracefully with truncated labels.
   - Drawer tabs and buttons shrink to compact icon/text layouts.

---

## 7. Future Theme Pack Expansion

Because all components are built strictly with semantic CSS classes:
- Custom theme packs (e.g. `OLED Dark`, `Nord`, `Solarized`, `Tokyo Night`, `Monokai`) can be introduced simply by defining a corresponding class (e.g. `.theme-nord`) in `styles/globals.css` with overridden CSS variable values.
- Zero JSX or component markup changes are required to add new themes.
