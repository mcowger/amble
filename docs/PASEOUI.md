# Building a Custom UI for Paseo

A practical reference for writing your own client UI against the Paseo daemon. Everything here points at the code in the `paseo` repo (checked out at `/home/matt.cowger/workspace/paseo`); read the cited files for the details. Line numbers are as of the current checkout.

**Bottom line:** the daemon is headless by design. The built-in UI (`packages/app`) is a separate static web app that the daemon merely serves; all UI data and control flows over a documented, versioned WebSocket protocol. You can write your own UI two ways:

- **Path A (recommended):** reuse `@getpaseo/client` (`packages/client`) — a framework-free TypeScript client that already implements the handshake, auth, RPC correlation, reconnects, and terminal binary framing. You write only the UI.
- **Path B:** implement the wire protocol yourself against `ws://host:6767/ws`. Fully possible — the protocol is documented and stable — but you own framing, correlation, reconnect, and compatibility handling.

---

## 1. What you're replacing (and what you're not)

The repo is an npm workspace. The layers that matter:

| Package | Role | Your relationship to it |
|---|---|---|
| `packages/server` | The daemon. Headless: agent lifecycle, WebSocket API, MCP server, static file serving. | Keep. This is your backend. |
| `packages/protocol` | Zod wire schemas + binary frame codecs. | Consume types from it (Path A) or implement against it (Path B). |
| `packages/client` | `@getpaseo/client` — transport, handshake, RPC, events. | Reuse as-is (Path A). |
| `packages/app` | The built-in UI (Expo/React). | Replace. Nothing in the daemon depends on it. |
| `packages/relay` | E2E-encrypted relay for remote access. | Optional; only if you need remote connections. |

The daemon serves the built-in UI as static files from a `distDir` via `createWebUiMiddleware()` (`packages/server/src/server/web-ui.ts:149`), mounted in `bootstrap.ts:509-518`. The UI is not compiled into the daemon; it's a directory of files. The daemon's own docs describe the boundary: `docs/architecture.md:222-308` (WebSocket protocol) and `docs/protocol-compatibility.md` (stability contract).

---

## 2. Path A: reuse `@getpaseo/client`

Package: `@getpaseo/client` (`packages/client/package.json`). ESM, framework-free, no React dependency. Public entry: `packages/client/src/index.ts`.

### 2.1 Getting a client

Two factories in `packages/client/src/index.ts`:

- `createPaseoClient(config)` — `index.ts:415`. Builds a low-level `DaemonClient`, generates a `clientId` if you don't supply one, and **forces `clientType: "cli"`**. Returns a `PaseoClient` that mixes the low-level client with the high-level API.
- `createPaseoApi(daemonClient)` — `index.ts:430`. Wraps an existing `DaemonClient` in the high-level projects/workspaces/agents/providers/config API without owning connection lifecycle.

Config shape: `PaseoClientConfig` (`index.ts:58-79`). The underlying `DaemonClientConfig` is at `packages/client/src/daemon-client.ts:309-335`:

- `url` — required, e.g. `ws://127.0.0.1:6767/ws`
- `clientId` — required; stable per install. The daemon keys session resume on principal + clientId.
- `clientType` — `"mobile" | "browser" | "cli" | "mcp" | "hub"` (defaults to `"cli"` via the factory)
- `password` — daemon password; becomes `Authorization: Bearer <password>` and the `paseo.bearer.<password>` WebSocket subprotocol
- `authHeader` — alternative to `password` for pre-built headers
- `appVersion`, `capabilities` — advertised in the hello
- `reconnect` — `{ enabled, baseDelayMs, maxDelayMs }`; on by default, 1500ms base / 30s max (`daemon-client.ts:915-926`)
- `e2ee` — `{ enabled, daemonPublicKeyB64 }` for relay connections
- `transportFactory` / `webSocketFactory` — plug in your own transport (useful for Electron, Node, or tests)
- `logger`, `connectTimeoutMs` (default 15s), `trace`

### 2.2 Connecting

- `connect(): Promise<void>` — `daemon-client.ts:1165`. Idempotent; resolves after the hello handshake completes and `server_info` is received. The startup sequence (headers → subprotocol → transport → hello → session) is at `daemon-client.ts:1200-1327`; the hello construction is `daemon-client.ts:5604-5638`.
- `close(): Promise<void>` — `daemon-client.ts:1359`. Disables reconnect, closes with code 1000, rejects pending RPCs.
- `ensureConnected()` — `daemon-client.ts:1391`.
- Connection state: `getConnectionState()`, `subscribeConnectionStatus(listener)` (invoked immediately with current state), `isConnected`, `isConnecting`, `lastError` — `daemon-client.ts:1407-1429`.
- After connect, read the server info with `getLastServerInfoMessage()` (used by the app at `packages/app/src/contexts/session-context.tsx:360`) — this is where `features` and `permissions` live. **Gate every optional feature on `server_info.features`.**

### 2.3 Events (the live model)

The client is not an EventEmitter; it's callback subscriptions that return unsubscribe functions.

- `subscribe(handler)` — `daemon-client.ts:1439`. Receives normalized `DaemonEvent` values (union defined at `daemon-client.ts:258-303`): `agent_update`, `workspace_update`, `project.update`, `workspace_setup_progress`, `agent_stream`, `status`, `agent_deleted`, `agent_permission_request`, `agent_permission_resolved`, `providers_snapshot_update`, `error`.
- `on(type, handler)` — `daemon-client.ts:1451-1482`. Typed subscription to any protocol message type: `agent_stream`, `agent_update`, `fetch_agent_timeline_response`, `agent.timeline.replacement`, `agent.provider_subagents.update`, `checkout_status_update`, `workspace_setup_progress`, `status`, `agent_permission_request`, `agent_permission_resolved`, `audio_output`, `activity_log`, `transcription_result`, `voice_input_state`, `terminal_attention_required`, and more.
- `subscribeRawMessages(handler)` — `daemon-client.ts:1444`. Every parsed outbound session message, unfiltered.
- `onAgentAttentionRequired(handler)` — `daemon-client.ts:1484`. Handles both the dedicated message and legacy `agent_stream` attention events.

The app's own wiring shows the minimal event set a UI needs: `packages/app/src/contexts/session-context.tsx:538-762` subscribes to `agent_stream`, `fetch_agent_timeline_response`, `agent.timeline.replacement`, `checkout_status_update`, `workspace_setup_progress`, `status`, `agent_permission_request/resolved`, `audio_output`, `activity_log`, `transcription_result`, `voice_input_state`, `terminal_attention_required`.

### 2.4 API surface by domain

All on `DaemonClient` (`packages/client/src/daemon-client.ts`) unless noted. Line numbers are the method definitions.

**Agents**

| Method | Lines | Notes |
|---|---|---|
| `fetchAgents(options)` | 2032 | Active agent records |
| `fetchAgentHistory(options)` | 2061 | Archived/history agents |
| `fetchAgent(agentId)` | 2393 | Single snapshot |
| `createAgent(options)` | 2485 | Create/load agent on a workspace |
| `resumeAgent(agentId)` | 2749 | Resume archived/closed agent |
| `importAgent(input)` | 2780 | Import a provider session |
| `deleteAgent(agentId)` | 2538 | Permanent |
| `archiveAgent(agentId)` | 2561 | Soft delete, global |
| `detachAgent(agentId)` | 2585 | Remove parent/child link |
| `updateAgent(agentId, patch)` | 2597 | Name/labels |
| `refreshAgent(agentId)` | 2822 | Reconcile with provider |
| `sendAgentMessage(agentId, text, options)` | 3040 | Send a prompt (alias `sendMessage` at 3076) |
| `cancelAgent(agentId)` | 3113 | Interrupt the turn |
| `rewindAgent(agentId, options)` | 3080 | Rewind/fork context |
| `setAgentMode / setAgentModel / setAgentFeature / setAgentThinkingOption` | 3139-3258 | Provider settings |
| `applyAgentConfig(agentId, config)` | 3260 | |
| `respondToPermission(agentId, requestId, response)` | 4862 | Approve/deny permission requests |
| `waitForFinish(agentId, timeout)` | 5213 | Block until turn ends |
| `waitForAgentUpsert(agentId, timeout)` | 5108 | Block until agent record exists |
| `clearAgentAttention(agentId)` | 1808 | |
| `listCommands(options)` | 4836 | Slash commands |

**Timeline**

| Method | Lines | Notes |
|---|---|---|
| `fetchAgentTimeline(agentId, options)` | 2846 | Authoritative pages; tail/forward/backward |
| `setAgentTimelineSubscription(agentIds)` | 2971 | Selective live delivery (feature `selectiveAgentTimeline`) |
| `listAgentTimelinePrompts(agentId)` | 2885 | Prompt anchors for outline/history |
| `listProviderSubagents(agentId)` | 2912 | Provider-native child sessions |
| `fetchProviderSubagentTimeline(...)` | 2939 | |
| `buildAgentForkContext(agentId, options)` | 3000 | |

**Workspaces & projects**

| Method | Lines |
|---|---|
| `fetchWorkspaces(options)` | 2115 |
| `listProjects(options)` | 2217 |
| `openProject(cwd)` | 2237 |
| `addProject(cwd)` | 2248 |
| `createProjectDirectory(cwd, name)` | 2259 |
| `createWorkspace(options)` | 4188 |
| `archiveWorkspace(workspaceId)` | 2365 |
| `renameProject / setProjectIcon / removeProject` | 2630-2677 |
| `setWorkspaceTitle / setWorkspacePinned` | 2679-2717 |
| `inspectWorkspaceRecovery / restoreWorkspace` | 2719-2747 |
| `fetchWorkspaceSetupStatus(workspaceId)` | 2379 |
| `searchGithubRepositories / cloneGithubProject` | 2273-2304 |
| Workspace labels | 2142-2215 |
| Workspace scripts (`startWorkspaceScript`, `listWorkspaceScripts`, `stopWorkspaceScript`) | 2306-2363 |

**Terminal** (requires the raw `DaemonClient`, not the high-level API)

| Method | Lines |
|---|---|
| `subscribeTerminals({cwd, workspaceId})` | 5241 | Terminal-list subscription (no requestId; fire-and-forget) |
| `unsubscribeTerminals(...)` | 5256 |
| `listTerminals(cwd)` | 5270 |
| `createTerminal(cwd, shell)` | 5290 |
| `renameTerminal(input)` | 5322 |
| `subscribeTerminal(terminalId, options)` | 5334 | Attach; returns slot + initial snapshot |
| `unsubscribeTerminal(terminalId)` | 5362 |
| `sendTerminalInput(terminalId, message)` | 5370 | Binary frame, fire-and-forget |
| `killTerminal(terminalId)` | 5383 |
| `captureTerminal(terminalId)` | 5417 |
| `onTerminalStreamEvent(handler)` | 5549 | Decoded output/snapshot/restore events |
| `waitForTerminalStreamEvent(options)` | 5553 |

**Checkout / git / forge** — `getCheckoutStatus` (3629), `getCheckoutDiff` (3699), `subscribeCheckoutDiff` (3726), `checkoutCommit` (3779), `checkoutMerge` (3796), `checkoutPull` (3831), `checkoutPush` (3842), `checkoutRefresh` (3853), `listCheckoutCommits` (3864), `getCommitFileDiff` (3883), `checkoutPrCreate` (3906), `checkoutPrMerge` (3924), `checkoutPrStatus` (4026), `pullRequestTimeline` (4037), `checkoutSwitchBranch` (4054), `renameBranch` (4070), stash ops (4082-4124), worktrees (4126-4186), `validateBranch` (4210), `branchSuggestions` (4225), `searchForge` (4241), `searchGitHub` (4259), `getDirectorySuggestions` (4276).

**Files** — `listDirectory` (4330), `readFile` (4345), `subscribeFile` (4380), `writeFile` (4412), `createFileEntry` (4426), `renameFileEntry` (4437), `duplicateFileEntry` (4447), `deleteFileEntry` (4456), `checkoutDiscardChanges` (4465), `uploadFile` (4474), `requestDownloadToken` (4530) — binary file reads ride the same binary-frame channel as terminals, tracked by requestId.

**Schedules** — `scheduleCreate` (5439), `scheduleList` (5456), `scheduleInspect` (5466), `scheduleLogs` (5477), `schedulePause` (5488), `scheduleResume` (5499), `scheduleDelete` (5510), `scheduleRunOnce` (5521), `scheduleUpdate` (5532).

**Providers & daemon config** — `listProviderModels` (4574), `listProviderModes` (4592), `listProviderFeatures` (4608), `listAvailableProviders` (4623), `getProvidersSnapshot` (4635), `refreshProvidersSnapshot` (4795), `getProviderDiagnostic` (4812), `listProviderUsage` (4827), `getDaemonConfig` (4652), `patchDaemonConfig` (4753), `reloadDaemonConfig` (4675).

**Daemon admin & hub** — `restartServer` (3291), `shutdownServer` (3318), `updateDaemon` (3345), `getDaemonStatus` (4664), `getDaemonPairingOffer` (4731), `collectDiagnostics` (4744), hub connect/status/disconnect/permissions (4683-4729), `registerPushToken` (1876), `sendHeartbeat` (1857).

**Voice** (if you want it) — `setVoiceMode` (3373), `sendVoiceAudioChunk` (3404), dictation stream methods (3408-3615), `audioPlayed` (3621).

**Plugins & skills** — `getPluginCatalog` (4875), `listPlugins` (4885), `getPluginLogs` (4895), skill management (4905-4958), plugin install/enable/disable/remove (4960-5045), `invokePluginRpc` (5056).

### 2.5 High-level API vs raw client

`createPaseoClient` returns a `PaseoClient` (`index.ts:408-413`) that spreads the high-level `PaseoApi` (`index.ts:400-406`) over the raw client. The high-level API covers projects/workspaces/agents/providers/config with handle objects (`PaseoAgentHandle` at `index.ts:267-307` — `agent.send(prompt)`, `agent.run(prompt)`, `agent.timeline.subscribe(...)`, etc.). **Terminal, checkout, files, schedules, and daemon admin are only on the raw `DaemonClient`.** The app uses the raw client for everything (`packages/app/src/runtime/host-runtime.ts:1265-1283` shows the minimal runtime contract: `connect()`, `close()`, `subscribeConnectionStatus()`, `lastError`).

### 2.6 Reconnect and liveness (handled for you)

- Reconnect: exponential backoff 1500ms → 30s, on by default (`daemon-client.ts:5930-6065`). On reconnect the client resubscribes checkout-diff, terminal-directory, and file subscriptions automatically.
- Heartbeat: ping every 10s, timeout 15s, reconnect after 2 consecutive liveness failures (`daemon-client.ts:915-926`).
- RPC timeout: 60s default. Errors surface as `DaemonRpcError` (carries `requestId`, `requestType`, `code`) or `DaemonProtocolError` for invalid payloads.
- `ping()` / `measureLatency()` — `daemon-client.ts:1893-2030`.

### 2.7 Transports

`DaemonTransport` interface: `packages/client/src/daemon-client-transport-types.ts:1-8` — `send(data: string | Uint8Array | ArrayBuffer)`, `close(code, reason)`, `onMessage/onOpen/onClose/onError` returning unsubscribers. That's the whole contract; you can implement it over anything (WebSocket, Electron `webview`, Node `ws`).

- `createWebSocketTransportFactory(factory)` — `packages/client/src/daemon-client-websocket-transport.ts:42-77`. Adapts any `WebSocketLike` (DOM-style, Node-style, or property-style event APIs) into a `DaemonTransport`.
- `defaultWebSocketFactory` (22) uses the global `WebSocket` (browser: no custom headers); `nativeWebSocketFactory` (35) passes headers for React Native/Node.
- Relay E2EE: `createRelayE2eeTransportFactory` / `createEncryptedTransport` — `packages/client/src/daemon-client-relay-e2ee-transport.ts:18-168`. Wraps a base transport, does the E2EE channel handshake, encrypts/decrypts payloads; only needed for relay URLs.

---

## 3. Path B: the raw protocol

If you implement the wire protocol yourself, this is the contract. All schemas live in `packages/protocol/src/messages.ts`; the server side is `packages/server/src/server/websocket-server.ts`.

### 3.1 Endpoint and upgrade

- Connect to `ws://host:6767/ws` (`websocket-server.ts:798-821`; default listen `127.0.0.1:6767`, configurable via `PASEO_LISTEN` / `listen` — `bootstrap.ts:383-385`, `docs/docker.md:14-17`).
- The server validates before accepting the upgrade (`verifyWsUpgrade`, `websocket-server.ts:863-895`):
  - Server must be in the `"accepting"` lifecycle state, else HTTP 503.
  - HTTP `Host` must pass the hostname allowlist, else HTTP 403.
  - `Origin` must be absent, `*`, in the configured allowlist, or same-origin, else HTTP 403.
- Subprotocol negotiation (`selectWebSocketProtocol`, `websocket-server.ts:2861-2877`): with no password configured, any offered protocol (or none) is accepted. With a password, the client **must** offer `paseo.bearer.<token>`; negotiation fails otherwise.
- Post-upgrade auth (`attachAuthenticatedSocket`, `websocket-server.ts:897-919`): token validated against the bcrypt password; failure closes with code 4401, reason `"Password required"` or `"Incorrect password"`. Token parsing: `extractWsBearerProtocol` / `extractWsBearerToken` (`packages/server/src/server/auth.ts:63-88`).

### 3.2 Hello handshake

After the socket opens, send one top-level JSON message:

```json
{ "type": "hello", "clientId": "...", "clientType": "browser", "protocolVersion": 1, "appVersion": "...", "capabilities": {} }
```

Schema: `WSHelloMessageSchema` (`messages.ts:6965-6987`). Rules:

- `clientType` is one of `"mobile" | "browser" | "cli" | "mcp" | "hub"`.
- `protocolVersion` must be **exactly 1** — the server constant is `WS_PROTOCOL_VERSION = 1` (`websocket-server.ts:498`) and any other value closes with `"Incompatible protocol version"` (`handleHello`, `websocket-server.ts:1487-1573`). There is no range negotiation.
- `clientId` must be non-empty; it keys session resume.
- `capabilities` is a passthrough object; known keys include `voice`, `pushNotifications`, `browserHost`, and several feature flags (see `messages.ts:6965-6987`).
- You must send hello promptly: the server enforces a hello timeout (`attachSocket`, `websocket-server.ts:1240-1299`) and closes with `"Hello timeout"` otherwise. Before hello, **only** the hello message is accepted; anything else closes the socket (`websocket-server.ts:2125-2153`).

The server replies with the session envelope:

```json
{ "type": "session", "message": { "type": "status", "payload": { "status": "server_info", "serverId": "...", "hostname": "...", "version": "...", "permissions": [...], "desktopManaged": false, "capabilities": {...}, "features": {...} } } }
```

Construction: `buildServerInfoStatusPayload` (`websocket-server.ts:1619-1649`) and `createServerInfoMessage` (`websocket-server.ts:1764-1771`). Schema: `ServerInfoStatusPayloadSchema` (`messages.ts:3344-3507`). **`features` is the capability gate** — the known flag list is annotated at `messages.ts:3355-3500` (e.g. `selectiveAgentTimeline`, `terminal-restore-modes`, `rewind`, `checkoutRefresh`, `workspaceMultiplicity`, `agentProfiles`, ...). Check a flag before using the feature; never fall back to a different code path.

### 3.3 Session semantics

- Sessions are keyed by authenticated principal + `clientId`. A reconnecting client with the same identity resumes the logical session (`resumeSession`, `websocket-server.ts:1575-1616`); capabilities are refreshed from the new hello.
- Multiple physical sockets can attach to one logical session (multiple tabs, direct + relay simultaneously) — `docs/architecture.md:247`.
- The server broadcasts JSON/binary to all attached sockets of the session; some messages are sent only to the source socket (`createSessionConnection`, `websocket-server.ts:1301-1383`).

### 3.4 RPC envelope and correlation

Every RPC is a nested session message:

```json
{ "type": "session", "message": { "type": "<rpc>_request", "requestId": "...", ...params } }
```

- Parameters are at the top level of the message, not under a `payload` key.
- Most requests carry `requestId`; a few subscriptions are fire-and-forget with no `requestId` (e.g. `subscribe_terminals_request`).
- Responses: `{ "type": "session", "message": { "type": "<rpc>_response", "payload": { "requestId": "...", ...result } } }`.
- Errors: `rpc_error` with `payload: { requestId, requestType?, error, code? }` (`RpcErrorMessageSchema`, `messages.ts:3528-3536`).
- The inbound/outbound unions: `WSInboundMessageSchema` (`messages.ts:7005-7011`) and `WSOutboundMessageSchema` (`messages.ts:7013-7016`); nested unions `SessionInboundMessageSchema` (`messages.ts:2996-3190`) and `SessionOutboundMessageSchema` (`messages.ts:6300-6509`).
- Server dispatch: `handleRawMessage` (`websocket-server.ts:2155-2246`) → `dispatchSessionMessage` (`websocket-server.ts:2248-2295`) → `Session.handleMessage` (`packages/server/src/server/session.ts`), which routes to per-domain dispatchers (see §7).
- Naming: new RPCs use dotted namespaces with `.request`/`.response` suffixes (`docs/rpc-namespacing.md`); legacy flat names (`fetch_agents_request`) remain accepted during migration (`docs/rpc-namespacing.md:74-86`). Don't add new flat names; do handle both when reading.

### 3.5 Liveness

- Application-level ping: client sends top-level `{ "type": "ping" }`; server replies top-level `{ "type": "pong" }` (`websocket-server.ts:2202-2206`). This is separate from RFC6455 control frames and from the session-level `ping`/`pong` RPC pair (`PingMessageSchema` `messages.ts:2738-2742`, `PongMessageSchema` `messages.ts:3518-3526` — the latter is for latency measurement with `clientSentAt`/`serverReceivedAt`/`serverSentAt`).
- The ping claims the application socket lease; later inbound traffic renews it; the server closes sockets whose lease expires (`docs/architecture.md:245`). The built-in client pings every 10s.
- `{ "type": "recording_state", "isRecording": bool }` is accepted and ignored (`websocket-server.ts:2208-2210`).

### 3.6 Binary frames

Binary frames carry terminal streams and file transfers. Terminal frame format (`packages/protocol/src/binary-frames/terminal.ts`):

```
byte 0: opcode     byte 1: stream slot (0-255)     bytes 2..N: payload
```

Opcodes (`terminal.ts:11-15`): `0x01` Output, `0x02` Input, `0x03` Resize, `0x04` Snapshot, `0x05` Restore. Codecs: `encodeTerminalStreamFrame` (`terminal.ts:65`), `decodeTerminalStreamFrame` (`terminal.ts:78`). A demuxer that tries terminal frames first, then file-transfer frames: `packages/protocol/src/binary-frames/demux.ts:23`.

- Input payload: UTF-8 terminal input.
- Resize payload: JSON `{ rows, cols, intent: "claim" | "update" }` — `claim` transfers size ownership to you; only the owner sends subsequent `update`s (`terminal-session-controller.ts:252-258`).
- Snapshot payload: JSON of `TerminalStateSchema` (`messages.ts:5918-5932`) — `rows`, `cols`, `grid: TerminalCell[][]`, `scrollback`, `cursor`, `title`, optional `gridWrapped`/`scrollbackWrapped` (capability-gated reflowable snapshots). Cell schema: `messages.ts:5894-5906` (char + SGR attributes).

---

## 4. Auth, CORS, and network constraints

### 4.1 Password auth

- Password is a bcrypt hash (cost 12) in daemon config (`packages/server/src/server/auth.ts:5-9`); set via `PASEO_PASSWORD` (`public-docs/web-ui.md:81-89`).
- HTTP: `Authorization: Bearer <token>` (`extractHttpBearerToken`, `auth.ts:52-61`; middleware `createRequireBearerMiddleware`, `auth.ts:90-120`).
- WebSocket: subprotocol `paseo.bearer.<token>` (see §3.1).
- With no password configured, everything is open (loopback default).

### 4.2 What's protected vs public

Middleware order in `bootstrap.ts:694-770` (this order is the contract):

1. Service-proxy middleware (694)
2. Host-header allowlist (699-710) — 403 `"Invalid Host header"` otherwise
3. CORS (712-746)
4. `POST /api/terminal-activity` (748-753) — loopback-only + capability token
5. **Web UI static files (755-759) — served BEFORE auth, intentionally unauthenticated** (`public-docs/web-ui.md:99`)
6. Bearer auth (761-765)
7. JSON body parser (767)
8. `/public/*` static dir (769-770) — protected
9. API routes (772-841)
10. `/ws` upgrade (843-849)
11. `/mcp/agents` (1406, 1520-1523)

HTTP routes: `GET /api/health` (772-775, exempt), `GET /api/status` (777-785, protected; returns server_info + listen target), `GET /api/files/download` (839-841, exempt but requires a single-use download token issued via `requestDownloadToken`), `POST /api/terminal-activity` (748-753). Everything else — the entire UI data plane — is WebSocket RPC, not HTTP.

### 4.3 CORS and origins for a separately hosted UI

- CORS (`bootstrap.ts:712-746`): allowed origins come from `config.corsAllowedOrigins` plus fixed `paseo://app` and `http://<host>:<port>`, `http://localhost:<port>`, `http://127.0.0.1:<port>`. Allowed headers: `Content-Type`, `Authorization`. **A custom UI on another origin must be added to `cors.allowedOrigins`** (or the daemon must allow `*`).
- WebSocket origin check is separate from CORS (`verifyWsUpgrade`, `websocket-server.ts:886-895`): same-origin, allowlisted, `*`, or no Origin header. Browsers always send Origin on WebSocket, so a browser UI on a foreign origin needs the allowlist.
- Hostname allowlist: `config.hostnames ?? config.allowedHosts` (`bootstrap.ts:660`), configured via `--hostnames` / `PASEO_HOSTNAMES` (`public-docs/web-ui.md:91-97`). Applies to both HTTP and WebSocket.
- Reverse proxies must forward WebSocket upgrades, preserve `Host`, and pass `X-Forwarded-Proto` (`public-docs/web-ui.md:101-111`).

### 4.4 Permissions

The daemon has a semantic permission model (`docs/permissions.md`): principal → grants, credential proves principal, session is equal-or-narrower authority. Permission names: `daemon.read`, `daemon.manage`, `tunnel.manage`, `access.manage`, `workspace.read`, `workspace.write`, `workspace.manage`, `automation.manage`, `hub.execute` (`permissions.md:18-30`). Practical mapping for a UI: read-only views need `daemon.read` + `workspace.read`; sending prompts, terminal input, file edits, git ops need `workspace.write`; creating/archiving workspaces needs `workspace.manage`; schedules need `automation.manage` (`permissions.md:32`).

For a direct password connection, the session gets the daemon's full authority. Pairing invitations (`daemon.get_pairing_offer.request` / `getDaemonPairingOffer`) create scoped principals — relevant if you want to ship a "pair this device" flow. The `server_info.permissions` array tells you what the current session may do.

---

## 5. The event model (what the server pushes)

Outbound message schemas: `messages.ts:6300-6509`. The app's consumption patterns are the best guide: `packages/app/src/contexts/session-context.tsx:538-762`.

**Agents & timeline**

| Push | Meaning |
|---|---|
| `agent_update` | Agent record/state changed (emitted from `session.ts:6799` and lifecycle ops) |
| `agent_stream` | Live timeline events; payload event types defined at `messages.ts:699-787`: `thread_started`, `turn_started`, `turn_completed`, `turn_failed`, `turn_canceled`, `timeline`, `permission_requested`, `permission_resolved`, `attention_required` |
| `agent_attention_required` | Attention under selective timeline delivery (`session.ts:1163-1199`) |
| `agent_permission_request` / `agent_permission_resolved` | Permission flow |
| `agent_deleted` / `agent_archived` | Lifecycle (`session.ts:2763-2790`) |
| `agent.timeline.replacement` | Authoritative timeline replacement/catch-up |
| `agent.provider_subagents.update` | Provider child state |

**Workspaces & projects**: `workspace_update` (`session.ts:1273-1279`), `project.update` (`session.ts:1232-1249`), `workspace.label.update`, `workspace.setup.progress`, `script.status.update`.

**Terminals**: `terminals_changed` (`terminal-session-controller.ts:332`), `terminal_stream_exit` (`terminal-session-controller.ts:1096`), `terminal_attention_required` (`websocket-server.ts:2650`), plus binary output/snapshot/restore frames.

**Checkout**: `checkout_diff_update`, `checkout_status_update`.

**Misc**: `status` (restart/shutdown/plugin/error statuses), `activity_log`, `assistant_chunk` (legacy), `audio_output`, `transcription_result`, `voice_input_state`, `dictation_stream_ack`, `daemon.update.progress`, session-level `pong`.

---

## 6. RPC catalog (server-side reference)

All handlers live in `packages/server/src/server/session.ts` unless noted; `Session.dispatch` routes by message type. Use this to find the authoritative behavior for any RPC.

**Agent lifecycle** — dispatcher `session.ts:2298-2340`: `fetch_agents_request`, `fetch_agent_history_request`, `fetch_recent_provider_sessions_request`, `fetch_agent_request`, `delete_agent_request` (impl 2732), `archive_agent_request` (impl 2778), `close_items_request`, `update_agent_request`, `send_agent_message_request`, `wait_for_finish_request`, `create_agent_request`, `resume_agent_request`, `import_agent_request`, `refresh_agent_request`, `cancel_agent_request`, `agent_permission_response`, `clear_agent_attention`, `agent.rewind.request` (2227-2237), `agent.detach.request` (2239-2246). Note: **there is no `stop_agent_request`** — stopping is `cancel_agent_request`; runtime closure happens via archive/close/teardown.

**Timeline** — `session.ts:2248-2282`: `fetch_agent_timeline_request`, `agent.timeline.list_prompts.request`, `agent.provider_subagents.list.request`, `agent.provider_subagents.timeline.get.request`, `agent.timeline.set_subscription.request` (inline, 2261-2276), `agent.fork_context.request`.

**Terminal** — `packages/server/src/terminal/terminal-session-controller.ts:194-226`: `subscribe_terminals_request`, `unsubscribe_terminals_request`, `list_terminals_request`, `create_terminal_request`, `subscribe_terminal_request`, `unsubscribe_terminal_request`, `terminal_input` (legacy text path), `kill_terminal_request`, `capture_terminal_request`, `terminal.rename.request`. Resize and modern input are binary frames, not RPCs.

**Workspace & project** — `session.ts:2461-2507`: `fetch_workspaces_request`, `project.list.request`, `paseo_worktree_list_request`, `paseo_worktree_archive_request`, `create_paseo_worktree_request`, `workspace_setup_status_request`, `open_project_request`, `project.add.request`, `project.create_directory.request`, `workspace.github.search_repositories.request`, `project.github.clone.request`, `archive_workspace_request`, `project.remove.request`, `workspace.create.request`, `workspace.clear_attention.request`, `workspace.title.set.request`, `workspace.pin.set.request`, legacy editor RPCs (2478-2480). Labels: `session.ts:2509-2524`. Recovery: `session.ts:2562-2570`.

**Checkout / git / forge** — `session.ts:2395-2457`: `checkout_status_request`, `checkout.commits.list.request`, `checkout.commits.file_diff.request`, `validate_branch_request`, `branch_suggestions_request`, `directory_suggestions_request`, `subscribe_checkout_diff_request`, `unsubscribe_checkout_diff_request`, `checkout_switch_branch_request`, `checkout.rename_branch.request`, `checkout_commit_request`, `checkout_merge_request`, `checkout_merge_from_base_request`, `checkout_pull_request`, `checkout_push_request`, `checkout.refresh.request`, `checkout.discard_changes.request`, `checkout_pr_create_request`, `checkout_pr_merge_request`, `checkout.forge.set_auto_merge.request`, `checkout.github.set_auto_merge.request`, `checkout.forge.get_check_details.request`, `checkout.github.get_check_details.request`, `checkout_pr_status_request`, `pull_request_timeline_request`, `forge.search.request`, `github_search_request`, `stash_save_request`, `stash_pop_request`, `stash_list_request`.

**Settings & daemon** — `session.ts:2343-2392`: `set_agent_mode_request`, `set_agent_model_request`, `set_agent_feature_request`, `set_agent_thinking_request`, `agent.config.apply.request`, `get_daemon_config_request`, `set_daemon_config_request`, `daemon.get_status.request`, `daemon.get_pairing_offer.request`, `daemon.config.reload.request`, `diagnostics.request`, `daemon.update.request`, `read_project_config_request`, `write_project_config_request`, `hub.management.daemon.*` (connect/get_status/disconnect/permissions.update).

**Schedules** — `session.ts:2611-2634`: `schedule/create`, `schedule/list`, `schedule/inspect`, `schedule/logs`, `schedule/pause`, `schedule/resume`, `schedule/delete`, `schedule/run-once`, `schedule/update`. Schemas: `packages/protocol/src/schedule/rpc-schemas.ts`, `packages/protocol/src/schedule/types.ts`.

**Workspace scripts** — `session.ts:2596-2608`: `start_workspace_script_request`, `workspace.script.list.request`, `workspace.script.start.request`, `workspace.script.stop.request`.

**Hub execution** — `session.ts:2285-2295`: `hub.execution.agent.create.request`, `hub.execution.agent.validate.request`, `hub.execution.control.request`.

---

## 7. Terminal streaming (end to end)

1. `subscribe_terminals_request` (or `list_terminals_request`) to see terminals for a cwd/workspace; `terminals_changed` keeps the list live.
2. `create_terminal_request` to spawn a PTY (`TerminalInfo` schema `messages.ts:5885-5892`).
3. `subscribe_terminal_request` to attach. Response (`messages.ts:5969-5984`) gives you a **slot (0-255)**; the server then sends binary frames tagged with that slot.
4. Decode binary frames per §3.6. Output arrives as `0x01` frames; on attach you may receive a `0x04` snapshot (full `TerminalState`) or `0x05` restore.
5. Send input as `0x02` frames, resize as `0x03` with `intent: "claim"` first.
6. `unsubscribe_terminal_request` to detach; `terminal_stream_exit` fires when the PTY exits.

Performance invariants you must respect (`docs/terminal-performance.md`): output is coalesced (leading-plus-trailing throttle, first chunk immediate, ≤1 IPC per 5ms per terminal on the server); non-output messages flush pending output first; snapshot fallback only when >256KiB output since snapshot **and** >4MiB transport buffered; client writes are not serialized frame-by-frame (batch them); terminal size has one daemon-owned claimant. Hard limits: 8MiB outbound high-water mark per physical socket — a slow socket is terminated without killing the session (`docs/architecture.md:247`).

---

## 8. Timeline sync (the hard part, done right)

Two paths (`docs/timeline-sync.md:3-9`):

1. **Live:** `agent_stream` events, applied in sequence order.
2. **Authoritative:** `fetch_agent_timeline_request` with pagination.

Rules:

- On open/resume, fetch one bounded latest-tail page.
- Older history: backward pagination. Forward catch-up: `direction: "after"`.
- Responses carry `seqStart`, `seqEnd`, `sourceSeqRanges`, `collapsed`, `hasOlder`, `hasNewer`.
- Gap recovery: repeatedly request `after` pages until `hasNewer: false`.
- Middle gap / epoch change / rewind: replace stale canonical history atomically (`agent.timeline.replacement`).
- Selective delivery: if `server_info.features.selectiveAgentTimeline`, send `agent.timeline.set_subscription.request` with the visible agent IDs; legacy daemons stream all timelines globally (`session.ts:1148-1210`).
- The app's reference implementation: `packages/app/src/contexts/session-context.tsx:452-625` and `packages/app/src/stores/session-store.ts:290-315`.

Agent states to render (`docs/agent-lifecycle.md:5-14`): `initializing`, `idle`, `running`, `error`, `closed` (no live runtime, resumable — **not** archived), `archived` (`archivedAt` set, gone from active lists), `deleted`. Archive is global and cascades to managed children (`parentAgentId`); provider-native subagents are separate presentation rows.

---

## 9. Serving your UI

**Option 1 — separate host (supported, clean):** serve your app anywhere, connect to the daemon's `/ws` + HTTP API. Requirements: add your origin to `cors.allowedOrigins`, add your hostname to the daemon's hostname allowlist if you use a DNS name, send bearer auth. See §4.3.

**Option 2 — replace the bundled UI in place:** the daemon's web UI middleware serves whatever is in `webUi.distDir` (`bootstrap.ts:423-426`, mounted at 509-518). Point that at your build output and the daemon serves your UI at `http://host:6767/` with SPA fallback (`resolveTargetFile`, `web-ui.ts:74-99`), Brotli/gzip negotiation, and cache headers. **Caveat:** `webUi.distDir` is an internal config field, not a documented user-facing setting — the documented controls are only `--web-ui` / `PASEO_WEB_UI_ENABLED` / `config.json` (`public-docs/web-ui.md:21-45`). You'd be wiring internal config, which can change. The middleware excludes `/api/`, `/mcp/`, `/public/` from SPA fallback (`web-ui.ts:6-16`) and serves before auth, so your UI loads unauthenticated and the login happens against `/ws` — same model as the built-in UI.

**Same-origin convenience:** the daemon injects `window.__PASEO_INITIAL_DAEMON_CONNECTION__ = { listen, useTls, label }` into served `index.html` (`web-ui.ts:253-270`) so a same-origin UI can auto-derive its WebSocket URL. The built-in UI uses this (`public-docs/web-ui.md:55-59`).

**Remote access:** the relay (`packages/relay`) lets clients reach the daemon without exposing its port. Daemon and client connect to relay URLs like `/ws?serverId=...&role=server|client&connectionId=...&v=2` and establish an E2E-encrypted channel (`packages/relay/src/live-relay.e2e.test.ts:100-133`). After the relay, you still speak the same Paseo session protocol — the client library handles this via `e2ee` config (§2.1). Not needed for a local-first UI.

---

## 10. Compatibility contract (what you can rely on)

From `docs/protocol-compatibility.md`:

- **Protocol contract (always):** an old client parses messages from a new daemon, and a new daemon parses messages from an old client. New fields are optional; never narrow, remove, or require. Wire schemas stay pure (no transforms).
- **Feature contract (per-feature):** gate once on `server_info.features.*`, then use the feature or tell the user to update the host. No fallback paths, no defensive branches.
- **Versioning:** `protocolVersion` is a single integer, currently 1, exact-match (`websocket-server.ts:498`). Bumping it is a breaking change the daemon authors control; you don't negotiate ranges.
- **COMPAT shims:** back-compat code is tagged `// COMPAT(name): added in vX, remove after <date>` and gets deleted on schedule — don't build against shims.
- **Naming:** dotted namespaces with `.request`/`.response` are the future; flat names still work. New RPCs you see in a new daemon may not exist in an old one — that's what feature gating is for.

---

## 11. Gotchas

- **Hello timeout:** send hello immediately after socket open; only hello is accepted before it.
- **Exact protocol version:** anything other than 1 is rejected outright.
- **Lease:** keep pinging (10s cadence like the built-in client) or the server closes your socket.
- **8MiB outbound limit per socket:** a slow consumer gets terminated, not the session. Don't buffer terminal output client-side without draining.
- **`clientType` matters for behavior:** `createPaseoClient` forces `"cli"`; the app uses `"browser"`. Some server behavior (e.g. plugin client IDs, browser automation) keys off it.
- **Session resume:** same `clientId` + same credential resumes the session; multiple sockets share it. Generate a stable clientId per install, not per page load, or you'll fragment sessions.
- **Static UI is unauthenticated:** never put secrets in served files; auth happens on `/ws` and protected HTTP.
- **`/api/status` is protected, `/api/health` is not** — use health for liveness probes only.
- **MCP (`/mcp/agents`) is not a UI surface:** it's for agent tooling with a per-run capability token (`auth.ts:135-162`); it lacks the live event stream. Don't build a UI on it.
- **Terminal size ownership:** only one client owns size (`intent: "claim"`); others get updates.
- **`recording_state` is accepted and ignored** — don't rely on it.
- **Feature flags change behavior:** e.g. `selectiveAgentTimeline` changes whether you must call `setAgentTimelineSubscription`; `terminal-restore-modes` changes attach semantics. Read `server_info.features` before wiring anything.

---

## 12. Minimal v1 checklist

A first working UI needs:

1. `createPaseoClient({ url, clientId, password? })` → `connect()` → read `getLastServerInfoMessage()` for `features`/`permissions`.
2. `fetchWorkspaces()` + `fetchAgents()` → render lists.
3. `subscribe()` (or `on("agent_update")` / `on("workspace_update")`) → keep lists live.
4. `fetchAgentTimeline(agentId)` tail + `on("agent_stream")` → render a conversation; `sendAgentMessage()` to prompt.
5. `setAgentTimelineSubscription([...])` if the feature flag is set.
6. `subscribeTerminal()` + `onTerminalStreamEvent()` + `sendTerminalInput()` → terminal pane (or skip terminals in v1).
7. `respondToPermission()` for permission prompts; `cancelAgent()` for stop.
8. `subscribeConnectionStatus()` for a connection indicator; let the client's built-in reconnect do its job.

---

## 13. File map (quick reference)

| What | Where |
|---|---|
| Wire schemas (all messages) | `packages/protocol/src/messages.ts` |
| Terminal binary frame codec | `packages/protocol/src/binary-frames/terminal.ts` |
| File-transfer binary frames | `packages/protocol/src/binary-frames/file-transfer.ts` |
| Client entry / factories | `packages/client/src/index.ts` |
| Low-level client (connect, RPC, events, reconnect) | `packages/client/src/daemon-client.ts` |
| Transport interface | `packages/client/src/daemon-client-transport-types.ts` |
| WebSocket transport adapter | `packages/client/src/daemon-client-websocket-transport.ts` |
| Relay E2EE transport | `packages/client/src/daemon-client-relay-e2ee-transport.ts` |
| Terminal stream router (client) | `packages/client/src/terminal-stream-router.ts` |
| WebSocket server (upgrade, hello, dispatch) | `packages/server/src/server/websocket-server.ts` |
| Session RPC dispatch | `packages/server/src/server/session.ts` |
| Terminal session controller | `packages/server/src/terminal/terminal-session-controller.ts` |
| HTTP bootstrap, routes, CORS, middleware order | `packages/server/src/server/bootstrap.ts` |
| Web UI static middleware | `packages/server/src/server/web-ui.ts` |
| Auth (bearer, subprotocol, exemptions) | `packages/server/src/server/auth.ts` |
| Relay package | `packages/relay/src/index.ts` |
| Protocol docs | `docs/architecture.md`, `docs/rpc-namespacing.md`, `docs/protocol-compatibility.md`, `docs/timeline-sync.md`, `docs/terminal-performance.md`, `docs/permissions.md`, `docs/agent-lifecycle.md` |
| Web UI serving docs | `public-docs/web-ui.md`, `docs/docker.md` |
| App reference usage | `packages/app/src/contexts/session-context.tsx`, `packages/app/src/runtime/host-runtime.ts` |
