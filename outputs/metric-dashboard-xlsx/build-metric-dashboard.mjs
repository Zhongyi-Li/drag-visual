import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const execFile = promisify(execFileCallback);
const outputDir = new URL(".", import.meta.url).pathname;
const outputPath = path.join(outputDir, "metric_dashboard_sample.xlsx");
const uploadReadyPath = path.join(outputDir, "metric_dashboard_upload_ready.xlsx");
const previewPath = path.join(outputDir, "metric_dashboard_sample_preview.png");
const uploadPreviewPath = path.join(outputDir, "metric_dashboard_upload_ready_preview.png");
const inspectPath = path.join(outputDir, "metric_dashboard_sample.inspect.ndjson");
const uploadInspectPath = path.join(outputDir, "metric_dashboard_upload_ready.inspect.ndjson");

function columnName(index) {
  let value = index;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function normalizeWorksheetXml(xml, usedRangeRef) {
  let normalized = xml
    .replace(/<x:/g, "<")
    .replace(/<\/x:/g, "</")
    .replace(/xmlns:x=/g, "xmlns=");

  if (!normalized.includes("<dimension ")) {
    normalized = normalized.replace(
      /(<worksheet\b[^>]*>)/,
      `$1<dimension ref="${usedRangeRef}" />`,
    );
  }

  return normalized.replace(
    /<c\b([^>]*)\bt="str"([^>]*)><v>([\s\S]*?)<\/v><\/c>/g,
    (_match, beforeType, afterType, value) => {
      const before = beforeType.trimEnd();
      const after = afterType.trim();
      const attrs = [before, 't="inlineStr"', after].filter(Boolean).join(" ");
      return `<c ${attrs}><is><t>${value}</t></is></c>`;
    },
  );
}

async function makeParserFriendlyXlsx(xlsxPath, usedRangeRef) {
  const base = path.basename(xlsxPath, ".xlsx");
  const tmpDir = path.join(outputDir, `.tmp-${base}`);
  const tmpXlsx = path.join(outputDir, `.${base}.tmp.xlsx`);

  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.rm(tmpXlsx, { force: true });
  await fs.mkdir(tmpDir, { recursive: true });
  await execFile("unzip", ["-q", xlsxPath, "-d", tmpDir]);

  const workbookPath = path.join(tmpDir, "xl", "workbook.xml");
  const sheetPath = path.join(tmpDir, "xl", "worksheets", "sheet1.xml");
  const stylesPath = path.join(tmpDir, "xl", "styles.xml");
  const sharedStringsPath = path.join(tmpDir, "xl", "sharedStrings.xml");

  for (const xmlPath of [workbookPath, stylesPath, sharedStringsPath]) {
    let xml = await fs.readFile(xmlPath, "utf8");
    xml = xml.replace(/<x:/g, "<").replace(/<\/x:/g, "</").replace(/xmlns:x=/g, "xmlns=");
    await fs.writeFile(xmlPath, xml, "utf8");
  }

  const sheetXml = await fs.readFile(sheetPath, "utf8");
  await fs.writeFile(sheetPath, normalizeWorksheetXml(sheetXml, usedRangeRef), "utf8");

  await execFile("zip", ["-q", "-r", tmpXlsx, "."], { cwd: tmpDir });
  await fs.rename(tmpXlsx, xlsxPath);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

const workbook = Workbook.create();
const dataSheet = workbook.worksheets.add("Data");
const mappingSheet = workbook.worksheets.add("Metric Mapping");
const guideSheet = workbook.worksheets.add("Dashboard Guide");

const months = [
  { date: new Date(Date.UTC(2026, 0, 1)), label: "2026-01", weight: 0.92 },
  { date: new Date(Date.UTC(2026, 1, 1)), label: "2026-02", weight: 0.98 },
  { date: new Date(Date.UTC(2026, 2, 1)), label: "2026-03", weight: 1.04 },
  { date: new Date(Date.UTC(2026, 3, 1)), label: "2026-04", weight: 1.09 },
  { date: new Date(Date.UTC(2026, 4, 1)), label: "2026-05", weight: 1.16 },
  { date: new Date(Date.UTC(2026, 5, 1)), label: "2026-06", weight: 1.22 },
];
const regions = [
  { name: "华东", weight: 1.18 },
  { name: "华南", weight: 1.08 },
  { name: "华北", weight: 0.96 },
  { name: "西南", weight: 0.82 },
];
const categories = [
  { name: "硬件", weight: 1.2, aov: 520 },
  { name: "软件", weight: 0.95, aov: 268 },
  { name: "服务", weight: 0.72, aov: 188 },
];
const channels = [
  { name: "官网", weight: 1.16, conversion: 0.083 },
  { name: "电商", weight: 1.04, conversion: 0.071 },
  { name: "门店", weight: 0.92, conversion: 0.058 },
  { name: "伙伴", weight: 0.78, conversion: 0.047 },
];

const headers = [
  "businessDate",
  "month",
  "region",
  "category",
  "channel",
  "revenue",
  "revenueTarget",
  "priorRevenue",
  "orders",
  "orderTarget",
  "priorOrders",
  "conversionRate",
  "conversionTarget",
  "priorConversionRate",
  "averageOrderValue",
  "aovTarget",
  "priorAov",
];

const rows = [];
months.forEach((month, monthIndex) => {
  regions.forEach((region, regionIndex) => {
    categories.forEach((category, categoryIndex) => {
      channels.forEach((channel, channelIndex) => {
        const base = 88000 + regionIndex * 4600 + categoryIndex * 7200 + channelIndex * 3100;
        const revenue = Math.round(base * month.weight * region.weight * category.weight * channel.weight);
        const revenueTarget = Math.round(revenue * (1.06 + (categoryIndex % 2) * 0.025));
        const priorRevenue = Math.round(revenue / (1.08 + monthIndex * 0.012 - channelIndex * 0.004));
        const averageOrderValue = Math.round(category.aov * (0.94 + month.weight * 0.06 + regionIndex * 0.015));
        const orders = Math.max(1, Math.round(revenue / averageOrderValue));
        const orderTarget = Math.round(orders * 1.08);
        const priorOrders = Math.round(orders / (1.04 + monthIndex * 0.01));
        const conversionRate = Number((channel.conversion * (0.96 + month.weight * 0.08 + region.weight * 0.025)).toFixed(4));
        const conversionTarget = Number((conversionRate + 0.006 + categoryIndex * 0.001).toFixed(4));
        const priorConversionRate = Number(Math.max(0.01, conversionRate - 0.004 - monthIndex * 0.0004).toFixed(4));
        const aovTarget = Math.round(averageOrderValue * 1.04);
        const priorAov = Math.round(averageOrderValue * (0.96 + channelIndex * 0.006));
        rows.push([
          month.date,
          month.label,
          region.name,
          category.name,
          channel.name,
          revenue,
          revenueTarget,
          priorRevenue,
          orders,
          orderTarget,
          priorOrders,
          conversionRate,
          conversionTarget,
          priorConversionRate,
          averageOrderValue,
          aovTarget,
          priorAov,
        ]);
      });
    });
  });
});

dataSheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
dataSheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
dataSheet.tables.add(`A1:Q${rows.length + 1}`, true, "MetricDashboardData");
dataSheet.freezePanes.freezeRows(1);
dataSheet.showGridLines = false;
dataSheet.getRange("A1:Q1").format.fill = { color: "#16324F" };
dataSheet.getRange("A1:Q1").format.font = { color: "#FFFFFF", bold: true };
dataSheet.getRange("A:Q").format.font = { name: "Aptos", size: 10 };
dataSheet.getRange("A:A").setNumberFormat("yyyy-mm-dd");
dataSheet.getRange("F:H").setNumberFormat("#,##0");
dataSheet.getRange("I:K").setNumberFormat("#,##0");
dataSheet.getRange("L:N").setNumberFormat("0.0%");
dataSheet.getRange("O:Q").setNumberFormat("#,##0");
dataSheet.getRange("A:Q").format.autofitColumns();

const mappingHeaders = ["dashboardComponent", "componentType", "dataset", "slot", "fieldKey", "aggregation", "recommendedProps"];
const mappingRows = [
  ["总收入", "kpi", "Data", "measure", "revenue", "sum", "prefix=¥, decimals=0"],
  ["总收入", "kpi", "Data", "target", "revenueTarget", "sum", "target progress"],
  ["总收入", "kpi", "Data", "comparison", "priorRevenue", "sum", "comparison change"],
  ["订单数", "kpi", "Data", "measure", "orders", "sum", "suffix=单, decimals=0"],
  ["订单数", "kpi", "Data", "target", "orderTarget", "sum", "target progress"],
  ["订单数", "kpi", "Data", "comparison", "priorOrders", "sum", "comparison change"],
  ["转化率", "kpi", "Data", "measure", "conversionRate", "avg", "suffix=%, decimals=1"],
  ["转化率", "kpi", "Data", "target", "conversionTarget", "avg", "target progress"],
  ["转化率", "kpi", "Data", "comparison", "priorConversionRate", "avg", "comparison change"],
  ["客单价", "kpi", "Data", "measure", "averageOrderValue", "avg", "prefix=¥, decimals=0"],
  ["客单价", "kpi", "Data", "target", "aovTarget", "avg", "target progress"],
  ["客单价", "kpi", "Data", "comparison", "priorAov", "avg", "comparison change"],
  ["月度收入趋势", "trend", "Data", "timeDimension", "businessDate", "sum", "timeGranularity=month"],
  ["月度收入趋势", "trend", "Data", "measure", "revenue", "sum", "showSummary=true"],
  ["地区收入排行", "bar", "Data", "dimension", "region", "sum", "measure=revenue"],
  ["渠道收入占比", "pie", "Data", "dimension", "channel", "sum", "measure=revenue"],
  ["品类地区交叉表", "crosstab", "Data", "rowDimension", "region", "sum", "measure=revenue"],
  ["品类地区交叉表", "crosstab", "Data", "columnDimension", "category", "sum", "showTotals=true"],
];
mappingSheet.getRangeByIndexes(0, 0, 1, mappingHeaders.length).values = [mappingHeaders];
mappingSheet.getRangeByIndexes(1, 0, mappingRows.length, mappingHeaders.length).values = mappingRows;
mappingSheet.tables.add(`A1:G${mappingRows.length + 1}`, true, "MetricDashboardMapping");
mappingSheet.freezePanes.freezeRows(1);
mappingSheet.showGridLines = false;
mappingSheet.getRange("A1:G1").format.fill = { color: "#245996" };
mappingSheet.getRange("A1:G1").format.font = { color: "#FFFFFF", bold: true };
mappingSheet.getRange("A:G").format.font = { name: "Aptos", size: 10 };
mappingSheet.getRange("A:G").format.autofitColumns();

guideSheet.showGridLines = false;
guideSheet.getRange("A1:H1").merge();
guideSheet.getRange("A1").values = [["指标看板 XLSX 数据源"]];
guideSheet.getRange("A1").format.font = { bold: true, color: "#0F172A", size: 18 };
guideSheet.getRange("A3:H3").values = [["看板区域", "推荐组件", "绑定说明", "字段", "聚合", "目标/对比", "预期图表用途", "备注"]];
guideSheet.getRange("A4:H10").values = [
  ["顶部指标", "kpi", "主指标 + target + comparison", "revenue / revenueTarget / priorRevenue", "sum", "目标达成、较对比", "总收入指标卡", "prefix=¥"],
  ["顶部指标", "kpi", "主指标 + target + comparison", "orders / orderTarget / priorOrders", "sum", "目标达成、较对比", "订单数指标卡", "suffix=单"],
  ["顶部指标", "kpi", "主指标 + target + comparison", "conversionRate / conversionTarget / priorConversionRate", "avg", "目标达成、较对比", "转化率指标卡", "百分比字段"],
  ["顶部指标", "kpi", "主指标 + target + comparison", "averageOrderValue / aovTarget / priorAov", "avg", "目标达成、较对比", "客单价指标卡", "prefix=¥"],
  ["趋势区", "trend", "timeDimension + measure", "businessDate + revenue", "sum", "无", "月度收入趋势", "timeGranularity=month"],
  ["结构区", "bar / pie", "dimension + measure", "region/channel + revenue", "sum", "无", "地区排行、渠道占比", "用于组合看板中段"],
  ["明细区", "table / crosstab", "columns 或 row/column/measure", "region/category/revenue", "sum", "无", "业务明细与交叉分析", "用于下钻查看"],
];
guideSheet.tables.add("A3:H10", true, "DashboardGuide");
guideSheet.getRange("A3:H3").format.fill = { color: "#EAF2FF" };
guideSheet.getRange("A3:H3").format.font = { bold: true, color: "#0F172A" };
guideSheet.getRange("A:H").format.font = { name: "Aptos", size: 10 };
guideSheet.getRange("A:H").format.wrapText = true;
guideSheet.getRange("A:H").format.autofitColumns();
guideSheet.getRange("A4:H10").format.borders = { preset: "inside", style: "thin", color: "#D9E2EF" };

const dataInspect = await workbook.inspect({
  kind: "table",
  sheetId: "Data",
  range: "A1:Q8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 17,
});
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
await fs.writeFile(inspectPath, `${dataInspect.ndjson}\n${formulaErrors.ndjson}\n`, "utf8");

const preview = await workbook.render({ sheetName: "Dashboard Guide", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const uploadWorkbook = Workbook.create();
const uploadSheet = uploadWorkbook.worksheets.add("Data");
uploadSheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
uploadSheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
uploadSheet.freezePanes.freezeRows(1);
uploadSheet.showGridLines = false;
uploadSheet.getRange("A1:Q1").format.fill = { color: "#EAF2FF" };
uploadSheet.getRange("A1:Q1").format.font = { color: "#0F172A", bold: true };
uploadSheet.getRange("A:Q").format.font = { name: "Aptos", size: 10 };
uploadSheet.getRange(`A2:A${rows.length + 1}`).setNumberFormat("yyyy-mm-dd");
uploadSheet.getRange(`F2:H${rows.length + 1}`).setNumberFormat("#,##0");
uploadSheet.getRange(`I2:K${rows.length + 1}`).setNumberFormat("#,##0");
uploadSheet.getRange(`L2:N${rows.length + 1}`).setNumberFormat("0.0%");
uploadSheet.getRange(`O2:Q${rows.length + 1}`).setNumberFormat("#,##0");
uploadSheet.getRange("A:Q").format.autofitColumns();

const uploadInspect = await uploadWorkbook.inspect({
  kind: "workbook,sheet,table",
  sheetId: "Data",
  range: "A1:Q8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 17,
});
const uploadErrors = await uploadWorkbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "upload-ready formula error scan",
});
await fs.writeFile(uploadInspectPath, `${uploadInspect.ndjson}\n${uploadErrors.ndjson}\n`, "utf8");

const uploadPreview = await uploadWorkbook.render({ sheetName: "Data", range: "A1:Q12", scale: 1, format: "png" });
await fs.writeFile(uploadPreviewPath, new Uint8Array(await uploadPreview.arrayBuffer()));

const uploadOutput = await SpreadsheetFile.exportXlsx(uploadWorkbook);
await uploadOutput.save(uploadReadyPath);
await uploadOutput.save(outputPath);

const usedRangeRef = `A1:${columnName(headers.length)}${rows.length + 1}`;
await makeParserFriendlyXlsx(uploadReadyPath, usedRangeRef);
await makeParserFriendlyXlsx(outputPath, usedRangeRef);

console.log(JSON.stringify({
  outputPath,
  uploadReadyPath,
  previewPath,
  uploadPreviewPath,
  inspectPath,
  uploadInspectPath,
  rows: rows.length,
}, null, 2));
