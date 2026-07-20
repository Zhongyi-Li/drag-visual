import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL(".", import.meta.url).pathname;
const workbook = Workbook.create();

const raw = workbook.worksheets.add("销售数据");
const expected = workbook.worksheets.add("预期交叉表");
const notes = workbook.worksheets.add("测试说明");

raw.showGridLines = false;
expected.showGridLines = false;
notes.showGridLines = false;

const sourceRows = [
  ["日期", "地区", "品类", "销售额", "订单数"],
  [new Date("2026-07-01"), "华东", "手机", 1000, 5],
  [new Date("2026-07-01"), "华东", "电脑", 2000, 3],
  [new Date("2026-07-02"), "华东", "配件", 450, 12],
  [new Date("2026-07-02"), "华南", "手机", 800, 4],
  [new Date("2026-07-03"), "华南", "电脑", 1200, 2],
  [new Date("2026-07-04"), "华南", "电脑", 300, 1],
  [new Date("2026-07-04"), "华南", "配件", 360, 9],
  [new Date("2026-07-05"), "华北", "手机", 650, 3],
  [new Date("2026-07-05"), "华北", "电脑", 900, 2],
  [new Date("2026-07-06"), "华北", "配件", 180, 6],
  [new Date("2026-07-06"), "华东", "手机", 250, 1],
  [new Date("2026-07-06"), "华北", "电脑", 250, 1],
];

raw.getRange("A1:E13").values = sourceRows;
raw.getRange("A1:E1").format.fill.color = "#E8F1FF";
raw.getRange("A1:E1").format.font.bold = true;
raw.getRange("A1:E1").format.font.color = "#17324D";
raw.getRange("A1:E13").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };
raw.getRange("A1:E13").format.borders = { preset: "outside", style: "thin", color: "#B7C4D6" };
raw.getRange("A2:A13").setNumberFormat("yyyy-mm-dd");
raw.getRange("D2:E13").setNumberFormat("#,##0");
raw.getRange("A:E").format.autofitColumns();
raw.freezePanes.freezeRows(1);
raw.tables.add("A1:E13", true, "SalesDataTable");

expected.getRange("A1:E1").merge();
expected.getRange("A1").values = [["二维交叉表预期结果"]];
expected.getRange("A1").format.font.bold = true;
expected.getRange("A1").format.font.size = 16;
expected.getRange("A1").format.font.color = "#17324D";
expected.getRange("A3:B3").values = [["行维度", "地区"]];
expected.getRange("A4:B4").values = [["列维度", "品类"]];
expected.getRange("C3:D3").values = [["指标", "销售额"]];
expected.getRange("C4:D4").values = [["聚合", "sum"]];
expected.getRange("A3:D4").format.fill.color = "#F7FAFC";
expected.getRange("A3:D4").format.borders = { preset: "outside", style: "thin", color: "#CBD5E1" };

expected.getRange("A6:E6").values = [["地区 \\ 品类", "手机", "电脑", "配件", "合计"]];
expected.getRange("A7:A9").values = [["华东"], ["华南"], ["华北"]];
expected.getRange("B7:D9").formulas = [
  [
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A7,'销售数据'!$C$2:$C$13,B$6)",
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A7,'销售数据'!$C$2:$C$13,C$6)",
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A7,'销售数据'!$C$2:$C$13,D$6)",
  ],
  [
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A8,'销售数据'!$C$2:$C$13,B$6)",
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A8,'销售数据'!$C$2:$C$13,C$6)",
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A8,'销售数据'!$C$2:$C$13,D$6)",
  ],
  [
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A9,'销售数据'!$C$2:$C$13,B$6)",
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A9,'销售数据'!$C$2:$C$13,C$6)",
    "=SUMIFS('销售数据'!$D$2:$D$13,'销售数据'!$B$2:$B$13,$A9,'销售数据'!$C$2:$C$13,D$6)",
  ],
];
expected.getRange("E7:E9").formulas = [["=SUM(B7:D7)"], ["=SUM(B8:D8)"], ["=SUM(B9:D9)"]];
expected.getRange("A10").values = [["合计"]];
expected.getRange("B10:E10").formulas = [["=SUM(B7:B9)", "=SUM(C7:C9)", "=SUM(D7:D9)", "=SUM(E7:E9)"]];
expected.getRange("A6:E6").format.fill.color = "#E8F1FF";
expected.getRange("A6:E6").format.font.bold = true;
expected.getRange("A10:E10").format.fill.color = "#F3F4F6";
expected.getRange("A10:E10").format.font.bold = true;
expected.getRange("A6:E10").format.borders = { preset: "all", style: "thin", color: "#D8DEE9" };
expected.getRange("B7:E10").setNumberFormat("#,##0");
expected.getRange("A:E").format.autofitColumns();
expected.freezePanes.freezeRows(6);
expected.freezePanes.freezeColumns(1);

notes.getRange("A1:D1").merge();
notes.getRange("A1").values = [["二维交叉表测试说明"]];
notes.getRange("A1").format.font.bold = true;
notes.getRange("A1").format.font.size = 16;
notes.getRange("A3:B7").values = [
  ["导入工作表", "销售数据（第一个工作表，应用会优先读取它）"],
  ["行维度", "地区"],
  ["列维度", "品类"],
  ["指标", "销售额"],
  ["聚合方式", "sum"],
];
notes.getRange("A3:B7").format.borders = { preset: "all", style: "thin", color: "#D8DEE9" };
notes.getRange("A3:A7").format.fill.color = "#F3F4F6";
notes.getRange("A3:A7").format.font.bold = true;
notes.getRange("A:B").format.autofitColumns();

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(formulaErrors.ndjson);

const preview = await workbook.render({ sheetName: "预期交叉表", range: "A1:E10", scale: 2 });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/two_dimensional_crosstab_sample.xlsx`);
