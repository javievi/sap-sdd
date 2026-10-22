---
name: sdd-spec
description: "Spec-driven SAP ABAP analysis and development. Use for SDD, BA requirements, finalized story specs, embedded implementation plans, and revisions that must update specs/<story-id>.md before code."
user-invocable: false
---

# Story Specification Workflow

## Single source of truth

- `sdd-architect` is the default SDD entry point. `sdd-implementer` owns
  approved implementation, not an additional analysis gate.
- Keep exactly one canonical Markdown document per story at
  `specs/<story-id>.md`, including its design, plan, revision log, and evidence.
  Use the supplied story ID verbatim when it is a valid filename. Never
  invent an ID; ask only if it cannot be recovered from the supplied material.
  Reject path separators, traversal, and invalid/reserved filenames; request
  an agreed safe story ID instead of silently renaming it.
- Create the `specs` directory if needed. Reuse an existing matching document;
  do not overwrite history or create a second spec for a revision.
- Use the [ABAP feature template](./assets/abap-feature-template.md). Replace
  placeholders; keep headings stable. Use `Not applicable - <reason>` for
  irrelevant sections. The template is not itself a story.
- Do not create `.spec` files or new requirement/story/plan trees under
  `context`. Existing BA documents remain inputs and must not be deleted or
  migrated without a request. Link them from the canonical spec.
- Scope is analysis and development, including validation needed to support
  the code. Do not add deployment, release, sprint, ADR, or mandatory UI-test
  workflows unless the story actually requires them.

## 1. Intake and evidence

1. Read the supplied BA/user material and current spec in full. Extract the
   story ID, objective, actors, inputs/outputs, scope, business rules, error
   behavior, acceptance criteria, and explicit exclusions.
2. Read [team rules](../../copilot-instructions.md) and applicable ABAP/CDS
   instructions before defining names, syntax, or object design. Inspect
   affected source, callers, dependencies, and relevant existing tests.
3. Establish the target: SAP connection when live access is needed, release,
   language version (ABAP Cloud or standard ABAP), object types, package, and
   existing/proposed object status. Do not assume ABAP Cloud, RAP, an OData
   version, a transport, or a connected system. If a system is unknown, ask
   before using SAP tools; local analysis can continue without SAP access.
4. Verify existing APIs, tables, fields, method/FM signatures, types, and
   released-API availability from source or SAP metadata. Distinguish verified
   facts, proposed new objects, and unverified dependencies with evidence
   locations. Never present invented repository objects as existing.
5. For changes, capture current behavior and blast radius before proposing
   changes. Distinguish existing-source enhancements from initial
   implementation of already-created empty objects; do not recreate existing
   objects. Record applicable compatibility and equivalence constraints in
   the spec. This repository provides no separate specialist workflows.

## 2. Resolve only material gaps

- Reuse settled decisions and active change metadata from the conversation
  or existing spec. Do not ask the user to restate an attached document.
- Research first. Choose routine implementation details using verified project
  patterns and record the rationale; do not interview the user about them.
- Ask through the question tool, one focused question at a time, only when a
  missing answer changes observable behavior, scope, security, data integrity,
  required performance, an external contract, or a mandatory write prerequisite.
  Ask for the story ID or SAP target only when needed and not already known.
- No mandatory questionnaire, grill rounds, feature-boundary confirmation,
  separate plan approval, or "shall I continue?" after each document section.
  Silence never accepts a recommended business decision.
- Record harmless assumptions explicitly. Do not use assumptions to settle
  material decisions. If answers/access are unavailable, save a draft with
  precise blockers and continue only independent analysis.

## 3. Finalize the specification

1. Populate the template with developer-ready detail, not just a BA summary.
   Assign stable IDs to requirements/business rules (`BR-001`), acceptance
   criteria (`AC-001`), plan steps (`P-001`), and tests (`T-001`).
2. Scope all required SAP objects, not just the examples in the template.
   Include report/include/FM/DDIC objects for legacy work when applicable.
   Prefer modern supported ABAP and Clean ABAP design, but mandatory team
   prefixes override generic `zcl_*`, `zif_*`, or `zcds_*` examples. CDS
   conversion names must follow team purpose-based naming.
3. Specify field types, keys/grain, filters, joins/cardinalities, calculations,
   rounding, currencies/units, client handling, authorization placement, error
   contracts, transaction/locking semantics, and compatibility as relevant.
   For Cloud targets, require supported syntax and released dependencies.
4. Make acceptance criteria observable, including negative, boundary,
   regression, authorization, and performance cases where applicable.
   Performance constraints must include the required volume, metric, threshold,
   and measurement method. Do not invent SLAs; an essential missing threshold
   is a blocker, while an inapplicable performance target needs a reason.
5. Embed an ordered, dependency-aware implementation plan with actual object/
   file locations, concrete changes, BR/AC references, tests, and prerequisites.
   New objects may have proposed locations clearly labeled as such.
6. Check every rule maps to acceptance criteria and every criterion maps to
   planned changes and validation. Include explicit out-of-scope items.
7. Set `Specification status: Ready` only when no implementation-blocking
   questions, unresolved placeholders, conflicting rules, or unverifiable
   required contracts remain. Ready means implementable, not approved,
   implemented, or tested. Draft/blocked work must be reported honestly.

## 4. Develop from the current revision

1. Honor the user's requested mode. Analysis/spec-only and plan-only stop
   after saving the document. An implementation request continues once the
   spec is ready and required confirmation has been obtained.
2. Preserve existing ABAP confirmation rules: present the analyzed design/
   impact and obtain explicit confirmation before source changes. Record
   approval for the exact spec revision and scope. A prior explicit approval
   of that analyzed revision is sufficient; do not ask twice. Do not treat
   the initial BA brief, Ready status, or silence as design approval.
3. `sdd-architect` passes the current spec/revision, approved scope, embedded
   plan, and active source-change context to `sdd-implementer`, the local
   source-write owner. When invoked directly, `sdd-implementer` applies the
   same readiness and approval gates; no additional handoff is needed.
4. Before non-CDS writes, load `abap-flowerbox-revision` and
   `abap-change-tracking`; obtain missing required metadata without inventing
   values. Reuse the active context and preserve replaced code as required.
   A spec revision does not automatically start a new flower-box revision
   or Search Str. CDS is exempt from these non-CDS metadata and marker
   requirements; use applicable team rules and verified target-platform
   requirements without assuming a dedicated local CDS skill.
5. Implement only the plan and tightly coupled fixes, preserving other
   behavior. If actual source invalidates the design, update the spec through
   Architect first and obtain a new confirmation if approved scope changes.
6. Save source snapshots in the repository alongside the spec. For live SAP
   edits, identify the exact repository files and persist the final source
   there too; a remote activation alone is not repository synchronization.
   Report a missing source export/mapping capability as a blocker.

## 5. Revisions: spec first, code second

1. Read the current spec and relevant code. Reconcile unexpected drift before
   changing either; never overwrite unrelated developer edits.
2. Append the next spec revision (`R001`, `R002`, ...), recording the actual
   date, reason, supplied requirement source, changed BR/AC IDs, impacted
   objects/plan steps, compatibility effects, and verification impact. Do not
   fabricate a requester, approval, or source-code revision metadata.
3. Update the current normative sections and plan in place, not just the
   revision log. Preserve prior log entries and stable IDs; mark withdrawn
   items superseded instead of reusing their IDs for unrelated behavior.
4. Persist the revised document before any source edit. Reset affected plan
   progress and validation results to Pending/Not run for the new revision;
   preserve prior evidence with its revision label.
5. Track `Implemented revision` separately from current `Spec revision`.
   Until new code and required checks pass, the two are not synchronized.
   Follow the same Ready/approval/write gates as initial development.
6. If development was requested and these gates are satisfied, continue to
   affected code and regression tests in the same workflow. Do not force the
   user to run a separate implementer prompt after each revision.
7. A corrective code fix restoring existing specified behavior needs no new
   business revision; record the fix/evidence. Any behavioral change requires
   a spec revision first. Bookkeeping alone does not increment the revision.

## 6. Verify and persist the outcome

- Use existing targeted checks: ABAP syntax/activation, ATC, ABAP Unit,
  required code review, relevant existing tests, and manual acceptance checks
  as applicable. Do not introduce web tooling or UI-test agents by default.
- Record actual tool/command, result, evidence location, checked revision,
  and unresolved gaps. Distinguish Pass, Fail, Not run, and Blocked.
  Missing SAP access is not a successful syntax check or activation.
- Limit focused repair to three cycles. Stop for requirements conflicts,
  scope changes, missing capabilities, or unresolved failures; record blockers.
- Before finalizing, verify every required AC, plan item, relevant regression,
  and repository source snapshot against the current spec revision.
  Mark `Development status: Verified` and advance `Implemented revision`
  only when required checks pass. Otherwise use In progress or Blocked,
  identify partial work, and leave the prior implemented revision unchanged.
- Save validation/status in the same spec. Review the scoped diff and confirm
  spec and source files are present and not excluded by Git. Do not claim
  full synchronization when only SAP or only the document was changed.
- Do not stage, commit, or push by default. The developer reviews and commits
  the spec and code together. Report changed objects/files, current and
  implemented revisions, validation, blockers, and active Search Str for
  non-CDS code; omit long narrative unless requested.
