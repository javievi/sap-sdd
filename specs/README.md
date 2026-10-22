# Story specifications

Store each finalized story specification as `<story-id>.md` in this folder,
for example `ST123456.md`. Use the actual BA/user story ID; do not create
numbered feature files or separate plan documents.

- Start with `/sdd-architect` and attach the BA requirements and story ID.
- Use `/sdd-implement` with the spec path when ready for development, or ask
  Architect to continue after design approval.
- Use `/sdd-revise` with the same path and new requirements. It updates the
  spec first, then continues to code after the revised design is confirmed.
- Add `analysis only`, `plan only`, or `spec only` when no source edits are wanted.

The [template](../.github/skills/sdd-spec/assets/abap-feature-template.md) defines
the standard format; the [workflow](../.github/skills/sdd-spec/SKILL.md) defines
readiness, revision, and verification rules. Keep spec and code changes together
for developer review and commit. Agents do not automatically stage, commit, or
push. This README is not a story specification.
