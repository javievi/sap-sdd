---
name: sdd-revise
description: "Revise an existing story spec first, then synchronize affected ABAP code and tests with the new revision."
agent: sdd-architect
argument-hint: "specs/<story-id>.md and the BA/user change; optionally spec only"
---

Apply the supplied change using the
[SDD revision workflow](../skills/sdd-spec/SKILL.md). Read the current spec and
affected code, append a revision, update the current requirements/design/plan/
acceptance criteria, and save the same `specs/<story-id>.md` before source edits.

Unless I say spec only or analysis only, this is also a request to synchronize
the affected code and tests after the revised design has the required explicit
confirmation. Continue without a separate implementer prompt once approved.
Reuse settled decisions and active ABAP source-change metadata; a spec revision
does not automatically create a new Search Str. Record actual validation and
remaining gaps. Save spec and code locally without staging, committing, or pushing.
