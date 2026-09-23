import fs from "node:fs/promises";
import {
  SpreadsheetFile,
  Workbook,
} from "/Users/ethan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const outputDir = "/Users/ethan/Desktop/ZH/drag-visual/artifacts";

const mainRows = [
  ["订单号", "店铺ID", "订单日期", "渠道", "销售金额", "订单状态"],
  ["SO-1001", "S001", new Date("2026-09-01T00:00:00+08:00"), "Amazon", 1280.5, "已支付"],
  ["SO-1002", "S001", new Date("2026-09-02T00:00:00+08:00"), "独立站", 560, "已发货"],
  ["SO-1003", "S002", new Date("2026-09-03T00:00:00+08:00"), "Shopee", 980, "已支付"],
  ["SO-1004", "S002", new Date("2026-09-04T00:00:00+08:00"), "Amazon", 2300, "退款中"],
  ["SO-1005", "S003", new Date("2026-09-05T00:00:00+08:00"), "Lazada", 760, "已支付"],
  ["SO-1006", "S003", new Date("2026-09-06T00:00:00+08:00"), "Amazon", 420, "已发货"],
  ["SO-1007", "S004", new Date("2026-09-07T00:00:00+08:00"), "独立站", 1850, "已支付"],
  ["SO-1008", "S005", new Date("2026-09-08T00:00:00+08:00"), "Shopee", 315, "已支付"],
  ["SO-1009", "S006", new Date("2026-09-09T00:00:00+08:00"), "Amazon", 4780, "已发货"],
  ["SO-1010", "S001", new Date("2026-09-10T00:00:00+08:00"), "Lazada", 699, "已取消"],
];

const detailRows = [
  ["订单号", "店铺ID", "品牌", "员工", "客户等级", "返利率", "履约仓"],
  ["SO-1001", "S001", "北辰", "张敏", "A", 0.05, "上海仓"],
  ["SO-1002", "S001", "北辰", "李伟", "B", 0.03, "深圳仓"],
  ["SO-1003", "S002", "云途", "王芳", "A", 0.06, "义乌仓"],
  ["SO-1004", "S002", "云途", "王芳", "A", 0.06, "义乌仓"],
  ["SO-1004", "S002", "云途-联营", "陈晨", "B", 0.04, "义乌仓"],
  ["SO-1005", "S003", "星海", "赵磊", "C", 0.02, "广州仓"],
  ["SO-1006", "S003", "星海", "赵磊", "B", 0.03, "广州仓"],
  ["SO-1007", "S004", "青岚", "刘洋", "A", 0.05, "上海仓"],
  ["SO-1008", "S005", "青岚", "周洁", "B", 0.03, "深圳仓"],
  ["SO-1002", "S009", "错位样例", "测试员", "D", 0.01, "测试仓"],
  ["SO-9999", "S999", "未匹配样例", "测试员", "D", 0.01, "测试仓"],
];

function styleDataSheet(sheet, rowCount, colCount, keyCols, currencyCol, percentCol) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);

  const used = sheet.getRangeByIndexes(0, 0, rowCount, colCount);
  used.format.font = { name: "Microsoft YaHei", size: 11, color: "#172033" };
  used.format.rowHeight = 24;
  used.format.verticalAlignment = "center";
  used.format.borders = { preset: "all", style: "thin", color: "#DDE3EE" };

  const header = sheet.getRangeByIndexes(0, 0, 1, colCount);
  header.format.fill = "#245BDB";
  header.format.font = { name: "Microsoft YaHei", size: 11, bold: true, color: "#FFFFFF" };
  header.format.rowHeight = 30;

  for (const col of keyCols) {
    sheet.getRangeByIndexes(1, col, rowCount - 1, 1).format.fill = "#EEF4FF";
  }

  if (currencyCol !== null) {
    sheet.getRangeByIndexes(1, currencyCol, rowCount - 1, 1).setNumberFormat("#,##0.00");
  }
  if (percentCol !== null) {
    sheet.getRangeByIndexes(1, percentCol, rowCount - 1, 1).setNumberFormat("0.00%");
  }
}

async function createMainWorkbook() {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("订单主表");
  sheet.getRange("A1:F11").values = mainRows;
  sheet.getRange("C2:C11").setNumberFormat("yyyy-mm-dd");
  styleDataSheet(sheet, mainRows.length, mainRows[0].length, [0, 1], 4, null);
  sheet.getRange("A:F").format.autofitColumns();
  sheet.getRange("A:A").format.columnWidth = 16;
  sheet.getRange("B:B").format.columnWidth = 12;
  sheet.getRange("C:C").format.columnWidth = 15;
  sheet.getRange("D:F").format.columnWidth = 14;
  workbook.recalculate();
  return workbook;
}

async function createDetailWorkbook() {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("订单补充信息");
  sheet.getRange("A1:G12").values = detailRows;
  styleDataSheet(sheet, detailRows.length, detailRows[0].length, [0, 1], null, 5);
  sheet.getRange("A:G").format.autofitColumns();
  sheet.getRange("A:A").format.columnWidth = 16;
  sheet.getRange("B:B").format.columnWidth = 12;
  sheet.getRange("C:G").format.columnWidth = 14;
  workbook.recalculate();
  return workbook;
}

await fs.mkdir(outputDir, { recursive: true });

const mainWorkbook = await createMainWorkbook();
const detailWorkbook = await createDetailWorkbook();

const mainPath = `${outputDir}/订单主表_关联测试.xlsx`;
const detailPath = `${outputDir}/订单补充信息_关联测试.xlsx`;

const mainFile = await SpreadsheetFile.exportXlsx(mainWorkbook);
await mainFile.save(mainPath);
const detailFile = await SpreadsheetFile.exportXlsx(detailWorkbook);
await detailFile.save(detailPath);

const mainInspect = await mainWorkbook.inspect({
  kind: "sheet,region",
  sheetId: "订单主表",
  range: "A1:F11",
  maxChars: 3000,
  tableMaxRows: 12,
  tableMaxCols: 8,
});
const detailInspect = await detailWorkbook.inspect({
  kind: "sheet,region",
  sheetId: "订单补充信息",
  range: "A1:G12",
  maxChars: 3500,
  tableMaxRows: 13,
  tableMaxCols: 8,
});

const mainPreview = await mainWorkbook.render({ sheetName: "订单主表", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile("/private/tmp/订单主表_关联测试.png", new Uint8Array(await mainPreview.arrayBuffer()));
const detailPreview = await detailWorkbook.render({ sheetName: "订单补充信息", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile("/private/tmp/订单补充信息_关联测试.png", new Uint8Array(await detailPreview.arrayBuffer()));

console.log(JSON.stringify({ mainPath, detailPath, mainInspect: mainInspect.ndjson, detailInspect: detailInspect.ndjson }, null, 2));
