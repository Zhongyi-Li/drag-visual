# XLSX Upload Compatibility

Upload-ready XLSX files in this workspace must be parser-friendly for BI/import
platforms that use simplified OOXML readers.

Required checks before delivering an upload-ready XLSX:

1. The first worksheet must contain data starting at `A1`.
2. The first row must be the real field header row, with no empty cells.
3. `xl/workbook.xml`, `xl/worksheets/sheet1.xml`, `xl/sharedStrings.xml`,
   and `xl/styles.xml` must not rely on the `x:` prefix for main spreadsheet
   tags such as `sheet`, `worksheet`, `sheetData`, `row`, `c`, `si`, or `t`.
4. String cells in the first worksheet should be written as `inlineStr` during
   compatibility normalization so the header row can be read directly from
   `sheet1.xml`.
5. `xl/_rels/workbook.xml.rels` worksheet targets should be relative to `xl/`,
   for example `worksheets/sheet1.xml`, not `/xl/worksheets/sheet1.xml`.
6. A simplified parser assertion must pass: reading unprefixed
   `<sheetData><row><c>` from `sheet1.xml` returns a non-empty first row that
   exactly matches the expected headers.

For the metric trend dataset, rerun:

```bash
/Users/ethan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node outputs/metric-trend-xlsx/build-metric-trend.mjs
```
