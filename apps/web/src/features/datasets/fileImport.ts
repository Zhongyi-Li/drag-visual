import {
  Dataset,
  DatasetQueryResult,
  type Dataset as DatasetValue,
  type DatasetField,
  type DatasetQueryResult as DatasetQueryResultValue,
} from "@drag-visual/contracts";

export interface ImportedDataset {
  readonly schema: DatasetValue;
  readonly result: DatasetQueryResultValue;
}

const labelKeyMap = new Map<string, string>([
  ["businessDate", "businessDate"],
  ["month", "month"],
  ["region", "region"],
  ["category", "category"],
  ["channel", "channel"],
  ["revenue", "revenue"],
  ["revenueTarget", "revenueTarget"],
  ["priorRevenue", "priorRevenue"],
  ["orders", "orders"],
  ["orderTarget", "orderTarget"],
  ["priorOrders", "priorOrders"],
  ["conversionRate", "conversionRate"],
  ["conversionTarget", "conversionTarget"],
  ["priorConversionRate", "priorConversionRate"],
  ["averageOrderValue", "averageOrderValue"],
  ["aovTarget", "aovTarget"],
  ["priorAov", "priorAov"],
  ["月份", "month"],
  ["日期", "date"],
  ["业务日期", "businessDate"],
  ["收入", "revenue"],
  ["销售额", "salesAmount"],
  ["数量", "quantity"],
  ["库存", "quantity"],
]);

const trimBom = (value: string): string => value.replace(/^\uFEFF/, "");
const textDecoder = new TextDecoder();
const MAX_LOCAL_FILE_SIZE = 5 * 1024 * 1024;
const MAX_LOCAL_ROWS = 10_000;

const datasetName = (fileName: string): string => {
  const clean = fileName.trim().replace(/\.[^.]+$/, "");
  return clean.length > 0 ? clean : "导入数据";
};

const uniqueKey = (label: string, index: number, used: Set<string>): string => {
  const mapped = labelKeyMap.get(label.trim());
  const base = mapped ?? `field${index + 1}`;
  let key = base;
  let suffix = 2;
  while (used.has(key)) {
    key = `${base}${suffix}`;
    suffix += 1;
  }
  used.add(key);
  return key;
};

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((candidate) => candidate.some((value) => value.length > 0));
};

const isDateValue = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const isDateField = (label: string, key: string): boolean =>
  /date|日期|month|月份/i.test(label) || /date|month/i.test(key);

const isExcelDateSerial = (value: string): boolean => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 80000;
};

const excelSerialToIsoDate = (value: string): string => {
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + Number(value) * 86_400_000);
  return date.toISOString().slice(0, 10);
};

const inferType = (values: readonly string[], label: string, key: string): DatasetField["type"] => {
  const present = values.filter((value) => value.length > 0);
  if (present.length === 0) return "string";
  if (isDateField(label, key) && present.every((value) => isDateValue(value) || isExcelDateSerial(value))) return "date";
  if (present.every((value) => !Number.isNaN(Number(value)))) return "number";
  if (present.every(isDateValue)) return "date";
  if (present.every((value) => value === "true" || value === "false")) return "boolean";
  return "string";
};

const coerceValue = (value: string, type: DatasetField["type"]): string | number | boolean | null => {
  if (value.length === 0) return null;
  if (type === "number") return Number(value);
  if (type === "boolean") return value === "true";
  if (type === "date" && isExcelDateSerial(value)) return excelSerialToIsoDate(value);
  return value;
};

const rowsToDataset = (fileName: string, parsedRows: string[][]): ImportedDataset => {
  const header = parsedRows[0];
  if (header === undefined || header.length === 0) throw new Error("文件为空，请上传包含表头和数据行的文件");
  const labels = header.map((label) => label.trim());
  const blankHeaderIndex = labels.findIndex((label) => label.length === 0);
  if (blankHeaderIndex >= 0) throw new Error(`第 ${blankHeaderIndex + 1} 列表头为空，请补充字段名称`);
  const duplicate = labels.find((label, index) => labels.indexOf(label) !== index);
  if (duplicate !== undefined) throw new Error(`存在重复表头：${duplicate}`);
  const body = parsedRows.slice(1);
  if (body.length === 0) throw new Error("文件缺少数据行，请至少保留一行数据");
  if (body.length > MAX_LOCAL_ROWS) throw new Error(`文件最多支持 ${MAX_LOCAL_ROWS} 行数据`);

  const usedKeys = new Set<string>();
  const keys = labels.map((label, index) => uniqueKey(label, index, usedKeys));
  const fields = labels.map((label, index): DatasetField => {
    const values = body.map((row) => row[index] ?? "");
    const type = inferType(values, label, keys[index]!);
    return {
      key: keys[index]!,
      label,
      type,
      nullable: values.some((value) => value.length === 0),
    };
  });
  const rows = body.map((row) => Object.fromEntries(
    fields.map((field, index) => [field.key, coerceValue(row[index] ?? "", field.type)]),
  ));
  const schema = Dataset.parse({
    id: `local-${crypto.randomUUID()}`,
    name: datasetName(fileName),
    fields,
    parameters: [],
    schemaVersion: `file-${Date.now()}`,
  });
  const result = DatasetQueryResult.parse({
    columns: fields,
    rows,
    total: rows.length,
    sampledAt: new Date().toISOString(),
  });
  return { schema, result };
};

export const parseDelimitedDataset = (fileName: string, text: string): ImportedDataset =>
  rowsToDataset(fileName, parseCsvRows(trimBom(text)));

const readUint16 = (view: DataView, offset: number): number => view.getUint16(offset, true);
const readUint32 = (view: DataView, offset: number): number => view.getUint32(offset, true);

const inflateRaw = async (bytes: Uint8Array): Promise<Uint8Array> => {
  if (typeof DecompressionStream === "undefined") throw new Error("当前浏览器不支持解析压缩 Excel 文件");
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const readZipEntries = async (buffer: ArrayBuffer): Promise<Map<string, string>> => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (readUint32(view, offset) === 0x06054B50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Excel 文件格式不正确");

  const totalEntries = readUint16(view, eocdOffset + 10);
  const centralOffset = readUint32(view, eocdOffset + 16);
  const entries = new Map<string, string>();
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (readUint32(view, offset) !== 0x02014B50) throw new Error("Excel 文件目录不正确");
    const method = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const uncompressedSize = readUint32(view, offset + 24);
    const nameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localOffset = readUint32(view, offset + 42);
    const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));

    if (readUint32(view, localOffset) !== 0x04034B50) throw new Error("Excel 文件内容不正确");
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    const content = method === 0
      ? compressed
      : method === 8
        ? await inflateRaw(compressed)
        : null;
    if (content === null) throw new Error("Excel 文件使用了暂不支持的压缩方式");
    if (content.length !== uncompressedSize) throw new Error("Excel 文件内容长度不匹配");
    entries.set(name, textDecoder.decode(content));

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const decodeXml = (value: string): string => value
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&");

const attribute = (xml: string, name: string): string | undefined => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`\\s${escaped}="([^"]*)"`).exec(xml);
  return match ? decodeXml(match[1]!) : undefined;
};

const tagName = (name: string): string => `(?:[\\w.-]+:)?${name}`;

const firstTag = (xml: string, name: string): string | undefined =>
  new RegExp(`<${tagName(name)}\\b[^>]*\\/?>`).exec(xml)?.[0];

const tagContents = (xml: string, name: string): string[] => (
  Array.from(
    xml.matchAll(new RegExp(`<${tagName(name)}\\b[^>]*>([\\s\\S]*?)<\\/${tagName(name)}>`, "g")),
    (match) => match[1] ?? "",
  )
);

const tags = (xml: string, name: string): string[] => (
  Array.from(xml.matchAll(new RegExp(`<${tagName(name)}\\b[^>]*>[\\s\\S]*?<\\/${tagName(name)}>`, "g")), (match) => match[0])
);

const normalizePath = (path: string): string => {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
};

const resolvePath = (basePath: string, target: string): string => {
  if (target.startsWith("/")) return normalizePath(target.slice(1));
  const base = basePath.includes("/") ? basePath.slice(0, basePath.lastIndexOf("/") + 1) : "";
  return normalizePath(`${base}${target}`);
};

const parseRelationships = (xml: string): Map<string, string> => {
  const relationships = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attribute(match[0], "Id");
    const target = attribute(match[0], "Target");
    if (id && target) relationships.set(id, target);
  }
  return relationships;
};

const parseSharedStrings = (xml: string | undefined): string[] => {
  if (xml === undefined) return [];
  return tagContents(xml, "si").map((sharedStringXml) => {
    const texts = tagContents(sharedStringXml, "t").map((text) => decodeXml(text));
    return texts.join("");
  });
};

const columnIndex = (cellRef: string | undefined, fallback: number): number => {
  const letters = /^([A-Z]+)/i.exec(cellRef ?? "")?.[1];
  if (!letters) return fallback;
  return [...letters.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
};

const cellText = (cellXml: string, sharedStrings: readonly string[]): string => {
  const type = attribute(cellXml, "t");
  if (type === "inlineStr") {
    return tagContents(cellXml, "t").map((value) => decodeXml(value)).join("");
  }
  const value = tagContents(cellXml, "v")[0] ?? "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  if (type === "b") return value === "1" ? "true" : "false";
  return decodeXml(value);
};

const parseWorksheetRows = (xml: string, sharedStrings: readonly string[]): string[][] => (
  tagContents(xml, "row").map((rowXml) => {
    const row: string[] = [];
    let fallbackIndex = 0;
    for (const cellXml of tags(rowXml, "c")) {
      const index = columnIndex(attribute(cellXml, "r"), fallbackIndex);
      row[index] = cellText(cellXml, sharedStrings).trim();
      fallbackIndex = index + 1;
    }
    return row.map((value) => value ?? "");
  }).filter((row) => row.some((value) => value.length > 0))
);

export const parseExcelDataset = async (fileName: string, buffer: ArrayBuffer): Promise<ImportedDataset> => {
  const entries = await readZipEntries(buffer);
  const rootRelationships = parseRelationships(entries.get("_rels/.rels") ?? "");
  const workbookPath = resolvePath("", rootRelationships.get("rId1") ?? "xl/workbook.xml");
  const workbookXml = entries.get(workbookPath);
  if (!workbookXml) throw new Error("Excel 文件缺少工作簿");
  const firstSheet = firstTag(workbookXml, "sheet");
  const sheetRelationshipId = firstSheet ? attribute(firstSheet, "r:id") : undefined;
  if (!sheetRelationshipId) throw new Error("Excel 文件缺少工作表");

  const workbookDirectory = workbookPath.includes("/") ? workbookPath.slice(0, workbookPath.lastIndexOf("/") + 1) : "";
  const workbookFile = workbookPath.slice(workbookPath.lastIndexOf("/") + 1);
  const sheetRelationships = parseRelationships(entries.get(`${workbookDirectory}_rels/${workbookFile}.rels`) ?? "");
  const sheetTarget = sheetRelationships.get(sheetRelationshipId);
  if (!sheetTarget) throw new Error("Excel 文件缺少工作表关系");
  const sheetPath = resolvePath(workbookPath, sheetTarget);
  const sheetXml = entries.get(sheetPath);
  if (!sheetXml) throw new Error("Excel 文件缺少工作表内容");

  return rowsToDataset(fileName, parseWorksheetRows(sheetXml, parseSharedStrings(entries.get("xl/sharedStrings.xml"))));
};

export const importDatasetFile = async (file: File): Promise<ImportedDataset> => {
  if (file.size > MAX_LOCAL_FILE_SIZE) throw new Error("文件过大，请上传不超过 5MB 的文件");
  if (/\.xlsx$/i.test(file.name)) return parseExcelDataset(file.name, await file.arrayBuffer());
  if (!/\.csv$/i.test(file.name)) throw new Error("当前仅支持导入 CSV 或 XLSX 文件");
  return parseDelimitedDataset(file.name, await file.text());
};
