import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL("./", import.meta.url).pathname;
const workbook = Workbook.create();
const data = workbook.worksheets.add("趋势分析数据");
const notes = workbook.worksheets.add("使用说明");

const rows = [
  ["业务日期", "月份", "渠道", "访客数", "销售额", "订单数", "转化率"],
  ["2026-01-01", "2026-01", "自然流量", 18520, 286000, 1420, 0.0767],
  ["2026-01-01", "2026-01", "付费投放", 12840, 238000, 1036, 0.0807],
  ["2026-01-01", "2026-01", "私域运营", 7420, 158000, 690, 0.0930],
  ["2026-02-01", "2026-02", "自然流量", 19280, 302000, 1512, 0.0784],
  ["2026-02-01", "2026-02", "付费投放", 13860, 264000, 1118, 0.0807],
  ["2026-02-01", "2026-02", "私域运营", 8010, 176000, 760, 0.0949],
  ["2026-03-01", "2026-03", "自然流量", 21450, 348000, 1694, 0.0790],
  ["2026-03-01", "2026-03", "付费投放", 15120, 301000, 1258, 0.0832],
  ["2026-03-01", "2026-03", "私域运营", 8840, 205000, 846, 0.0957],
  ["2026-04-01", "2026-04", "自然流量", 23890, 376000, 1818, 0.0761],
  ["2026-04-01", "2026-04", "付费投放", 16340, 332000, 1375, 0.0841],
  ["2026-04-01", "2026-04", "私域运营", 9420, 222000, 906, 0.0962],
  ["2026-05-01", "2026-05", "自然流量", 25760, 414000, 1968, 0.0764],
  ["2026-05-01", "2026-05", "付费投放", 17180, 356000, 1452, 0.0845],
  ["2026-05-01", "2026-05", "私域运营", 10150, 246000, 982, 0.0967],
  ["2026-06-01", "2026-06", "自然流量", 27320, 452000, 2116, 0.0775],
  ["2026-06-01", "2026-06", "付费投放", 18420, 389000, 1578, 0.0857],
  ["2026-06-01", "2026-06", "私域运营", 10980, 271000, 1064, 0.0969],
];

data.getRange("A1:G19").values = rows;
data.getRange("A1:G1").format.fill.color = "#EAF2FF";
data.getRange("A1:G1").format.font.bold = true;
data.getRange("A1:G1").format.font.color = "#1F4E79";
data.getRange("A1:G19").format.borders = { preset: "inside", style: "thin", color: "#D9E2F3" };
data.getRange("A1:G19").format.autofitColumns();
data.getRange("D2:F19").setNumberFormat("#,##0");
data.getRange("G2:G19").setNumberFormat("0.0%");
data.freezePanes.freezeRows(1);
data.showGridLines = false;

notes.getRange("A1:D1").values = [["趋势分析图表测试说明", null, null, null]];
notes.getRange("A1:D1").merge();
notes.getRange("A1:D1").format.fill.color = "#1677FF";
notes.getRange("A1:D1").format.font.color = "#FFFFFF";
notes.getRange("A1:D1").format.font.bold = true;
notes.getRange("A1:D1").format.font.size = 14;
notes.getRange("A3:D8").values = [
  ["推荐绑定", "字段", "作用", "说明"],
  ["数据集", "trend_analysis_sample", "数据来源", "上传本文件后选择第一张工作表数据"],
  ["时间字段", "业务日期 或 月份", "横轴", "业务日期按日期趋势，月份可聚合不同渠道的月度趋势"],
  ["指标", "销售额", "纵轴", "也可以切换为访客数、订单数、转化率"],
  ["预期效果", "按时间升序", "趋势线 + 摘要", "展示最新值、较上一期变化和峰值"],
  ["注意", "第一张表", "用于系统导入", "请不要把使用说明工作表移到第一位"],
];
notes.getRange("A3:D3").format.fill.color = "#F5F7FA";
notes.getRange("A3:D3").format.font.bold = true;
notes.getRange("A3:D8").format.borders = { preset: "inside", style: "thin", color: "#E8E8E8" };
notes.getRange("A:D").format.autofitColumns();
notes.showGridLines = false;

const tableInspect = await workbook.inspect({
  kind: "table",
  sheetId: "趋势分析数据",
  range: "A1:G8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 7,
  maxChars: 4000,
});
console.log(tableInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "趋势分析数据", range: "A1:G19", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/trend_analysis_sample_preview.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/trend_analysis_sample.xlsx`);
