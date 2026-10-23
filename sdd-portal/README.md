# SDD Studio 0.4.1 — named architect runtime

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

No npm registry is needed. `install-runtime.js` downloads the official GitHub
Copilot CLI **1.0.102 Windows x64 portable release**, checks its SHA-256 against
GitHub release metadata, and uses the matched public SDK bundled in the CLI's
self-extracted package. It does not reuse VS Code's older internal SDK.
The payload and license are packaged under `vendor/copilot`; provenance records
the official release URL, asset digest, SDK digest, and executable digest.
Windows system certificate trust is used; TLS verification is not disabled.
No machine-wide execution-policy changes are made.

The installer checks JavaScript syntax, runs explicit fixture suites, builds
a VSIX with the matched SDK/runtime and license, checks required archive
entries, and installs **0.4.1**. Only Windows x64 is currently supported.

**Reload the VS Code window after installation**, then run **SDD Studio:
Open Live Portal**. `-OpenPortal` only requests opening; it cannot prove that
an already-running extension host has reloaded the new version.
Installation/test commands are user setup operations, never agent tools.

### Copilot runtime sign-in and explicit model selection

Runtime authentication is separate from ALM OAuth and VS Code chat models.
The SDK has a private `COPILOT_HOME` under this extension's global storage.
Version 0.4.1 fixes a login mismatch: SDK empty mode disabled access to the
Windows credential store used by the setup CLI. The runtime now uses CLI-mode
authentication in the same private home, with session restrictions explicitly
enforced. Existing successful sign-ins do not need to be repeated.
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

The scoped `read_file` tool explicitly overrides the runtime's built-in tool
of the same name. Its exact-path, in-memory restrictions remain unchanged.
Without this declaration, runtime 1.0.102 rejects tool initialization before
generation and the portal reports a generic named-architect execution failure.
Reinstall using `.\Install.ps1` and reload VS Code to apply this fix.

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
5. `stage_spec_chunk` buffers ordered Markdown chunks **in memory**, at most
   12,000 characters per call. `write_spec` with empty `markdown` assembles and
   validates them, avoiding model output-limit truncation of a full document.
   Chunks can be replaced by index to correct a rejected draft. The host checks
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

If the architect ends without staging, the host asks the same named session
once to complete chunked staging within the original eight-minute budget.
There is no different-model, different-agent or unvalidated-output fallback.
Output-limit truncation is reported explicitly. A summary of an existing Ready
specification is not a successful generation.

Validation failures are returned to the architect with the exact reason and
shown in portal progress. It is instructed to correct and resubmit the full
draft within the existing turn budget (up to three staging attempts). Existing
BR/AC/plan/test IDs must remain, marked superseded with a reason when obsolete.
An unresolved failure reports the validation reason; invalid drafts are never
saved.

The portal architect suggests code changes like Ask mode: object/routine
locations, current versus proposed behavior, prose or pseudocode, and proposed
validation belong in the design and implementation plan. It does not implement
ABAP changes, activate objects, run tests or hand off to an implementer.

## Least-privilege tool boundary

SDK `mode: "copilot-cli"` permits the runtime to use the Windows credential
store without copying tokens into the extension. Source-qualified
`availableTools` and deny-wins exclusions restrict every session. The former
empty-mode session defaults are explicitly retained, including in-memory MCP
OAuth storage, no built-in skills, no scheduler, no coauthor operations, and
removal of the ambient environment prompt. Installed plugins are cleared by
session RPC before agent selection; failure prevents invocation. Ambient
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
| `stage_spec_chunk` | Exact story path, sequential/replacement indexes 0-63, at most 12,000 characters per call and 500,000 assembled bytes; memory only |
| `write_spec` | Only `specs/<current-ST-id>.md`; validates a supplied document or buffered chunks, cannot write disk itself |
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

Pinned vendor release: **Copilot CLI 1.0.102 and its bundled public SDK**.
The source/API contract was checked against SDK 1.0.25, which declares the same
runtime version, and against the portable release's SDK declarations.
Provenance identifies the installed SDK as `CLI-bundled-1.0.102`, not as an
npm-installed package. Startup verifies its recorded SDK digest and the running
runtime's `client.getStatus().version` is exactly 1.0.102.

Official source checked for this implementation:

- [Custom agents, named selection and lifecycle events](https://github.com/github/copilot-sdk/blob/v1.0.25/docs/features/custom-agents.md)
- [Session/client configuration and tool handler contracts](https://github.com/github/copilot-sdk/blob/v1.0.25/nodejs/src/types.ts)
- [AgentSelectRequest/Result and AgentInfo](https://github.com/github/copilot-sdk/blob/v1.0.25/nodejs/src/generated/rpc.ts)
- [sendAndWait, onEvent and session lifecycle](https://github.com/github/copilot-sdk/blob/v1.0.25/nodejs/src/session.ts)
- [Runtime resolution and platform artifacts](https://github.com/github/copilot-sdk/blob/v1.0.25/nodejs/src/runtimeArtifacts.ts)
- [Bundled CLI setup/authentication](https://github.com/github/copilot-sdk/blob/v1.0.25/docs/setup/bundled-cli.md)

The matched release is bundled rather than resolving newer dependencies from
npm. A newer SDK/runtime is not assumed compatible.

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
