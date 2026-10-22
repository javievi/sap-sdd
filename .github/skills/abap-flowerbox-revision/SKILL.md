---
name: abap-flowerbox-revision
description: >-
  Collects creation-header details for entirely new non-CDS ABAP reports and
  revision details for later source changes. Use for new report flower boxes,
  revision headers, Search Str values, revised-by/on fields, or changelog entries.
user-invocable: false
---

# Flower Box Revision

For an entirely new non-CDS report (including an already-created report with
only boilerplate), ask only for Purpose, Description, Author, and Date before
writing source. Never invent missing values. Fill the creation header using
the linked template and leave its Revision, Revised by, Revised on, and Search
Str fields blank. Initial implementation is not a revision: do not request a
Search Str or add revision/change-tracking markers to its new code.

For a change to existing non-CDS source, first ask whether to start a new
revision, continue an existing revision, or proceed without revision tracking
if the user's choice is not already clear, especially in a new session. Honor
an explicit answer without repeatedly asking in the same change set. If no
revision is needed, do not append an entry: find the most recent completed
flower-box revision and continue using its metadata and Search Str, including
after a session switch. Ignore the blank revision template. If no completed
revision exists, write without new Search Str markers; only an explicit request
to skip tracking disables it when a completed revision exists. Preserve
existing entries and comments; never invent revision fields.

Only for a requested new revision, require Revision, Revised by, and Revised
on before the first write. Derive the Search Str from the supplied person and
date; ask for anything missing and never invent values:

- **Revision:** `[ST######]#### - Description`
- **Revised by:** `First Name Last Name (DOMAIN)`
- **Revised on:** `DD Mmm YYYY`
- **Search Str:** `<FIRST_INITIAL><LAST_INITIAL><YYYYMMDD>`.

When continuing the last completed revision, reuse its recorded Search Str;
ask only for a missing Search Str when that revision has none identifiable.
Reuse the user's revision choice for follow-up edits.
Append an entry only when the user explicitly starts a new revision/change
set. After appending one, insert the blank template immediately below it and
before the `REPORT` or equivalent object statement; preserve existing entries
and box alignment.

For edits under a revision, direct in-place replacement is allowed only inside
an Added block whose Search Str matches the active one. Otherwise apply normal
`abap-change-tracking` rules with the active Search Str. Confirm the active
Search Str before revision code.

- [Report flower box template](./template.abap)
