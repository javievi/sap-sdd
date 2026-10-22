# ABAP Team Rules

Team rules override bundled guidance on conflict, especially mandatory naming
prefixes.

Obey the workspace `AGENTS.md` before selecting tools. Its forbidden-tool
rules are hard constraints and must never be bypassed.

Use `OUC` for SAP connections unless the user explicitly names another
connection for the requested scope. Do not infer a different connection from
the active editor. SQL tool calls are permitted without separate authorization
only for bounded, read-only `SELECT` queries; never issue SQL that modifies
data or schema, executes procedures, or has side effects. This does not
authorize running reports, tests, or other write-capable operations.

## Routing

- Use `sdd-architect` for requirements analysis, technical design, canonical
  story specifications, and spec-first revisions.
- Use `sdd-implementer` for implementation and validation of a ready,
  explicitly approved specification. It owns source changes in that scope.
- Use `abap-agent-architect` only for repository Copilot customization work.

## Source Changes

- Before non-CDS ABAP writes, load `abap-flowerbox-revision` and
  `abap-change-tracking`. For an entirely new report, ask only for Purpose,
  Description, Author, and Date; use the report template's blank revision
  box. For changes to existing source, ask whether a new revision is needed
  when the choice is unclear, especially in a new session. Honor an explicit
  answer without requiring new metadata: when no revision is needed, reuse
  the last completed flower-box revision and Search Str, ignoring the blank
  template. Only skip tracking when none exists or the user explicitly
  requests it. Never invent revision fields.
- For revisions to existing non-CDS ABAP, preserve replaced code using the
  active Search Str and the skill's inline or Removed/Added format. Direct
  replacement is allowed only inside a matching-Search-Str Added block;
  never hide removed code behind conditional logic or helper methods.
- Follow applicable source-specific instructions for other object types. This
  repository does not include dedicated CDS, GFGR, OUC-to-ODC, or HANA-to-CDS
  workflows.

For non-CDS code changes, report the changed object, active Search Str when a
revision applies, and validation. For other source types, report changed
objects and validation. Do not claim validation that was not performed.
Omit extended explanation unless requested. Load other `docs/` material only
when its rationale is needed.
