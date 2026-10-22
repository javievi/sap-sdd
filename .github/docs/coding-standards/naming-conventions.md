# ABAP Naming & Syntax — Full Reference

> Enforced version lives in
> `.github/instructions/abap-team-standards.instructions.md`. This file has
> the rationale and full coding examples; read it once, not every session.

## Why Hungarian notation, against Clean ABAP's default advice

The bundled Clean ABAP skill generally favors plain descriptive names
without prefixes. Our team keeps Hungarian-notation prefixes because the
existing codebase (pre-dating Clean ABAP adoption) is prefix-heavy, and
mixing conventions within the same objects is worse for readability than
being consistently "old-style." When the two disagree, our convention wins.

## Data / Types (Global `G` / Local `L`)

| Type | Prefix | Example | Coding |
|---|---|---|---|
| Field | `V` | `GV_MATNR` | `DATA: gv_matnr TYPE matnr.` |
| Constant | `C` | `GC_LIGHTSPEED` | `CONSTANTS: gc_lightspeed TYPE i VALUE '300000'.` |
| Structure | `S` | `GS_KNB1` | `DATA: gs_knb1 TYPE knb1.` |
| Range | `R` | `GR_CARRID` | `DATA: gr_carrid TYPE RANGE OF spfli-carrid.` |
| Table Type | `T` | `GT_VBAK` | `DATA: gt_vbak TYPE TABLE OF vbak.` |
| Types | `TY` | `GTY_RESULT` | `TYPES gty_result TYPE p LENGTH 16 DECIMALS 2.` |
| Class | `O` | `GO_GRID` | `DATA: go_grid TYPE REF TO cl_gui_alv_grid.` |
| Interface | `IF` | `GIF_MSGLIST` | `DATA: gif_msglist TYPE REF TO if_reca_message_list.` |
| Data Object | `DO` | `GDO_DATA` | `DATA: gdo_data TYPE REF TO data.` |
| Field Symbol | `FS` | `<GFS_DATA>` | `FIELD-SYMBOLS: <gfs_data> TYPE ANY.` |

## UI Parameters

| Type | Prefix | Example | Coding |
|---|---|---|---|
| Field | `PA` | `PA_INT1` | `PARAMETERS: pa_int1 TYPE i.` |
| Select Option | `SO` | `SO_ACCT` | `SELECT-OPTIONS: so_acct FOR t9sup-hkont.` |
| Radio Button | `RB` | `RB_SPLIT` | `PARAMETERS: rb_split RADIOBUTTON GROUP algo DEFAULT 'X'.` |
| Checkbox | `CB` | `CB_DAILY` | `PARAMETERS: cb_daily AS CHECKBOX.` |

## Parameter naming by direction + data kind

Direction letters: `P`=USING(FORM), `C`=CHANGING, `I`=IMPORTING,
`E`=EXPORTING, `R`=RETURNING.
Data-kind letters: `V`=scalar, `S`=structure, `T`=table, `R`=range,
`O`=object ref, `D`=data ref.

Examples:
- FORM `USING` value: `PV_BUKRS` — range: `PR_BUKRS`
- FORM `CHANGING` value: `CV_RESULT` — table: `CT_ITEMS`
- Method `IMPORTING` value: `IV_BASE` — table: `IT_LINES`
- Method `CHANGING` range: `CR_BUKRS`
- Method `EXPORTING` structure: `ES_RESULT`
- Method `RETURNING` table: `RT_RESULT`

FORM routines only ever use `P*`/`C*`; methods and function modules use the
full `I/E/C/R` set.

## Modern ABAP (7.4+)

- Inline declarations: `DATA(lv_var)`, `FIELD-SYMBOL(<fs>)`
- New SQL syntax with `@` host variables
- String templates: `` |text { lv_var } more text| ``
- Constructor expressions: `VALUE #( )`, `NEW #( )`, `CONV #( )`, `COND #( )`, `SWITCH #( )`
- Table expressions: `gt_tab[ key = value ]`
- `CORRESPONDING #( )` for structure/table mapping
- Never `DEFINE` / `END-OF-DEFINITION` or other obsolete macros

## SQL indentation

```abap
SELECT (fields)
  FROM (table)
  INTO (variable)
  WHERE (condition)
  AND   (condition).
```
