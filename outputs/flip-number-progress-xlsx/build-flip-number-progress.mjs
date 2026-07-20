import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const execFile = promisify(execFileCallback);
const outputDir = new URL(".", import.meta.url).pathname;
const outputPath = path.join(outputDir, "progress_bar_upload_ready.xlsx");
const previewPath = path.join(outputDir, "progress_bar_upload_ready_preview.png");
const inspectPath = path.join(outputDir, "progress_bar_upload_ready.inspect.ndjson");

const headers = [
  "businessDate",
  "month",
  "region",
  "revenue",
  "revenueTarget",
  "orders",
  "orderTarget",
  "activeUsers",
  "activeUsersTarget",
  "completionRate",
  "budgetUsed",
  "budgetTotal",
];

const rows = [
  [
    new Date("2026-06-01T00:00:00Z"),
    "2026-06",
    "全部",
    12280000,
    13010000,
    411600,
    442300,
    5538000,
    5538000,
    1,
    2880000,
    3200000,
  ],
];

const usedRangeRef = `A1:L${rows.length + 1}`;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripMainNamespacePrefix(xml) {
  return xml
    .replace(/<x:/g, "<")
    .replace(/<\/x:/g, "</")
    .replace(/xmlns:x=/g, "xmlns=");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const normalized = stripMainNamespacePrefix(xml);
  return Array.from(normalized.matchAll(/<si>([\s\S]*?)<\/si>/g), (match) => {
    const texts = Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (textMatch) => textMatch[1] ?? "");
    return texts.join("")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  });
}

function normalizeWorksheetXml(xml, sharedStrings) {
  let normalized = stripMainNamespacePrefix(xml);
  if (!normalized.includes("<dimension ")) {
    normalized = normalized.replace(/(<worksheet\b[^>]*>)/, `$1<dimension ref="${usedRangeRef}" />`);
  }

  normalized = normalized.replace(
    /<c\b([^>]*)\bt="s"([^>]*)><v>(\d+)<\/v><\/c>/g,
    (_match, beforeType, afterType, index) => {
      const attrs = [beforeType.trimEnd(), 't="inlineStr"', afterType.trim()].filter(Boolean).join(" ");
      return `<c ${attrs}><is><t>${escapeXml(sharedStrings[Number(index)] ?? "")}</t></is></c>`;
    },
  );

  return normalized.replace(
    /<c\b([^>]*)\bt="str"([^>]*)><v>([\s\S]*?)<\/v><\/c>/g,
    (_match, beforeType, afterType, value) => {
      const attrs = [beforeType.trimEnd(), 't="inlineStr"', afterType.trim()].filter(Boolean).join(" ");
      return `<c ${attrs}><is><t>${value}</t></is></c>`;
    },
  );
}

function firstAttribute(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}="([^"]*)"`).exec(xml)?.[1] ?? "";
}

function inlineStringValue(cellXml) {
  return Array.from(cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (match) => match[1] ?? "").join("")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function fragileRows(sheetXml) {
  return Array.from(sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), (rowMatch) => (
    Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g), (cellMatch) => {
      const attrs = cellMatch[1] ?? "";
      const cellXml = cellMatch[2] ?? "";
      if (attrs.includes('t="inlineStr"')) return inlineStringValue(cellXml).trim();
      return (/<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1] ?? "").trim();
    })
  )).filter((row) => row.some((value) => value.length > 0));
}

async function normalizeXlsxForUpload(xlsxPath) {
  const tmpDir = path.join(outputDir, ".tmp-flip-progress-xlsx");
  const tmpXlsx = path.join(outputDir, ".flip_number_progress_upload_ready.tmp.xlsx");
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.rm(tmpXlsx, { force: true });
  await fs.mkdir(tmpDir, { recursive: true });
  await execFile("unzip", ["-q", xlsxPath, "-d", tmpDir]);

  const workbookPath = path.join(tmpDir, "xl", "workbook.xml");
  const workbookRelsPath = path.join(tmpDir, "xl", "_rels", "workbook.xml.rels");
  const sharedStringsPath = path.join(tmpDir, "xl", "sharedStrings.xml");
  const sheetPath = path.join(tmpDir, "xl", "worksheets", "sheet1.xml");
  const sharedStrings = parseSharedStrings(await fs.readFile(sharedStringsPath, "utf8").catch(() => ""));

  for (const xmlPath of [workbookPath, path.join(tmpDir, "xl", "styles.xml"), sharedStringsPath]) {
    const xml = await fs.readFile(xmlPath, "utf8").catch(() => "");
    if (xml) await fs.writeFile(xmlPath, stripMainNamespacePrefix(xml), "utf8");
  }

  const workbookRelsXml = await fs.readFile(workbookRelsPath, "utf8");
  await fs.writeFile(workbookRelsPath, workbookRelsXml.replace(/Target="\/xl\/([^"]+)"/g, 'Target="$1"'), "utf8");

  const sheetXml = await fs.readFile(sheetPath, "utf8");
  await fs.writeFile(sheetPath, normalizeWorksheetXml(sheetXml, sharedStrings), "utf8");

  await execFile("zip", ["-q", "-r", tmpXlsx, "."], { cwd: tmpDir });
  await fs.rename(tmpXlsx, xlsxPath);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

async function assertUploadParserFriendly(xlsxPath) {
  const tmpDir = path.join(outputDir, ".tmp-flip-progress-verify");
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });
  await execFile("unzip", ["-q", xlsxPath, "-d", tmpDir]);

  const workbookXml = await fs.readFile(path.join(tmpDir, "xl", "workbook.xml"), "utf8");
  const workbookRelsXml = await fs.readFile(path.join(tmpDir, "xl", "_rels", "workbook.xml.rels"), "utf8");
  const firstSheet = /<sheet\b[^>]*\/?>/.exec(workbookXml)?.[0] ?? "";
  const relationshipId = firstAttribute(firstSheet, "r:id");
  const sheetRelationship = Array.from(workbookRelsXml.matchAll(/<Relationship\b[^>]*\/?>/g), (match) => match[0])
    .find((relationship) => firstAttribute(relationship, "Id") === relationshipId);
  const target = firstAttribute(sheetRelationship ?? "", "Target");
  const sheetPath = target.startsWith("/") ? target.slice(1) : path.join("xl", target);
  const sheetXml = await fs.readFile(path.join(tmpDir, sheetPath), "utf8");
  const rowsForFragileParser = fragileRows(sheetXml);

  await fs.rm(tmpDir, { recursive: true, force: true });

  if (!sheetXml.includes("<sheetData") || rowsForFragileParser.length === 0) {
    throw new Error("兼容性校验失败：简化解析器无法读取 sheetData/row");
  }
  if (rowsForFragileParser[0].join("|") !== headers.join("|")) {
    throw new Error(`兼容性校验失败：首行字段不匹配：${rowsForFragileParser[0].join(",")}`);
  }
  if (rowsForFragileParser.length !== rows.length + 1) {
    throw new Error(`兼容性校验失败：行数不匹配：${rowsForFragileParser.length}`);
  }
}

const workbook = Workbook.create();
const dataSheet = workbook.worksheets.add("Data");
const mappingSheet = workbook.worksheets.add("Component Mapping");
const guideSheet = workbook.worksheets.add("Guide");

dataSheet.showGridLines = false;
dataSheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).values = [headers, ...rows];
dataSheet.getRange("A1:L1").format.fill.color = "#EEF4FF";
dataSheet.getRange("A1:L1").format.font.bold = true;
dataSheet.getRange("A1:L1").format.font.color = "#1D3557";
dataSheet.getRange("A1:L1").format.borders = { preset: "bottom", style: "thin", color: "#BFD4FF" };
dataSheet.getRange(`A2:A${rows.length + 1}`).setNumberFormat("yyyy-mm-dd");
dataSheet.getRange(`D2:I${rows.length + 1}`).setNumberFormat("#,##0");
dataSheet.getRange(`J2:J${rows.length + 1}`).setNumberFormat("0.0%");
dataSheet.getRange(`K2:L${rows.length + 1}`).setNumberFormat("#,##0");
dataSheet.getRange("A:L").format.autofitColumns();
dataSheet.freezePanes.freezeRows(1);

const mappingHeaders = ["component", "componentType", "dataset", "slot", "fieldKey", "aggregation", "recommendedProps"];
const mappingRows = [
  ["总收入翻牌器", "flipNumber", "Data", "measure", "revenue", "sum", "prefix=¥, decimals=0"],
  ["订单翻牌器", "flipNumber", "Data", "measure", "orders", "sum", "suffix=单, decimals=0"],
  ["活跃用户翻牌器", "flipNumber", "Data", "measure", "activeUsers", "sum", "suffix=人, decimals=0"],
  ["核心指标进度", "progressBar", "Data", "measure", "revenue", "sum", "decimals=1, showValue=true"],
  ["核心指标进度", "progressBar", "Data", "measure", "revenueTarget", "sum", "不绑定 target 时目标默认等于实际值"],
  ["核心指标进度", "progressBar", "Data", "measure", "orders", "sum", "每个 measure 生成一条进度"],
  ["核心指标进度", "progressBar", "Data", "measure", "orderTarget", "sum", "推荐双列布局展示"],
  ["核心指标进度", "progressBar", "Data", "measure", "activeUsers", "sum", "可继续追加更多数值指标"],
];
mappingSheet.showGridLines = false;
mappingSheet.getRangeByIndexes(0, 0, 1, mappingHeaders.length).values = [mappingHeaders];
mappingSheet.getRangeByIndexes(1, 0, mappingRows.length, mappingHeaders.length).values = mappingRows;
mappingSheet.tables.add(`A1:G${mappingRows.length + 1}`, true, "FlipProgressMapping");
mappingSheet.getRange("A1:G1").format.fill.color = "#EAF2FF";
mappingSheet.getRange("A1:G1").format.font.bold = true;
mappingSheet.getRange("A:G").format.autofitColumns();
mappingSheet.freezePanes.freezeRows(1);

guideSheet.showGridLines = false;
guideSheet.getRange("A1:F1").merge();
guideSheet.getRange("A1").values = [["多指标进度条 XLSX 数据源"]];
guideSheet.getRange("A1").format.font = { bold: true, color: "#0F172A", size: 18 };
guideSheet.getRange("A3:F3").values = [["图表", "绑定方式", "字段示例", "聚合", "展示重点", "备注"]];
guideSheet.getRange("A4:F8").values = [
  ["翻牌器", "measure", "revenue / orders / activeUsers", "sum", "突出单个聚合指标", "适合顶部核心数字"],
  ["进度条", "measure 多选", "revenue / revenueTarget / orders / orderTarget / activeUsers", "sum", "多个指标各生成一条进度", "不绑定 target 时每条进度默认 100.0%"],
  ["进度条", "measure + target", "revenue + revenueTarget", "sum", "真实目标完成率", "target 会按顺序与 measure 配对"],
  ["进度条", "measure + target", "orders + orderTarget", "sum", "订单目标达成", "showValue=true 时显示 实际 / 目标"],
  ["进度条", "measure + target", "budgetUsed + budgetTotal", "sum", "预算使用进度", "适合目标消耗类指标"],
];
guideSheet.tables.add("A3:F8", true, "FlipProgressGuide");
guideSheet.getRange("A3:F3").format.fill.color = "#EAF2FF";
guideSheet.getRange("A3:F3").format.font.bold = true;
guideSheet.getRange("A:F").format.wrapText = true;
guideSheet.getRange("A:F").format.autofitColumns();

const inspect = await workbook.inspect({
  kind: "sheet,table,region",
  sheetId: "Data",
  range: "A1:L2",
  maxChars: 5000,
  tableMaxRows: 8,
  tableMaxCols: 12,
});
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "upload-ready formula error scan",
});
await fs.writeFile(inspectPath, `${inspect.ndjson}\n${errors.ndjson}\n`, "utf8");

const preview = await workbook.render({ sheetName: "Data", range: "A1:L2", scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
await normalizeXlsxForUpload(outputPath);
await assertUploadParserFriendly(outputPath);

console.log(JSON.stringify({
  outputPath,
  previewPath,
  inspectPath,
  rows: rows.length,
  headers,
}, null, 2));
