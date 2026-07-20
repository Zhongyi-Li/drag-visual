import { describe, expect, it } from "vitest";

import { importDatasetFile, parseDelimitedDataset, parseExcelDataset } from "./fileImport.js";

const encoder = new TextEncoder();

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xFF]! ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const writeUint16 = (target: number[], value: number): void => {
  target.push(value & 0xFF, (value >>> 8) & 0xFF);
};

const writeUint32 = (target: number[], value: number): void => {
  target.push(value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF);
};

const appendBytes = (target: number[], bytes: Uint8Array): void => {
  for (const byte of bytes) target.push(byte);
};

const createStoredZip = (files: Readonly<Record<string, string>>): ArrayBuffer => {
  const output: number[] = [];
  const central: number[] = [];
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const crc = crc32(contentBytes);
    const offset = output.length;

    writeUint32(output, 0x04034B50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, crc);
    writeUint32(output, contentBytes.length);
    writeUint32(output, contentBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    appendBytes(output, nameBytes);
    appendBytes(output, contentBytes);

    writeUint32(central, 0x02014B50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, crc);
    writeUint32(central, contentBytes.length);
    writeUint32(central, contentBytes.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, offset);
    appendBytes(central, nameBytes);
  }

  const centralOffset = output.length;
  appendBytes(output, Uint8Array.from(central));
  writeUint32(output, 0x06054B50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, Object.keys(files).length);
  writeUint16(output, Object.keys(files).length);
  writeUint32(output, central.length);
  writeUint32(output, centralOffset);
  writeUint16(output, 0);
  return Uint8Array.from(output).buffer;
};

const workbook = createStoredZip({
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
    </workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    </Relationships>`,
  "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?>
    <sst><si><t>月份</t></si><si><t>收入</t></si><si><t>1月</t></si><si><t>2月</t></si></sst>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>120000</v></c></row>
      <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3"><v>98000</v></c></row>
    </sheetData></worksheet>`,
});

const namespacedWorkbook = createStoredZip({
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
    <x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <x:sheets>
        <x:sheet name="销售数据" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" />
      </x:sheets>
    </x:workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml"/>
    </Relationships>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
    <x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <x:sheetData>
        <x:row r="1"><x:c r="A1" t="str"><x:v>地区</x:v></x:c><x:c r="B1" t="str"><x:v>销售额</x:v></x:c></x:row>
        <x:row r="2"><x:c r="A2" t="str"><x:v>华东</x:v></x:c><x:c r="B2" t="n"><x:v>1250</x:v></x:c></x:row>
      </x:sheetData>
    </x:worksheet>`,
});

const metricDashboardWorkbook = createStoredZip({
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets>
    </workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    </Relationships>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>businessDate</t></is></c><c r="B1" t="inlineStr"><is><t>month</t></is></c><c r="C1" t="inlineStr"><is><t>revenue</t></is></c></row>
      <row r="2"><c r="A2" t="n"><v>46023</v></c><c r="B2" t="inlineStr"><is><t>2026-01</t></is></c><c r="C2" t="n"><v>120000</v></c></row>
      <row r="3"><c r="A3" t="n"><v>46054</v></c><c r="B3" t="inlineStr"><is><t>2026-02</t></is></c><c r="C3" t="n"><v>98000</v></c></row>
    </sheetData></worksheet>`,
});

describe("parseDelimitedDataset", () => {
  it("turns a CSV file into a local dataset with inferred fields and rows", () => {
    const imported = parseDelimitedDataset("销售导入.csv", "月份,收入,业务日期\n1月,120000,2026-01-01\n2月,98000,2026-02-01");

    expect(imported.schema).toMatchObject({
      name: "销售导入",
      fields: [
        { key: "month", label: "月份", type: "string", nullable: false },
        { key: "revenue", label: "收入", type: "number", nullable: false },
        { key: "businessDate", label: "业务日期", type: "date", nullable: false },
      ],
      parameters: [],
    });
    expect(imported.result.rows).toEqual([
      { month: "1月", revenue: 120000, businessDate: "2026-01-01" },
      { month: "2月", revenue: 98000, businessDate: "2026-02-01" },
    ]);
  });

  it("turns an Excel workbook into a local dataset using the first worksheet", async () => {
    const imported = await parseExcelDataset("销售导入.xlsx", workbook);

    expect(imported.schema).toMatchObject({
      name: "销售导入",
      fields: [
        { key: "month", label: "月份", type: "string", nullable: false },
        { key: "revenue", label: "收入", type: "number", nullable: false },
      ],
    });
    expect(imported.result.rows).toEqual([
      { month: "1月", revenue: 120000 },
      { month: "2月", revenue: 98000 },
    ]);
  });

  it("turns a namespaced Excel workbook into a local dataset", async () => {
    const imported = await parseExcelDataset("交叉表测试.xlsx", namespacedWorkbook);

    expect(imported.schema).toMatchObject({
      name: "交叉表测试",
      fields: [
        { key: "field1", label: "地区", type: "string", nullable: false },
        { key: "salesAmount", label: "销售额", type: "number", nullable: false },
      ],
    });
    expect(imported.result.rows).toEqual([
      { field1: "华东", salesAmount: 1250 },
    ]);
  });

  it("keeps metric dashboard business dates as date fields when Excel stores date serials", async () => {
    const imported = await parseExcelDataset("metric_dashboard_upload_ready.xlsx", metricDashboardWorkbook);

    expect(imported.schema.fields).toEqual([
      { key: "businessDate", label: "businessDate", type: "date", nullable: false },
      { key: "month", label: "month", type: "string", nullable: false },
      { key: "revenue", label: "revenue", type: "number", nullable: false },
    ]);
    expect(imported.result.rows).toEqual([
      { businessDate: "2026-01-01", month: "2026-01", revenue: 120000 },
      { businessDate: "2026-02-01", month: "2026-02", revenue: 98000 },
    ]);
  });

  it("recognizes 月份 columns as date fields", () => {
    const imported = parseDelimitedDataset("月度销售.csv", "月份,销售额\n2026-01-01,120000\n2026-02-01,98000");

    expect(imported.schema.fields).toEqual([
      { key: "month", label: "月份", type: "date", nullable: false },
      { key: "salesAmount", label: "销售额", type: "number", nullable: false },
    ]);
  });

  it("rejects empty files, blank headers, and duplicate headers with clear messages", () => {
    expect(() => parseDelimitedDataset("空表.csv", "")).toThrow("文件为空，请上传包含表头和数据行的文件");
    expect(() => parseDelimitedDataset("空表头.csv", ",收入\n1月,120000")).toThrow("第 1 列表头为空，请补充字段名称");
    expect(() => parseDelimitedDataset("重复表头.csv", "月份,月份\n1月,2月")).toThrow("存在重复表头：月份");
  });

  it("rejects files beyond the local row and size limits", async () => {
    const tooManyRows = `月份,收入\n${Array.from({ length: 10_001 }, (_, index) => `${index + 1}月,1`).join("\n")}`;
    expect(() => parseDelimitedDataset("行数过多.csv", tooManyRows)).toThrow("文件最多支持 10000 行数据");

    await expect(importDatasetFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "过大.csv", { type: "text/csv" })))
      .rejects.toThrow("文件过大，请上传不超过 5MB 的文件");
  });

  it("rejects unsupported files with an actionable message", async () => {
    await expect(importDatasetFile(new File(["{}"], "data.json", { type: "application/json" })))
      .rejects.toThrow("当前仅支持导入 CSV 或 XLSX 文件");
  });
});
