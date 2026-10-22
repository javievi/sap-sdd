---
name: sdd-architect
description: "Turn BA/user requirements into a finalized ABAP story spec with technical design, acceptance criteria, and an embedded implementation plan."
agent: sdd-architect
argument-hint: "Story ID plus BA requirements or source files; optionally request implementation after analysis"
---

Use the [SDD workflow](../skills/sdd-spec/SKILL.md) to create or finalize
`specs/<story-id>.md` from the supplied requirements and verified code context.
Include the complete developer-ready design and implementation plan in this
single document. Reuse the current spec if it already exists.

Default to analysis/specification only. If I explicitly request development,
continue from the saved, ready spec after the required design confirmation.
Ask only for genuine blockers not answered by my material or repository.
Do not ask me to approve each document section or run a separate planning step.
