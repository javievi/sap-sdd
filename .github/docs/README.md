# Customization Architecture

This repository intentionally keeps a small, SDD-focused Copilot configuration.
The inventory in [../README.md](../README.md) is authoritative: descriptions
of removed roles or workflows do not define available agents or capabilities.

## Agents

| Agent | Responsibility |
|---|---|
| `sdd-architect` | Requirements analysis, technical design, canonical story specs, and spec-first revisions |
| `sdd-implementer` | Execution of a ready, approved spec and persistence of actual validation evidence |
| `abap-agent-architect` | Quality and maintenance of repository Copilot customizations |

`sdd-architect` hands approved implementation work to `sdd-implementer`.
`sdd-implementer` owns source changes and validation for that approved scope;
there is no repository-local ABAP orchestrator, GFGR agent, QA agent, data
analyst, or acceptance-criteria agent.

## Skills

| Skill | Responsibility |
|---|---|
| `sdd-spec` | Intake, evidence, readiness, implementation gates, revisions, and completion evidence |
| `abap-flowerbox-revision` | Required metadata for new non-CDS reports and existing-source revisions |
| `abap-change-tracking` | Search Str-based inline and block source-change markers |

The two non-CDS source-change skills are used together when applicable. The
spec skill links to them rather than duplicating their procedure. There are no
repository-local skills for GFGR, OUC-to-ODC transfer, HANA-to-CDS conversion,
QA, fixture lookup, or general ABAP orchestration.

## Instructions and prompts

- `abap-team-standards.instructions.md` applies to `**/*.abap`.
- `sdd-spec.instructions.md` applies to `specs/**/*.md`.
- The prompts in `../prompts/` are optional invocations of the included SDD
  agents; they do not add agents or expand the agents' responsibilities.
- `copilot-instructions.md` carries the shared connection, routing, and source
  change rules. `AGENTS.md` remains authoritative for forbidden tools and
  ABAP FS operations.

## Tool and safety boundaries

Tool-bearing agents should use explicit allowlists limited to their roles.
Customization work must use the allowed file operations in `AGENTS.md`; SAP
source/data tools are not for customization files. SDD implementation must
follow the workspace's SAP connection, transport, activation, and validation
rules. A saved but inactive ABAP change is not complete.

The local configuration does not mirror packaged ABAP FS agents or claim
their availability. It also does not change extension-level agent models,
enablement, or tool permissions.

## Maintenance checks

When updating this configuration:

1. Confirm each frontmatter `agent:` target names an included agent.
2. Confirm every relative skill, instruction, prompt, and documentation link
   resolves to a file in this repository.
3. Confirm described agent/skill counts and routing match the inventories.
4. Keep each procedure in one authoritative skill or instruction; use links
   rather than maintaining duplicate copies.
5. Keep explicit agent tool lists narrow and consistent with `AGENTS.md`.

Do not claim runtime or SAP validation based only on inspecting configuration
files.
