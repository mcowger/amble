# Amble Development Guidelines

## Visual Verification Rule (Mandatory)
Any UI change, feature implementation, styling adjustment, or component refactor **must be visually confirmed at the end of the work**.
- Do not rely solely on unit tests, type checks, or console assertions for UI validation.
- Use `agent-browser` (or headless browser capture) to open the application (`http://127.0.0.1:5173`), navigate to the modified screen/view, take a snapshot/screenshot, and visually verify that the rendered output, typography, colors, drawers, and layouts match the design expectations with zero console or runtime errors.

## Design System & Aesthetic Discipline
All UI development must adhere to the design system codified in [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md):
- **Surfaces & Palettes**: Light theme uses Warm Paper (`#fdfcfa` canvas, `#f7f4ed` sidebar, `#f5f1ea` cards). Dark theme uses Warm Night (`#181816` canvas, `#1e1e1b` sidebar, `#242420` cards).
- **Zero Hardcoded Colors**: Always use semantic Tailwind classes (`bg-background`, `text-foreground`, `bg-sidebar`, `bg-card`, `border-border`, `text-muted-foreground`, etc.). Never use arbitrary hex/rgb classes in JSX.
- **Iconography**: Standardized `lucide-react` icons (Amber `<Sparkles />` for assistant, Blue `<Brain />` for reasoning, Amber `<Terminal />` for bash, Blue `<FileCode />` for edits, Emerald `<FileText />` for reads, Purple `<Search />` for searches). Standard sizes are `w-3 h-3` (micro), `w-3.5 h-3.5` (controls), and `w-4 h-4` (action buttons).
- **Corner Radii**: Tiered hierarchy (`rounded-2xl` for composer, `rounded-xl` for cards/modals, `rounded-lg` for tool items/diffs, `rounded-md` for buttons, `rounded-full` for status/pills).
- **Typography**: System font stack for UI, crisp monospace for code/diffs/terminal/paths.

## Runtime & Architecture
- **Runtime**: Native Bun (`Bun.serve()` with HTML imports). Do not use Vite, Fastify, Hono, or Express.
- **Dev Server & Workspace Scripts**: The dev server and workspace scripts must ALWAYS be managed through Paseo so both the agent and Paseo remain in sync about server status and port allocations.
  - Start dev server: `paseo script start dev` (or `bun run dev`)
  - Stop dev server: `paseo script stop dev` (or `bun run stop`)
  - List workspace scripts & check status/ports: `paseo script ls`
  - Do not start the dev server manually or allocate ports outside of Paseo.
- **Dev Server Logs & Terminal Management**: Dev server output and terminals can be viewed and interacted with using Paseo terminal commands:
  - List terminals: `paseo terminal ls`
  - Capture logs/output: `paseo terminal capture <terminal-id | name>` (e.g. `paseo terminal capture dev`)
  - Send keys / interact: `paseo terminal send-keys <terminal-id> <keys...>`
- **WebSocket Protocol**: Connects to the local Paseo daemon at `ws://127.0.0.1:6767/ws`.
- **Paseo Client**: This tool is strictly a client of the Paseo server. No code specific to any agent (opencode, pi, claude, etc.) should be written. Everything must interact solely with the Paseo API. Consequently, there is never a need to review or interact with opencode, pi, etc. source code, nor their configuration files or databases.
- **Command Timeouts**: Always use short, explicit timeouts on terminal/bash tool commands (e.g. 5-10 seconds) to prevent command hanging.

