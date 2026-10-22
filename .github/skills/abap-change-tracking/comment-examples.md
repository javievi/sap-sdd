# Change Comment Format Examples

## Inline (1–3 lines changed)

```abap
* Removed line with old search string preserved and new one appended:
*SELECT-OPTIONS: so_congr              FOR gs_cube-consolidationgroup. "HM20260630 "HM20260701
* New replacement line with search string:
SELECT-OPTIONS: so_cunit              FOR gs_cube-consolidationunit. "HM20260701
```

## Block (4+ lines changed)

```abap
* { Removed INYYYYMMDD
*  "Block of removed code"
* } Removed INYYYYMMDD
* { Added INYYYYMMDD
  "Block of changed/added code"
* } Added INYYYYMMDD
```

## Testing block

```abap
* { FOR TESTING INYYYYMMDD
  "Block of testing code"
* } FOR TESTING INYYYYMMDD
```

## Testing inline

```abap
Code code code.                                            "FOR TESTING INYYYYMMDD
Code code code.                                            "FOR TESTING INYYYYMMDD
```
