# HANA Calc View → ABAP CDS — Rationale

> Enforced version lives in
> `.github/instructions/abap-cds-team.instructions.md`. Procedure lives in
> `.github/skills/hana-to-cds-conversion/SKILL.md`. This file is the "why."

## Why strict 1:1 equivalence, not "improved while we're at it"

Calc-view-to-CDS conversions (FCT_JOURNAL, DIM_CURR, DIM_AC style) are
migrations, not redesigns. Silently improving, collapsing, or reordering
logic nodes during a conversion makes it impossible to tell whether a
downstream discrepancy is a genuine bug or an intentional change — so the
default is to reproduce the exact result set (same grain, same
joins/associations, same filters, same calculated columns) and only deviate
with explicit user approval.

## Why layered views instead of flattened

If flattening Projection → Join → Aggregation stages could change cardinality,
filter timing, aggregation, or validation, retain those semantic boundaries as
separate helper views. Do not create layers merely to mirror the diagram.

## Sequencing: equivalence before performance

The built-in Performance (HANA) skill covers optimization. It's deliberately
sequenced *after* equivalence is confirmed — tuning a view before its logic
is verified correct risks tuning the wrong thing, or masking a logic gap
behind a performance win.

## Naming & annotations

The enforced instruction defines the helper/final naming patterns and the
mandatory four annotations. Use sibling views only to choose meaningful
descriptive suffixes and association names. Do not add
`@AbapCatalog.sqlViewName`; this workspace requires `DEFINE VIEW ENTITY`.
