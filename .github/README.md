# ABAP Copilot Agent Workspace

This repository provides a focused SAP ABAP specification-driven development
(SDD) workflow. Its local Copilot configuration consists only of the agents,
skills, instructions, and prompts listed below.

## Configuration inventory

| Artifact | Included | Responsibility |
|---|---|---|
| Agents | `sdd-architect` | Analyze requirements and maintain the canonical story specification |
| Agents | `sdd-implementer` | Execute an approved, ready specification and record validation |
| Agents | `abap-agent-architect` | Maintain this repository's Copilot customizations |
| Skills | `sdd-spec` | Specification intake, readiness, revision, and execution procedure |
| Skills | `abap-flowerbox-revision` | Non-CDS report header and revision metadata |
| Skills | `abap-change-tracking` | Search Str-based source-change markers |
| Instructions | `abap-team-standards.instructions.md` | ABAP naming and syntax conventions |
| Instructions | `sdd-spec.instructions.md` | Canonical spec and spec-first revision rules |
| Prompts | `sdd-architect`, `sdd-revise`, `sdd-implement` | Optional SDD task entry points |
| Prompts | `sap-acceptance-criteria` | Draft or refine acceptance criteria through `sdd-architect` |

See [docs/README.md](docs/README.md) for the compact architecture and routing
guide. The root [AGENTS.md](../AGENTS.md) defines the workspace and ABAP FS
safety boundary.

## SDD workflow

- Start with `@sdd-architect` for requirements analysis, design, or a spec
  revision. The canonical document is `specs/<story-id>.md`.
- Use `@sdd-implementer` to execute a ready, approved specification. It owns
  the implementation and validation work in that approved scope.
- `@abap-agent-architect` is only for repository agent, skill, instruction, or
  prompt maintenance; it does not own SAP application changes.
- Prompts are optional shortcuts. The selected agent and its skill own the
  workflow and its safeguards.

## Source-change safeguards

Read [copilot-instructions.md](copilot-instructions.md) and applicable
path-scoped instructions before changing source. For existing non-CDS ABAP,
the flower-box and change-tracking skills govern revision metadata and source
markers. Do not invent revision details, transport choices, or validation
results.

The repository does not include dedicated GFGR, OUC-to-ODC, HANA-to-CDS,
acceptance-criteria, QA, data-analysis, or general ABAP specialist agents or
skills. Do not route work to those removed local artifacts. Use only the
included SDD roles and available tools permitted by `AGENTS.md`.
