---
name: "SDD story specifications"
description: "Use when creating or revising canonical SDD story specs or implementing code from them. Keep specs/<story-id>.md and ABAP source synchronized through spec-first revisions."
applyTo: "specs/**/*.md"
---

# SDD Specification Contract

- Use [the SDD spec skill](../skills/sdd-spec/SKILL.md) and its
  [template](../skills/sdd-spec/assets/abap-feature-template.md).
- `specs/<story-id>.md` is the single canonical spec, including technical
  design, implementation plan, traceability, revision history, and evidence.
  The folder README is navigation only, not a story spec.
- Route requirements/design/revisions to `sdd-architect`; use
  `sdd-implementer` only for focused execution of a ready spec.
- Read BA sources and affected code before finalizing. Do not invent SAP
  dependencies, business decisions, approvals, or revision metadata.
- Update and save current normative sections plus revision history before
  code changes. Preserve stable IDs and prior history; invalidate affected
  validation when a revision changes behavior.
- Keep specification readiness, design approval, and implemented revision
  separate. Do not mark partial or unverified work complete.
- Team ABAP/CDS rules and required confirmation still apply. Existing ABAP
  source-change safeguards remain in force; `sdd-implementer` owns approved
  source writes.
- Ask only blocking questions, not a mandatory questionnaire. Keep spec and
  code in the repository for developer review; no automatic Git operations.
