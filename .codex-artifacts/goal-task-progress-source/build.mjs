import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const rootDir = "/Users/ethan/Desktop/ZH/drag-visual";
const outputDir = `${rootDir}/outputs/goal-task-progress-source-20260820`;
const outputPath = `${outputDir}/目标任务进度数据源.xlsx`;

const employees = [
  { name: "王雨晨", gmvTarget: 1_000_000, salesTarget: 2_000, turnoverTarget: 365, margin: 0.165 },
  { name: "陈慧慧", gmvTarget: 500_000, salesTarget: 1_000, turnoverTarget: 450, margin: 0.142 },
  { name: "林晓峰", gmvTarget: 750_000, salesTarget: 1_500, turnoverTarget: 400, margin: 0.158 },
  { name: "赵一鸣", gmvTarget: 600_000, salesTarget: 1_200, turnoverTarget: 380, margin: 0.151 },
];

const monthlyPerformance = [
  [[524_000, 1_080, 338], [188_000, 420, 492], [488_000, 960, 386], [352_000, 700, 410]],
  [[658_400, 1_240, 326], [251_000, 510, 475], [542_000, 1_050, 378], [418_000, 790, 396]],
  [[708_800, 1_360, 314], [298_000, 590, 463], [603_000, 1_170, 366], [472_000, 880, 382]],
  [[812_600, 1_530, 302], [334_000, 680, 451], [675_000, 1_280, 355], [531_000, 990, 370]],
  [[329_102, 1_413, 418], [9_313, 41, 1_430], [621_500, 1_201, 389], [512_400, 1_028, 405]],
];

const headers = [
  "统计月份", "员工", "GMV实际(欧元)", "GMV目标(欧元)", "销量实际(件)", "销量目标(件)",
  "毛利(欧元)", "周转天数(实际)", "周转天数目标", "GMV权重", "销量权重", "周转天数权重",
  "GMV完成率", "销量完成率", "周转完成率", "综合评分", "状态", "权重合计", "权重校验",
];

const dataRows = [];
for (let monthIndex = 0; monthIndex < monthlyPerformance.length; monthIndex += 1) {
  for (let employeeIndex = 0; employeeIndex < employees.length; employeeIndex += 1) {
    const employee = employees[employeeIndex];
    const [gmvActual, salesActual, turnoverActual] = monthlyPerformance[monthIndex][employeeIndex];
    dataRows.push([
      new Date(Date.UTC(2026, monthIndex + 3, 1)),
      employee.name,
      gmvActual,
      employee.gmvTarget,
      salesActual,
      employee.salesTarget,
      Math.round(gmvActual * employee.margin),
      turnoverActual,
      employee.turnoverTarget,
      0.3,
      0.55,
      0.15,
    ]);
  }
}

const workbook = Workbook.create();
const dataSheet = workbook.worksheets.add("目标任务数据");
const notesSheet = workbook.worksheets.add("使用说明");

dataSheet.showGridLines = false;
// The browser importer treats the first non-empty row of the first worksheet
// as column headers. Keep this sheet a pure rectangular data source.
dataSheet.getRange("A1:S1").values = [headers];
dataSheet.getRange("A1:S1").format = {
  fill: "#2F6BFF",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#1D4ED8" },
};
dataSheet.getRange("A1:S1").format.rowHeight = 34;

const firstDataRow = 2;
const lastDataRow = firstDataRow + dataRows.length - 1;
dataSheet.getRange(`A${firstDataRow}:L${lastDataRow}`).values = dataRows;
dataSheet.getRange(`M${firstDataRow}`).formulas = [[
  `=IFERROR(C${firstDataRow}/D${firstDataRow},0)`,
  `=IFERROR(E${firstDataRow}/F${firstDataRow},0)`,
  `=IFERROR(I${firstDataRow}/H${firstDataRow},0)`,
  `=MIN(M${firstDataRow},1)*J${firstDataRow}+MIN(N${firstDataRow},1)*K${firstDataRow}+MIN(O${firstDataRow},1)*L${firstDataRow}`,
  `=IF(P${firstDataRow}>=0.9,"达标",IF(P${firstDataRow}>=0.7,"推进中","需关注"))`,
  `=SUM(J${firstDataRow}:L${firstDataRow})`,
  `=IF(ABS(R${firstDataRow}-1)<0.0001,"通过","需调整")`,
]];
dataSheet.getRange(`M${firstDataRow}:S${lastDataRow}`).fillDown();

dataSheet.getRange(`A${firstDataRow}:L${lastDataRow}`).format = {
  fill: "#F7FBFF",
  borders: { preset: "inside", style: "thin", color: "#DCE6F2" },
  verticalAlignment: "center",
};
dataSheet.getRange(`M${firstDataRow}:S${lastDataRow}`).format = {
  fill: "#F4F6F8",
  borders: { preset: "inside", style: "thin", color: "#DCE6F2" },
  verticalAlignment: "center",
};
dataSheet.getRange(`A${firstDataRow}:S${lastDataRow}`).format.borders = { preset: "outside", style: "thin", color: "#B9C9DD" };
dataSheet.getRange(`A${firstDataRow}:A${lastDataRow}`).format.numberFormat = "yyyy-mm";
dataSheet.getRange(`C${firstDataRow}:D${lastDataRow}`).format.numberFormat = "€#,##0";
dataSheet.getRange(`E${firstDataRow}:F${lastDataRow}`).format.numberFormat = "#,##0";
dataSheet.getRange(`G${firstDataRow}:G${lastDataRow}`).format.numberFormat = "€#,##0";
dataSheet.getRange(`H${firstDataRow}:I${lastDataRow}`).format.numberFormat = "#,##0";
dataSheet.getRange(`J${firstDataRow}:P${lastDataRow}`).format.numberFormat = "0.0%";
dataSheet.getRange(`R${firstDataRow}:R${lastDataRow}`).format.numberFormat = "0.0%";
dataSheet.getRange(`B${firstDataRow}:B${lastDataRow}`).format.font = { bold: true, color: "#172B4D" };
dataSheet.getRange(`Q${firstDataRow}:S${lastDataRow}`).format.horizontalAlignment = "center";
dataSheet.getRange(`M${firstDataRow}:P${lastDataRow}`).conditionalFormats.add("colorScale", {
  colors: ["#FCE7E7", "#FFF3C4", "#D9F2E6"],
  thresholds: ["min", "50%", "max"],
});
dataSheet.getRange(`Q${firstDataRow}:Q${lastDataRow}`).conditionalFormats.add("containsText", {
  text: "需关注",
  format: { fill: "#FDE2E1", font: { bold: true, color: "#B42318" } },
});
dataSheet.getRange(`Q${firstDataRow}:Q${lastDataRow}`).conditionalFormats.add("containsText", {
  text: "达标",
  format: { fill: "#DCFCE7", font: { bold: true, color: "#15803D" } },
});
dataSheet.getRange(`S${firstDataRow}:S${lastDataRow}`).conditionalFormats.add("containsText", {
  text: "需调整",
  format: { fill: "#FDE2E1", font: { bold: true, color: "#B42318" } },
});

dataSheet.tables.add(`A1:S${lastDataRow}`, true, "GoalTaskProgressSource");
dataSheet.freezePanes.freezeRows(1);
dataSheet.getRange(`A1:A${lastDataRow}`).format.columnWidth = 13;
dataSheet.getRange(`B1:B${lastDataRow}`).format.columnWidth = 12;
dataSheet.getRange(`C1:D${lastDataRow}`).format.columnWidth = 16;
dataSheet.getRange(`E1:F${lastDataRow}`).format.columnWidth = 14;
dataSheet.getRange(`G1:G${lastDataRow}`).format.columnWidth = 14;
dataSheet.getRange(`H1:I${lastDataRow}`).format.columnWidth = 15;
dataSheet.getRange(`J1:L${lastDataRow}`).format.columnWidth = 13;
dataSheet.getRange(`M1:P${lastDataRow}`).format.columnWidth = 13;
dataSheet.getRange(`Q1:S${lastDataRow}`).format.columnWidth = 12;
dataSheet.getRange(`A${firstDataRow}:S${lastDataRow}`).format.rowHeight = 21;

notesSheet.showGridLines = false;
notesSheet.getRange("A1:F1").merge();
notesSheet.getRange("A1").values = [["目标任务进度图表 · 字段映射说明"]];
notesSheet.getRange("A1:F1").format = {
  fill: "#173A70",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  verticalAlignment: "center",
};
notesSheet.getRange("A1:F1").format.rowHeight = 30;
notesSheet.getRange("A3:F3").values = [["图表用途", "建议绑定字段", "数据类型", "用途说明", "示例值", "是否必填"]];
notesSheet.getRange("A3:F3").format = {
  fill: "#2F6BFF",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
};
notesSheet.getRange("A4:F10").values = [
  ["月度切换", "统计月份", "日期", "用于年、月筛选器", "2026-08-01", "是"],
  ["员工维度", "员工", "文本", "目标表格按员工展示", "王雨晨", "是"],
  ["GMV指标", "GMV实际(欧元) / GMV目标(欧元)", "数值", "完成金额与目标金额配对", "329,102 / 1,000,000", "是"],
  ["销量指标", "销量实际(件) / 销量目标(件)", "数值", "完成件数与目标件数配对", "1,413 / 2,000", "是"],
  ["周转指标", "周转天数(实际) / 周转天数目标", "数值", "低于目标天数即超额完成", "418 / 365", "是"],
  ["权重设置", "GMV权重 / 销量权重 / 周转天数权重", "百分比", "员工每月评分权重，合计必须为 100%", "30% / 55% / 15%", "是"],
  ["辅助展示", "毛利(欧元)", "数值", "可在表格中作为补充经营指标展示", "54,342", "否"],
];
notesSheet.getRange("A3:F10").format.borders = { preset: "all", style: "thin", color: "#D7E1EF" };
notesSheet.getRange("A4:F10").format.verticalAlignment = "center";
notesSheet.getRange("A4:A10").format.font = { bold: true, color: "#173A70" };
notesSheet.getRange("A4:F10").format.wrapText = true;
notesSheet.getRange("A4:F10").format.rowHeight = 32;
notesSheet.getRange("A12:F12").merge();
notesSheet.getRange("A12").values = [["上传建议：选择“目标任务数据”工作表作为数据源。后续可在图表配置中将“统计月份”设为日期维度，将“员工”设为行维度，并为三项任务指标分别完成实际值、目标值和权重字段的绑定。"]];
notesSheet.getRange("A12:F12").format = {
  fill: "#EAF2FF",
  font: { color: "#37516F" },
  wrapText: true,
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: "#AFC6E9" },
};
notesSheet.getRange("A12:F12").format.rowHeight = 48;
notesSheet.getRange("A1:A12").format.columnWidth = 15;
notesSheet.getRange("B1:B12").format.columnWidth = 36;
notesSheet.getRange("C1:C12").format.columnWidth = 12;
notesSheet.getRange("D1:D12").format.columnWidth = 28;
notesSheet.getRange("E1:E12").format.columnWidth = 24;
notesSheet.getRange("F1:F12").format.columnWidth = 12;
notesSheet.freezePanes.freezeRows(3);

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "目标任务数据",
  range: `A1:S${lastDataRow}`,
  scale: 1.4,
  format: "png",
});
await fs.writeFile(`${outputDir}/目标任务进度数据源预览.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const check = await workbook.inspect({
  kind: "table",
  range: "目标任务数据!A1:S10",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 19,
});
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(check.ndjson);
console.log(errors.ndjson);
console.log(`EXPORTED:${outputPath}`);
