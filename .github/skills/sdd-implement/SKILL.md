---
name: sdd-implement
description: "Read a ready story spec and execute its embedded ABAP implementation plan, or provide a plan-only update."
disable-model-invocation: true
argument-hint: "specs/<story-id>.md; optionally plan only"
---
Read the complete supplied `specs/<story-id>.md` and follow the
[SDD workflow](../skills/sdd-spec/SKILL.md). Execute its current embedded plan,
preserving team rules and existing design approvals. If I request only an
implementation plan, update that section in the same document and do not code.

If the spec is incomplete, stale, or requires behavior changes, route those
gaps through Architect before implementation. Persist actual validation and
synchronization status in the spec. Do not stage, commit, or push.
