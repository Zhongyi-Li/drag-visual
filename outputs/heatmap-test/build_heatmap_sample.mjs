import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL("./", import.meta.url).pathname;
const workbook = Workbook.create();
const data = workbook.worksheets.add("热力图数据");
const expected = workbook.worksheets.add("预期热力矩阵");
const notes = workbook.worksheets.add("使用说明");

data.showGridLines = false;
expected.showGridLines = false;
notes.showGridLines = false;

const sourceRows = [
  ["星期", "时段", "地区", "渠道", "访客数", "订单数", "销售额", "转化率"],
  ["周一", "09:00", "华东", "自然流量", 120, 18, 32600, 0.15],
  ["周一", "09:00", "华东", "付费投放", 30, 6, 11200, 0.20],
  ["周一", "10:00", "华东", "自然流量", 80, 12, 21800, 0.15],
  ["周一", "11:00", "华东", "自然流量", 96, 16, 28400, 0.1667],
  ["周一", "14:00", "华东", "私域运营", 142, 24, 42600, 0.1690],
  ["周一", "15:00", "华东", "自然流量", 168, 32, 53600, 0.1905],
  ["周一", "16:00", "华东", "付费投放", 118, 20, 38400, 0.1695],
  ["周二", "09:00", "华南", "自然流量", 40, 7, 12800, 0.175],
  ["周二", "10:00", "华南", "自然流量", 200, 36, 64200, 0.18],
  ["周二", "11:00", "华南", "付费投放", 156, 25, 49200, 0.1603],
  ["周二", "14:00", "华南", "私域运营", 176, 34, 61200, 0.1932],
  ["周二", "15:00", "华南", "自然流量", 224, 43, 76800, 0.1920],
  ["周二", "16:00", "华南", "付费投放", 188, 31, 57400, 0.1649],
  ["周三", "09:00", "华北", "自然流量", 72, 10, 19600, 0.1389],
  ["周三", "10:00", "华北", "自然流量", 112, 19, 33200, 0.1696],
  ["周三", "11:00", "华北", "付费投放", 148, 26, 48600, 0.1757],
  ["周三", "14:00", "华北", "私域运营", 238, 48, 88600, 0.2017],
  ["周三", "15:00", "华北", "自然流量", 252, 52, 91600, 0.2063],
  ["周三", "16:00", "华北", "付费投放", 172, 29, 55800, 0.1686],
  ["周四", "09:00", "华东", "自然流量", 64, 9, 17600, 0.1406],
  ["周四", "10:00", "华东", "自然流量", 104, 16, 30200, 0.1538],
  ["周四", "11:00", "华东", "付费投放", 132, 22, 41200, 0.1667],
  ["周四", "14:00", "华东", "私域运营", 184, 37, 68200, 0.2011],
  ["周四", "15:00", "华东", "自然流量", 226, 44, 82600, 0.1947],
  ["周四", "16:00", "华东", "付费投放", 160, 27, 51400, 0.1688],
  ["周五", "09:00", "华南", "自然流量", 88, 13, 25600, 0.1477],
  ["周五", "10:00", "华南", "自然流量", 138, 23, 42800, 0.1667],
  ["周五", "11:00", "华南", "付费投放", 196, 38, 71600, 0.1939],
  ["周五", "14:00", "华南", "私域运营", 260, 55, 98200, 0.2115],
  ["周五", "15:00", "华南", "自然流量", 288, 61, 108600, 0.2118],
  ["周五", "16:00", "华南", "付费投放", 214, 42, 74600, 0.1963],
];

data.getRange("A1:H32").values = sourceRows;
data.getRange("A1:H1").format.fill.color = "#EAF2FF";
data.getRange("A1:H1").format.font.bold = true;
data.getRange("A1:H1").format.font.color = "#17324D";
data.getRange("A1:H32").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };
data.getRange("A1:H32").format.borders = { preset: "outside", style: "thin", color: "#C9D6E8" };
data.getRange("E2:G32").setNumberFormat("#,##0");
data.getRange("H2:H32").setNumberFormat("0.0%");
data.getRange("A:H").format.autofitColumns();
data.freezePanes.freezeRows(1);
data.tables.add("A1:H32", true, "HeatmapSourceTable");

expected.getRange("A1:G1").merge();
expected.getRange("A1").values = [["热力图预期效果（访客数 sum）"]];
expected.getRange("A1").format.fill.color = "#17324D";
expected.getRange("A1").format.font.color = "#FFFFFF";
expected.getRange("A1").format.font.bold = true;
expected.getRange("A1").format.font.size = 14;
expected.getRange("A3:B3").values = [["行维度", "星期"]];
expected.getRange("A4:B4").values = [["列维度", "时段"]];
expected.getRange("C3:D3").values = [["指标", "访客数"]];
expected.getRange("C4:D4").values = [["聚合", "sum"]];
expected.getRange("A3:D4").format.fill.color = "#F7FAFC";
expected.getRange("A3:D4").format.borders = { preset: "outside", style: "thin", color: "#CBD5E1" };

expected.getRange("A6:G6").values = [["星期 \\ 时段", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]];
expected.getRange("A7:A11").values = [["周一"], ["周二"], ["周三"], ["周四"], ["周五"]];
expected.getRange("B7:G11").formulas = [
  ["=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A7,'热力图数据'!$B$2:$B$32,B$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A7,'热力图数据'!$B$2:$B$32,C$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A7,'热力图数据'!$B$2:$B$32,D$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A7,'热力图数据'!$B$2:$B$32,E$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A7,'热力图数据'!$B$2:$B$32,F$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A7,'热力图数据'!$B$2:$B$32,G$6)"],
  ["=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A8,'热力图数据'!$B$2:$B$32,B$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A8,'热力图数据'!$B$2:$B$32,C$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A8,'热力图数据'!$B$2:$B$32,D$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A8,'热力图数据'!$B$2:$B$32,E$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A8,'热力图数据'!$B$2:$B$32,F$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A8,'热力图数据'!$B$2:$B$32,G$6)"],
  ["=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A9,'热力图数据'!$B$2:$B$32,B$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A9,'热力图数据'!$B$2:$B$32,C$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A9,'热力图数据'!$B$2:$B$32,D$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A9,'热力图数据'!$B$2:$B$32,E$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A9,'热力图数据'!$B$2:$B$32,F$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A9,'热力图数据'!$B$2:$B$32,G$6)"],
  ["=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A10,'热力图数据'!$B$2:$B$32,B$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A10,'热力图数据'!$B$2:$B$32,C$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A10,'热力图数据'!$B$2:$B$32,D$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A10,'热力图数据'!$B$2:$B$32,E$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A10,'热力图数据'!$B$2:$B$32,F$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A10,'热力图数据'!$B$2:$B$32,G$6)"],
  ["=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A11,'热力图数据'!$B$2:$B$32,B$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A11,'热力图数据'!$B$2:$B$32,C$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A11,'热力图数据'!$B$2:$B$32,D$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A11,'热力图数据'!$B$2:$B$32,E$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A11,'热力图数据'!$B$2:$B$32,F$6)", "=SUMIFS('热力图数据'!$E$2:$E$32,'热力图数据'!$A$2:$A$32,$A11,'热力图数据'!$B$2:$B$32,G$6)"],
];
expected.getRange("A6:G6").format.fill.color = "#EAF2FF";
expected.getRange("A6:G6").format.font.bold = true;
expected.getRange("A7:A11").format.font.bold = true;
expected.getRange("A6:G11").format.borders = { preset: "all", style: "thin", color: "#D8DEE9" };
expected.getRange("B7:G11").setNumberFormat("#,##0");
expected.getRange("B7:G11").conditionalFormats.add("colorScale", {
  criteria: [
    { type: "lowestValue", color: "#EFF6FF" },
    { type: "percentile", value: 50, color: "#93C5FD" },
    { type: "highestValue", color: "#1D4ED8" },
  ],
});
expected.getRange("A:G").format.autofitColumns();
expected.freezePanes.freezeRows(6);
expected.freezePanes.freezeColumns(1);

notes.getRange("A1:D1").merge();
notes.getRange("A1").values = [["热力图测试说明"]];
notes.getRange("A1").format.fill.color = "#17324D";
notes.getRange("A1").format.font.color = "#FFFFFF";
notes.getRange("A1").format.font.bold = true;
notes.getRange("A1").format.font.size = 14;
notes.getRange("A3:D9").values = [
  ["推荐绑定", "字段", "作用", "说明"],
  ["数据集", "heatmap_sample", "数据来源", "上传本文件后选择第一张工作表数据"],
  ["行维度", "星期", "纵向分组", "热力图左侧行标签"],
  ["列维度", "时段", "横向分组", "热力图顶部列标签"],
  ["指标", "访客数", "颜色强度", "同一行列组合下的访客数会按 sum 聚合"],
  ["可替代指标", "订单数、销售额、转化率", "指标切换", "转化率建议用 avg 聚合"],
  ["注意", "第一张表", "用于系统导入", "请不要把使用说明工作表移到第一位"],
];
notes.getRange("A3:D3").format.fill.color = "#F5F7FA";
notes.getRange("A3:D3").format.font.bold = true;
notes.getRange("A3:D9").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };
notes.getRange("A:D").format.autofitColumns();

const dataInspect = await workbook.inspect({
  kind: "table",
  sheetId: "热力图数据",
  range: "A1:H8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 8,
  maxChars: 5000,
});
console.log(dataInspect.ndjson);

const matrixInspect = await workbook.inspect({
  kind: "table",
  sheetId: "预期热力矩阵",
  range: "A6:G11",
  include: "values,formulas",
  tableMaxRows: 6,
  tableMaxCols: 7,
  maxChars: 5000,
});
console.log(matrixInspect.ndjson);

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(formulaErrors.ndjson);

const previewData = await workbook.render({ sheetName: "热力图数据", range: "A1:H32", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/heatmap_sample_data_preview.png`, new Uint8Array(await previewData.arrayBuffer()));
const previewMatrix = await workbook.render({ sheetName: "预期热力矩阵", range: "A1:G11", scale: 2, format: "png" });
await fs.writeFile(`${outputDir}/heatmap_sample_matrix_preview.png`, new Uint8Array(await previewMatrix.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/heatmap_sample.xlsx`);
