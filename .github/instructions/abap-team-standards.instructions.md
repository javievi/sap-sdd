---
name: "ABAP team naming & syntax standards"
description: "Team-specific data/UI/FORM/function parameter naming, required over generic Clean ABAP guidance where they conflict; modern ABAP 7.4+ syntax; SQL indentation."
applyTo: "**/*.abap"
---

# ABAP Team Naming and Syntax

These mandatory prefixes override Clean ABAP.

## Naming conventions

### Data and Types

Prefix global declarations with `G`, local declarations with `L`, then append
the data-kind code:

| Kind | Code | Examples |
|---|---|---|
| Scalar | `V` | `GV_MATNR`, `LV_MATNR` |
| Constant | `C` | `GC_LIMIT`, `LC_LIMIT` |
| Structure | `S` | `GS_ITEM`, `LS_ITEM` |
| Range | `R` | `GR_BUKRS`, `LR_BUKRS` |
| Internal table | `T` | `GT_ITEMS`, `LT_ITEMS` |
| Type | `TY` | `GTY_RESULT`, `LTY_RESULT` |
| Object reference | `O` | `GO_GRID`, `LO_GRID` |
| Interface reference | `IF` | `GIF_MESSAGES`, `LIF_MESSAGES` |
| Data reference | `DO` | `GDO_DATA`, `LDO_DATA` |
| Field symbol | `FS` | `<GFS_ITEM>`, `<LFS_ITEM>` |

### UI Parameters

Use `PA_` for fields, `SO_` for select-options, `RB_` for radio buttons, and
`CB_` for checkboxes.

### Parameters

Use direction + data kind. Directions: `P` FORM `USING`, `C` `CHANGING`, `I`
`IMPORTING`, `E` `EXPORTING`, `R` `RETURNING`. Kinds: `V` scalar, `S`
structure, `T` table, `R` range, `O` object reference, `D` data reference.
FORM parameters must use `P*` for `USING` and `C*` for `CHANGING`.

## Modern ABAP 7.4+

- Inline declarations: `DATA(lv_var)`, `FIELD-SYMBOL(<fs>)`
- New SQL syntax with `@` host variables
- String templates: `|text { lv_var } more text|`
- Constructor expressions: `VALUE #( )`, `NEW #( )`, `CONV #( )`, `COND #( )`, `SWITCH #( )`
- Table expressions: `gt_tab[ key = value ]`
- `CORRESPONDING #( )` for structure/table mapping
- Never use `DEFINE` / `END-OF-DEFINITION` macros.

## SQL Layout

Indent `FROM`, `INTO`, `WHERE`, and aligned conditions beneath `SELECT`.
