import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL(".", import.meta.url).pathname;

const baseFormat = {
  font: { name: "Aptos", size: 11, color: "#1E293B" },
  verticalAlignment: "center",
};

const styleDatasetSheet = (sheet, headerRange, dataRange, widths) => {
  sheet.showGridLines = false;
  sheet.getUsedRange().format = baseFormat;
  headerRange.format = {
    fill: "#155EEF",
    font: { name: "Aptos", size: 11, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  headerRange.format.rowHeight = 24;
  dataRange.format = { ...baseFormat, borders: { bottom: { style: "thin", color: "#E2E8F0" } } };
  widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width; });
  sheet.freezePanes.freezeRows(1);
};

const buildRingBarWorkbook = async () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("环形柱图数据");
  const rows = [
    ["区域", "实际销售额", "销售目标"],
    ["华东", 825000, 1000000],
    ["华北", 732000, 900000],
    ["华南", 648000, 800000],
    ["华中", 536000, 700000],
    ["西南", 412000, 600000],
    ["西北", 286000, 450000],
  ];
  sheet.getRange("A1:C7").values = rows;
  styleDatasetSheet(sheet, sheet.getRange("A1:C1"), sheet.getRange("A2:C7"), [18, 18, 18]);
  sheet.getRange("B2:C7").format.numberFormat = "#,##0";
  sheet.tables.add("A1:C7", true, "RingBarData").style = "TableStyleMedium2";

  const guide = workbook.worksheets.add("使用说明");
  guide.showGridLines = false;
  guide.getRange("A1:B5").values = [
    ["环形柱图数据模板", ""],
    ["图表绑定", "分组维度 = 区域；实际值 = 实际销售额；目标值 = 销售目标"],
    ["数据规则", "每行代表一个分组，实际值与目标值必须为数值。"],
    ["兼容性", "仅使用标准 XLSX 单元格、表格和基础格式，可用于 Excel、WPS 及系统导入。"],
    ["导入提示", "请保留第一个工作表的首行字段名；系统将读取该工作表。"],
  ];
  guide.mergeCells("A1:B1");
  guide.getRange("A1:B1").format = { fill: "#0F172A", font: { name: "Aptos Display", size: 14, bold: true, color: "#FFFFFF" }, horizontalAlignment: "left", verticalAlignment: "center" };
  guide.getRange("A1:B1").format.rowHeight = 30;
  guide.getRange("A2:A5").format = { fill: "#EFF6FF", font: { bold: true, color: "#1D4ED8" }, verticalAlignment: "center" };
  guide.getRange("A2:B5").format = { ...baseFormat, wrapText: true, borders: { bottom: { style: "thin", color: "#E2E8F0" } } };
  guide.getRange("A1").format.columnWidth = 18;
  guide.getRange("B1").format.columnWidth = 70;
  guide.getRange("A2:B5").format.rowHeight = 32;
  return workbook;
};

const buildRankingWorkbook = async () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("排行榜数据");
  const rows = [
    ["产品线", "销售额"],
    ["智能家居", 1286000],
    ["移动设备", 1168000],
    ["办公设备", 982000],
    ["数码配件", 864000],
    ["家庭影音", 756000],
    ["健康电器", 692000],
    ["厨房电器", 638000],
    ["清洁电器", 574000],
    ["照明产品", 486000],
    ["其他", 328000],
  ];
  sheet.getRange("A1:B11").values = rows;
  styleDatasetSheet(sheet, sheet.getRange("A1:B1"), sheet.getRange("A2:B11"), [22, 18]);
  sheet.getRange("B2:B11").format.numberFormat = "#,##0";
  sheet.tables.add("A1:B11", true, "RankingData").style = "TableStyleMedium2";

  const guide = workbook.worksheets.add("使用说明");
  guide.showGridLines = false;
  guide.getRange("A1:B5").values = [
    ["排行榜数据模板", ""],
    ["图表绑定", "排名维度 = 产品线；排名指标 = 销售额"],
    ["排序规则", "组件会按指标由高到低自动排序，并显示序号。"],
    ["兼容性", "仅使用标准 XLSX 单元格、表格和基础格式，可用于 Excel、WPS 及系统导入。"],
    ["导入提示", "请保留第一个工作表的首行字段名；系统将读取该工作表。"],
  ];
  guide.mergeCells("A1:B1");
  guide.getRange("A1:B1").format = { fill: "#0F172A", font: { name: "Aptos Display", size: 14, bold: true, color: "#FFFFFF" }, horizontalAlignment: "left", verticalAlignment: "center" };
  guide.getRange("A1:B1").format.rowHeight = 30;
  guide.getRange("A2:A5").format = { fill: "#EFF6FF", font: { bold: true, color: "#1D4ED8" }, verticalAlignment: "center" };
  guide.getRange("A2:B5").format = { ...baseFormat, wrapText: true, borders: { bottom: { style: "thin", color: "#E2E8F0" } } };
  guide.getRange("A1").format.columnWidth = 18;
  guide.getRange("B1").format.columnWidth = 70;
  guide.getRange("A2:B5").format.rowHeight = 32;
  return workbook;
};

const exportAndVerify = async (workbook, fileName, sheetName, range) => {
  const check = await workbook.inspect({ kind: "table", range: `${sheetName}!${range}`, include: "values,formulas", tableMaxRows: 20, tableMaxCols: 8 });
  console.log(check.ndjson);
  const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula error scan" });
  console.log(errors.ndjson);
  const preview = await workbook.render({ sheetName, range, scale: 1.5, format: "png" });
  await fs.writeFile(`${outputDir}/${fileName}.preview.png`, new Uint8Array(await preview.arrayBuffer()));
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(`${outputDir}/${fileName}`);
};

await fs.mkdir(outputDir, { recursive: true });
await exportAndVerify(await buildRingBarWorkbook(), "环形柱图数据模板.xlsx", "环形柱图数据", "A1:C7");
await exportAndVerify(await buildRankingWorkbook(), "排行榜数据模板.xlsx", "排行榜数据", "A1:B11");
