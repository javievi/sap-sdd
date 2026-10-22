# SDD Studio 0.4.0 — named architect runtime

The portal now creates a **real Copilot SDK session**, registers the actual
repository `sdd-architect.agent.md` body as the `sdd-architect` custom agent,
and explicitly selects it with `session.rpc.agent.select({ name })`.
There is no `vscode.lm.sendRequest` generation path or single-request fallback.
The role is **analysis/spec-only**, never implementation or handoff.

## Installation and update

Run the user-approved installer from this source folder:

```powershell
.\Install.ps1
```

It selects ordinary Node if available; otherwise it uses VS Code's known
`Code.exe` location relative to the `code` CLI with `ELECTRON_RUN_AS_NODE=1`.
If that layout differs, supply `-NodePath 'C:\known\path\Code.exe'`. Node must
meet the SDK floor: 20.19+ on Node 20, or 22.12+ (not Node 21).
No ordinary `node`, `npm`, or `copilot` on PATH is required.

When `-NpmCli` is not supplied, the script downloads public **npm 10.9.2**,
checks its SHA-512 against its HTTPS registry metadata, and extracts it into
`%LOCALAPPDATA%\sdd-studio-build`. Organizations may instead supply their
approved `-NpmCli` path. No machine-wide execution-policy changes are made.

The installer creates a lockfile if absent, then uses `npm ci --omit=dev
--ignore-scripts`, checks JavaScript syntax, runs the explicit fixture suites,
verifies SDK/native-runtime files, builds a VSIX with production dependencies
and licenses, checks required archive entries, and installs **0.4.0**.
Optional dependencies must remain enabled: they contain the native runtime.
Keep the generated lockfile for reproducible subsequent installs; first-time
transitive resolution is not frozen until that file exists.

**Reload the VS Code window after installation**, then run **SDD Studio:
Open Live Portal**. `-OpenPortal` only requests opening; it cannot prove that
an already-running extension host has reloaded the new version.
Installation/test commands are user setup operations, never agent tools.

### Copilot runtime sign-in and explicit model selection

Runtime authentication is separate from ALM OAuth and VS Code chat models.
The SDK has a private `COPILOT_HOME` under this extension's global storage.
If sign-in is required:

1. Run **SDD Studio: Runtime Sign-in Instructions**.
2. Copy its command and run it from this source folder, for example:

   ```powershell
   .\Install.ps1 -SignInRuntime -RuntimeHome 'EXACT ABSOLUTE HOME SHOWN BY THE COMMAND'
   ```

3. This opens the installed CLI for **human sign-in only** in that private
   folder. Enter `/login`, complete the browser flow, then `/exit`. Do not
   submit a coding/analysis request in this setup CLI.
4. Reopen the portal. Choose a model explicitly from `client.listModels()`.
   Cancelling the picker stops opening; `auto` is not offered. The exact
   selected ID is supplied as `model` and the only `allowedModels` entry.
   No agent-definition model/reasoning override is added.

The portal does not print or copy authentication tokens. CLI entitlement and
organization policy may still block access. **Runtime ready** means startup,
authentication and model selection succeeded, not that the architect ran.

## Existing ALM OAuth and OUC integration

The direct OAuth implementation (`oauth.js`), ALM adapter (`alm.js`) and
external MCP client (`mcp.js`) are unchanged by this runtime integration.
Use **SDD Studio: Sign In to ALM** for corporate sign-in. PKCE S256, checked
random state, public-client registration, loopback callback, SecretStorage
and supported refresh behavior remain intact. Corporate consent/session
policy may still require interaction. No token is extracted from another
VS Code or CLI session.

Direct OAuth story reads do not use VS Code's per-story tool confirmation
dialog. The explicitly selected VS Code registered-tool and separately
authenticated HTTP ALM transports remain available via **Configure MCP
Connections**; there is no silent transport fallback.

Connect **OUC** in ABAP FS and start its supported external MCP endpoint at
`http://127.0.0.1:4847/mcp`. Native ABAP FS third-party invocation restrictions
are not bypassed. Optional HTTP authorization remains in SecretStorage,
outside the model/frontend. The agent cannot access MCP server discovery,
credentials or arbitrary MCP endpoints.

## Generation and verified invocation

1. Open the portal, select the `sapsdd` guidance repository, connect ALM/OUC
   and explicitly choose the runtime model.
2. Enter `ST` plus digits. Debounced ALM lookup still only fills editable
   fields; it never starts model inference, SAP source reads or spec saves.
   Candidate object names are not confirmed dependencies.
3. **Generate SDD** loads only the known guidance paths below and the exact
   current canonical spec. It starts a fresh local SDK session, not a
   previous chat or implementer conversation.
4. The named architect reads guidance/current spec, the one ALM story, and
   selected OUC objects through the host's bounded tools. Blocking questions
   use `ask_user` and VS Code UI; cancellation stops the run.
5. `write_spec` stages full canonical Markdown **in memory**. The host checks
   all fourteen template headings, stable subheadings/table column contracts,
   story/revision/date/control fields, BR/AC/plan/test ID presence and old
   revision-history rows. This is **structural template validation, not a
   semantic readiness or complete traceability proof**.
6. Before publishing/saving, the adapter requires a successful named-selection
   RPC, a matching `subagent.selected` event, required tool execution events,
   a root `assistant.message`, and non-aborted `session.idle`. Other-agent,
   deselection, errors, forbidden tools, no candidate or missing event evidence
   fail explicitly, with no fallback. The selected architect runs as the
   session's active agent; a nested `subagent.started` event is not required.
7. Review the candidate opened in VS Code. The modal save prompt approves
   **only the specification save**, not design approval or implementation.
   Decline/cancellation leaves the canonical file unchanged.
8. The browser displays escaped canonical Markdown grouped by all canonical
   sections, plus retained snapshots and runtime provenance. Copy/download
   exports the same saved Markdown, not a six-section derivative.

The generation budget is eight minutes for the SDK turn and ten minutes for
the request including questions/review. Cancel/disconnect/Stop propagates
abort; already-started external read calls may finish if their provider
does not support cancellation. Cancellation after the atomic save has
committed cannot undo a saved spec; inspect the path after a late disconnect.

## Least-privilege tool boundary

SDK `mode: "empty"` and source-qualified `availableTools` are used. Ambient
configuration discovery, repository hooks, host Git operations, memory,
session-store retrieval, skill/plugin/agent directory discovery, remote
sessions and experimental features are disabled. The runtime working
directory is private extension storage, not the repository. All other
permission requests are rejected and a pre-tool hook denies unknown tools.

The exact model-facing tools are:

| Tool | Enforced host boundary |
|---|---|
| `read_file` | Exact in-memory known-file snapshots listed below; no directory or arbitrary path access |
| `alm_story_detail` | Current `ST<digits>` only, using the existing selected ALM client/OAuth; capped at 40,000 characters with an explicit truncation flag |
| `abapfs_search_objects` | Exact selected program/class names on OUC only; no wildcard discovery |
| `abapfs_get_object_source` | Confirmed selected objects, active version, OUC only; 350 lines per call |
| `abapfs_analyze_object_relations` | Confirmed selected objects, OUC only, used relationships, at most 30 |
| `write_spec` | Only `specs/<current-ST-id>.md`; validates and stages, cannot write disk itself |
| `ask_user` | Blocking question through host VS Code UI |

SAP evidence is capped at 120,000 characters, with 120 tool calls per run.
Includes/callers/dependencies not actually read remain unverified. The
connected-system status tool remains host-side, not agent-accessible.
No SAP/ALM writes, SQL, activation, tests, report execution, implementer
handoff, delegation, terminal, native search, unrestricted FS or generic
network tool is exposed. The SDK/runtime itself necessarily maintains its
own local session/auth state; that is not model-controlled repository access.

Required known guidance:

- `AGENTS.md`
- `.github/agents/sdd-architect.agent.md`
- `.github/skills/sdd-spec/SKILL.md`
- `.github/skills/sdd-spec/assets/abap-feature-template.md`
- `.github/copilot-instructions.md`
- `.github/instructions/sdd-spec.instructions.md`
- `.github/instructions/abap-team-standards.instructions.md`

The actual agent body, full skill/template and applicable rules are loaded
into the registered agent prompt, and the agent must read their exact
snapshots plus the complete existing spec before staging. Guidance SHA-256
hashes accompany invocation provenance. No `.github` definition is changed.
If this known-file policy inventory changes, update it explicitly; the
runtime deliberately does not search for additional customization files.

## Canonical persistence and history protection

Canonical names are restricted to uppercase `ST` and 1–20 digits. No traversal
or other destination is accepted. Known-file reads reject linked paths,
directories and files over 1 MB. An invalid existing revision/history blocks
saving rather than replacing the document with a new initial spec.

For a revision the current sections are revised in place; old history rows
must survive and the next `Rnnn` row must be appended. `Implemented revision`
cannot advance. Design approval is Not obtained; development status is Not
started/Blocked. The entire previous normative spec is retained in a fenced
in-file snapshot after `<!-- sdd-portal-history:v1 -->`, including old
validation evidence. Existing snapshots are carried forward once, so growth
is linear, not recursively duplicated. New candidate Markdown is capped at
500 KB; future runs reject existing canonical files over 1 MB explicitly.

The host rechecks the original file before and immediately before commit,
rejects symlink/junction targets, and uses a unique host-only `.pending`
transaction file beside the target for atomic rename (or exclusive link
creation for a new spec). The transaction path is never an agent tool input.
This is optimistic conflict detection, not an OS-enforced lock against every
external editor; do not edit the same spec during the final save. No backup
tree, alternative story spec, Git stage/commit/push or source-file write is
created. Pending transaction files are removed in normal error/cancel paths;
a process crash can leave one for manual inspection.

The HTTP bridge remains loopback-only, single-user, origin/Host-checked,
random-token protected and without CORS. Do not deploy it as a multi-user
service. Model/runtime providers may retain requests under their policies.

## Verified SDK/runtime API source

Pinned packages: **`@github/copilot-sdk` 1.0.25** and human sign-in CLI
**`@github/copilot` 1.0.102**. The SDK's published manifest declares runtime
**1.0.102**, delivered in platform-specific optional SDK packages.
Startup checks the installed SDK manifest matches this pair and verifies the
running runtime's `client.getStatus().version` is exactly 1.0.102.

Official source checked for this implementation:

- [Custom agents, named selection and lifecycle events](https://github.com/github/copilot-sdk/blob/v1.0.25/docs/features/custom-agents.md)
- [Session/client configuration and tool handler contracts](https://github.com/github/copilot-sdk/blob/v1.0.25/nodejs/src/types.ts)
- [AgentSelectRequest/Result and AgentInfo](https://github.com/github/copilot-sdk/blob/v1.0.25/nodejs/src/generated/rpc.ts)
- [sendAndWait, onEvent and session lifecycle](https://github.com/github/copilot-sdk/blob/v1.0.25/nodejs/src/session.ts)
- [Runtime resolution and platform artifacts](https://github.com/github/copilot-sdk/blob/v1.0.25/nodejs/src/runtimeArtifacts.ts)
- [Bundled CLI setup/authentication](https://github.com/github/copilot-sdk/blob/v1.0.25/docs/setup/bundled-cli.md)

The package manifests and published declarations were also checked against
the versioned published npm artifacts. A newer SDK is not assumed compatible.

## Tests versus live validation

`Install.ps1` runs `bridge.test.js`, `extension.test.js`, `mcp.test.js`,
`alm.test.js`, `oauth.test.js`, and the new `runtime.test.js`. The latter uses
**explicit fake sessions/events, not the SDK or a live agent**. It exercises
the actual runtime adapter's named-selection/event gates, tool boundaries,
cancellation, actual-template structure, history retention and stale-file
protection. HTTP bridge tests inject explicitly named runtime/persistence
fixtures; they do not prove an actual agent ran. Legacy six-section serializer
tests in `bridge.test.js` do not define the generation output contract.

An authenticated live check requires user sign-in, an explicitly selected
entitled model, a real ST story and accessible OUC objects:

1. Install, reload, sign in, open, select the model and load the real story.
2. Generate; inspect blocking questions and all fourteen candidate sections.
3. Approve saving. Confirm the output channel reports **Named-agent invocation
   verified**, a real session ID, SDK/runtime pair and canonical SHA-256.
4. Confirm the exact canonical file and downloaded Markdown agree. For an
   existing spec, confirm prior history and full prior evidence remain.
5. Repeat with declined save/cancellation to confirm no new revision is saved.

**No authenticated live success or test execution is implied by this source
update.** Runtime/event fixture success, SDK import, native binary presence,
VSIX creation and extension installation are separate checks. Report each
actually executed result independently.
