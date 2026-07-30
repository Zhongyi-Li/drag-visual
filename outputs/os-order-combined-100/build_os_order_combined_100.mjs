import fs from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import mysql from "../../apps/api/node_modules/mysql2/promise.js";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(scriptDir, "../..");
const outputPath = path.join(scriptDir, "os_order_combined_100_rows.xlsx");
const envPath = path.join(workspaceDir, ".env");
const execFile = promisify(execFileCallback);

const envText = await fs.readFile(envPath, "utf8");
const retailMysqlUrl = envText.match(/^RETAIL_MYSQL_URL=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
if (!retailMysqlUrl) throw new Error("RETAIL_MYSQL_URL is missing from .env");

const pool = mysql.createPool({ uri: retailMysqlUrl, dateStrings: true });
let columns;
let records;
try {
  [columns] = await pool.execute(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    ["os", "os_order_combined"],
  );
  [records] = await pool.query(
    "SELECT * FROM `os`.`os_order_combined` ORDER BY `order_time` DESC LIMIT 100",
  );
} finally {
  await pool.end();
}

if (records.length !== 100) throw new Error(`Expected 100 rows but received ${records.length}`);

const numericTypes = new Set(["decimal", "double", "float", "int", "integer", "mediumint", "smallint", "tinyint", "bigint"]);
const headers = columns.map(({ name }) => name);
const numericIndexes = columns.flatMap(({ dataType }, index) => numericTypes.has(dataType.toLowerCase()) ? [index] : []);
const textIndexes = columns.flatMap(({ dataType }, index) => numericTypes.has(dataType.toLowerCase()) ? [] : [index]);
const usedRangeRef = `A1:AM${records.length + 1}`;
const rows = records.map((record) => columns.map(({ name, dataType }) => {
  const value = record[name];
  if (value === null || value === undefined) return null;
  if (numericTypes.has(dataType.toLowerCase()) && typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  return value;
}));

const escapeXml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const stripMainNamespacePrefix = (xml) => xml
  .replace(/<x:/g, "<")
  .replace(/<\/x:/g, "</")
  .replace(/xmlns:x=/g, "xmlns=");

const parseSharedStrings = (xml) => {
  if (!xml) return [];
  const normalized = stripMainNamespacePrefix(xml);
  return Array.from(normalized.matchAll(/<si>([\s\S]*?)<\/si>/g), (match) =>
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (textMatch) => textMatch[1] ?? "").join("")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&"),
  );
};

const normalizeWorksheetXml = (xml, sharedStrings) => {
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
};

const firstAttribute = (xml, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}="([^"]*)"`).exec(xml)?.[1] ?? "";
};

const inlineStringValue = (cellXml) => Array.from(
  cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g),
  (match) => match[1] ?? "",
).join("")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&");

const fragileRows = (sheetXml) => Array.from(sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), (rowMatch) =>
  Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g), (cellMatch) => {
    const attrs = cellMatch[1] ?? "";
    const cellXml = cellMatch[2] ?? "";
    if (attrs.includes('t="inlineStr"')) return inlineStringValue(cellXml).trim();
    return (/<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1] ?? "").trim();
  }),
).filter((row) => row.some((value) => value.length > 0));

async function normalizeXlsxForUpload(xlsxPath) {
  const tempDir = path.join(scriptDir, ".tmp-os-order-combined-xlsx");
  const tempXlsx = path.join(scriptDir, ".os_order_combined_100_rows.tmp.xlsx");
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.rm(tempXlsx, { force: true });
  await fs.mkdir(tempDir, { recursive: true });
  await execFile("unzip", ["-q", xlsxPath, "-d", tempDir]);

  const workbookPath = path.join(tempDir, "xl", "workbook.xml");
  const workbookRelsPath = path.join(tempDir, "xl", "_rels", "workbook.xml.rels");
  const sharedStringsPath = path.join(tempDir, "xl", "sharedStrings.xml");
  const sheetPath = path.join(tempDir, "xl", "worksheets", "sheet1.xml");
  const sharedStrings = parseSharedStrings(await fs.readFile(sharedStringsPath, "utf8").catch(() => ""));

  for (const xmlPath of [workbookPath, path.join(tempDir, "xl", "styles.xml"), sharedStringsPath]) {
    const xml = await fs.readFile(xmlPath, "utf8").catch(() => "");
    if (xml) await fs.writeFile(xmlPath, stripMainNamespacePrefix(xml), "utf8");
  }
  const workbookRelsXml = await fs.readFile(workbookRelsPath, "utf8");
  await fs.writeFile(workbookRelsPath, workbookRelsXml.replace(/Target="\/xl\/([^"]+)"/g, 'Target="$1"'), "utf8");
  const sheetXml = await fs.readFile(sheetPath, "utf8");
  await fs.writeFile(sheetPath, normalizeWorksheetXml(sheetXml, sharedStrings), "utf8");

  await execFile("zip", ["-q", "-r", tempXlsx, "."], { cwd: tempDir });
  await fs.rename(tempXlsx, xlsxPath);
  await fs.rm(tempDir, { recursive: true, force: true });
}

async function assertUploadParserFriendly(xlsxPath) {
  const tempDir = path.join(scriptDir, ".tmp-os-order-combined-verify");
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });
  await execFile("unzip", ["-q", xlsxPath, "-d", tempDir]);
  const workbookXml = await fs.readFile(path.join(tempDir, "xl", "workbook.xml"), "utf8");
  const workbookRelsXml = await fs.readFile(path.join(tempDir, "xl", "_rels", "workbook.xml.rels"), "utf8");
  const firstSheet = /<sheet\b[^>]*\/?>/.exec(workbookXml)?.[0] ?? "";
  const relationshipId = firstAttribute(firstSheet, "r:id");
  const relationship = Array.from(workbookRelsXml.matchAll(/<Relationship\b[^>]*\/?>/g), (match) => match[0])
    .find((candidate) => firstAttribute(candidate, "Id") === relationshipId);
  const target = firstAttribute(relationship ?? "", "Target");
  const sheetPath = target.startsWith("/") ? target.slice(1) : path.join("xl", target);
  const sheetXml = await fs.readFile(path.join(tempDir, sheetPath), "utf8");
  const parsedRows = fragileRows(sheetXml);
  await fs.rm(tempDir, { recursive: true, force: true });

  if (!sheetXml.includes("<sheetData") || parsedRows.length !== rows.length + 1) {
    throw new Error("兼容性校验失败：BI 解析器无法读取完整的 sheetData");
  }
  if (parsedRows[0].join("|") !== headers.join("|")) {
    throw new Error("兼容性校验失败：BI 解析器无法读取首行字段");
  }
}

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("os_order_combined");
sheet.showGridLines = false;
for (const index of textIndexes) {
  sheet.getRangeByIndexes(0, index, rows.length + 1, 1).setNumberFormat("@");
}
sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).values = [headers, ...rows];
for (const [index, { name }] of columns.entries()) {
  if (name !== "order_no" && name !== "oms_shop_id") continue;
  sheet.getRangeByIndexes(1, index, rows.length, 1).setNumberFormat("0");
}

const tableRange = `A1:AM${rows.length + 1}`;
const table = sheet.tables.add(tableRange, true, "OrderCombined100");
table.style = "TableStyleMedium2";
sheet.freezePanes.freezeRows(1);
sheet.freezePanes.freezeColumns(3);

const headerRange = sheet.getRange("A1:AM1");
headerRange.format.fill.color = "#1F4E78";
headerRange.format.font = { bold: true, color: "#FFFFFF" };
headerRange.format.horizontalAlignment = "center";
headerRange.format.wrapText = true;
headerRange.format.rowHeight = 32;
sheet.getRange(`A2:AM${rows.length + 1}`).format.rowHeight = 20;

for (const index of numericIndexes) {
  sheet.getRangeByIndexes(1, index, rows.length, 1).setNumberFormat("#,##0.00####");
}
sheet.getRange(`A1:AM${rows.length + 1}`).format.verticalAlignment = "center";
sheet.getRange(`A2:E${rows.length + 1}`).format.horizontalAlignment = "left";

const widths = [20, 16, 20, 20, 10, 13, 13, 13, 13, 15, 13, 15, 13, 13, 15, 15, 18, 30, 10, 13, 15, 13, 13, 13, 13, 15, 13, 13, 15, 15, 13, 15, 18, 24, 20, 24, 24, 12, 24];
for (const [index, width] of widths.entries()) {
  sheet.getRangeByIndexes(0, index, rows.length + 1, 1).format.columnWidth = width;
}

const check = await workbook.inspect({
  kind: "table",
  sheetId: "os_order_combined",
  range: "A1:AM6",
  include: "values,formulas",
  tableMaxRows: 6,
  tableMaxCols: 39,
});
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
if (errors.ndjson.includes('"matches":[') && !errors.ndjson.includes('"matches":[]')) {
  throw new Error(`Formula errors detected: ${errors.ndjson}`);
}

const preview = await workbook.render({ sheetName: "os_order_combined", range: "A1:AM10", scale: 1, format: "png" });
await fs.writeFile("/private/tmp/os_order_combined_100_preview.png", new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
await normalizeXlsxForUpload(outputPath);
await assertUploadParserFriendly(outputPath);

console.log(JSON.stringify({
  outputPath,
  rowCount: rows.length,
  columnCount: headers.length,
  verification: check.ndjson,
}, null, 2));
