---
name: abap-change-tracking
description: >-
  Formats inline vs. block change comments when adding, removing, or
  refactoring ABAP code, and testing-block comments. Use for topics related to
  commenting out code, refactoring, search string tagging, inline comment,
  block comment, removed/added code markers, or testing blocks.
user-invocable: false
---

# ABAP Change Tracking

An entirely new report's initial implementation is not a revision: leave its
revision box blank and write its source without Search Str change markers.
For an existing non-CDS source, apply the rules below when starting or
continuing a revision. When the user says no revision is needed, reuse the
Search Str from the last completed flower-box revision, ignoring the blank
template. If there is no completed revision or the user explicitly asks to
skip tracking, edit without new Search Str markers or Removed/Added blocks;
preserve existing entries, markers, and comments. Do not invent a Search Str.

Apply the active flower-box Search Str as follows:

| Context | Required format |
|---|---|
| Inside a matching-Search-Str Added block | Edit directly; no removed copy or per-line Search Str |
| 1-3 new lines elsewhere | Add the Search Str inline or immediately above |
| 4+ new lines elsewhere | Wrap in `* { Added SEARCHSTR` / `* } Added SEARCHSTR` |
| 1-3 replaced lines elsewhere | Comment out each old line and append the Search Str; append it to each replacement |
| 4+ replaced lines elsewhere | Preserve old code in Removed markers and replacements in Added markers |

For 1-3 lines, never substitute block markers. For 4+ replaced lines, always
use `* { Removed SEARCHSTR` / `* } Removed SEARCHSTR` and matching Added
markers. Never hide removed code behind conditional logic or helper methods.

If an existing inline comment or older Search Str is present, append the new
Search Str separated by a space; never overwrite it. A nonmatching enclosing
Added block is not same-revision context, so use the normal replacement rules.
Mark temporary test code with `FOR TESTING SEARCHSTR`.

See [comment-examples.md](./comment-examples.md) for the inline, block, and
testing-block sample formats used by this team.
