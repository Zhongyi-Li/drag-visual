import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const execFile = promisify(execFileCallback);
const outputDir = new URL(".", import.meta.url).pathname;
const outputPath = path.join(outputDir, "metric_trend_upload_ready.xlsx");
const previewPath = path.join(outputDir, "metric_trend_upload_ready_preview.png");
const inspectPath = path.join(outputDir, "metric_trend_upload_ready.inspect.ndjson");
const usedRangeRef = "A1:M19";

const headers = [
  "businessDate",
  "month",
  "region",
  "channel",
  "revenue",
  "revenueTarget",
  "priorRevenue",
  "orders",
  "orderTarget",
  "conversionRate",
  "activeUsers",
  "retentionRate",
  "averageOrderValue",
];

const monthlyRows = [
  ["2025-01-01", "2025-01", 386200, 405000, 352800, 12640, 13200, 0.041, 182400, 0.358],
  ["2025-02-01", "2025-02", 401800, 418000, 367500, 13210, 13650, 0.043, 188900, 0.361],
  ["2025-03-01", "2025-03", 419600, 430000, 386900, 13980, 14100, 0.045, 195500, 0.367],
  ["2025-04-01", "2025-04", 436500, 448000, 402100, 14630, 14900, 0.046, 203600, 0.371],
  ["2025-05-01", "2025-05", 452700, 468000, 418400, 15220, 15600, 0.048, 211800, 0.376],
  ["2025-06-01", "2025-06", 471900, 486000, 435200, 15840, 16200, 0.049, 219300, 0.382],
  ["2025-07-01", "2025-07", 489400, 505000, 450100, 16490, 16900, 0.051, 227500, 0.388],
  ["2025-08-01", "2025-08", 507600, 524000, 468900, 17130, 17600, 0.052, 236100, 0.394],
  ["2025-09-01", "2025-09", 526800, 542000, 486200, 17840, 18300, 0.053, 244800, 0.398],
  ["2025-10-01", "2025-10", 548300, 565000, 506700, 18620, 19100, 0.055, 254600, 0.405],
  ["2025-11-01", "2025-11", 571400, 588000, 528800, 19460, 19900, 0.057, 265200, 0.411],
  ["2025-12-01", "2025-12", 604800, 620000, 559300, 20740, 21100, 0.059, 279500, 0.418],
  ["2026-01-01", "2026-01", 434200, 463900, 404100, 14730, 15910, 0.044, 198700, 0.372],
  ["2026-02-01", "2026-02", 462500, 494100, 425700, 15640, 16890, 0.047, 210400, 0.381],
  ["2026-03-01", "2026-03", 490800, 524400, 446800, 16550, 17870, 0.049, 222600, 0.389],
  ["2026-04-01", "2026-04", 523600, 551300, 476900, 17420, 18720, 0.051, 235800, 0.397],
  ["2026-05-01", "2026-05", 558900, 587500, 503200, 18580, 19860, 0.054, 249900, 0.406],
  ["2026-06-01", "2026-06", 592400, 624000, 536700, 19730, 21040, 0.056, 263700, 0.414],
];

const regions = ["华东", "华北", "华南"];
const channels = ["直营", "线上", "渠道"];

const rows = monthlyRows.map(([
  date,
  month,
  revenue,
  revenueTarget,
  priorRevenue,
  orders,
  orderTarget,
  conversionRate,
  activeUsers,
  retentionRate,
], index) => [
  new Date(`${date}T00:00:00Z`),
  month,
  regions[index % regions.length],
  channels[(index + 1) % channels.length],
  revenue,
  revenueTarget,
  priorRevenue,
  orders,
  orderTarget,
  conversionRate,
  activeUsers,
  retentionRate,
  Math.round((revenue / orders) * 100) / 100,
]);

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
  const tmpDir = path.join(outputDir, ".tmp-metric-trend-xlsx");
  const tmpXlsx = path.join(outputDir, ".metric_trend_upload_ready.tmp.xlsx");
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.rm(tmpXlsx, { force: true });
  await fs.mkdir(tmpDir, { recursive: true });
  await execFile("unzip", ["-q", xlsxPath, "-d", tmpDir]);

  const workbookPath = path.join(tmpDir, "xl", "workbook.xml");
  const workbookRelsPath = path.join(tmpDir, "xl", "_rels", "workbook.xml.rels");
  const sharedStringsPath = path.join(tmpDir, "xl", "sharedStrings.xml");
  const sheetPath = path.join(tmpDir, "xl", "worksheets", "sheet1.xml");

  const sharedStrings = parseSharedStrings(await fs.readFile(sharedStringsPath, "utf8").catch(() => ""));

  for (const xmlPath of [
    workbookPath,
    path.join(tmpDir, "xl", "styles.xml"),
    sharedStringsPath,
  ]) {
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
  const tmpDir = path.join(outputDir, ".tmp-metric-trend-verify");
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
const sheet = workbook.worksheets.add("metric_trend_upload_ready");
sheet.showGridLines = false;
sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).values = [headers, ...rows];
sheet.getRangeByIndexes(0, 0, 1, headers.length).format.fill.color = "#EEF4FF";
sheet.getRangeByIndexes(0, 0, 1, headers.length).format.font.bold = true;
sheet.getRangeByIndexes(0, 0, 1, headers.length).format.font.color = "#1D3557";
sheet.getRangeByIndexes(0, 0, 1, headers.length).format.borders = { preset: "bottom", style: "thin", color: "#BFD4FF" };
sheet.getRangeByIndexes(1, 0, rows.length, 1).setNumberFormat("yyyy-mm-dd");
sheet.getRangeByIndexes(1, 4, rows.length, 5).setNumberFormat("#,##0");
sheet.getRangeByIndexes(1, 9, rows.length, 1).setNumberFormat("0.0%");
sheet.getRangeByIndexes(1, 11, rows.length, 1).setNumberFormat("0.0%");
sheet.getRangeByIndexes(1, 12, rows.length, 1).setNumberFormat("#,##0.00");
sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).format.autofitColumns();
sheet.freezePanes.freezeRows(1);

const inspect = await workbook.inspect({
  kind: "sheet,table,region",
  sheetId: "metric_trend_upload_ready",
  range: "A1:M8",
  maxChars: 5000,
  tableMaxRows: 8,
  tableMaxCols: 13,
});
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "upload-ready formula error scan",
});
await fs.writeFile(inspectPath, `${inspect.ndjson}\n${errors.ndjson}\n`, "utf8");

const preview = await workbook.render({ sheetName: "metric_trend_upload_ready", autoCrop: "all", scale: 1, format: "png" });
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
