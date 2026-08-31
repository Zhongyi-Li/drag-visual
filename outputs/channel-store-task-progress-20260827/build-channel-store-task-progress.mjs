import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL(".", import.meta.url).pathname;
const outputPath = `${outputDir}大盘任务进度看板_渠道店铺数据.xlsx`;
const workbook = Workbook.create();
const dataSheet = workbook.worksheets.add("渠道店铺明细");
const summarySheet = workbook.worksheets.add("渠道汇总");
const guideSheet = workbook.worksheets.add("导入说明");

const channels = [
  { channel: "Amazon", stores: ["Amazon DE 小米店", "Amazon ES 小米店", "Amazon FR 小米店", "Amazon IT 小米店"], gmv: 155000, margin: 0.19, turnover: 96 },
  { channel: "速卖通", stores: ["速卖通-海托波兰小米店", "速卖通-海托波兰创维店", "速卖通-西班牙小米店", "速卖通-德国创维店"], gmv: 122000, margin: 0.17, turnover: 118 },
  { channel: "线下批发", stores: ["波兰线下批发", "西班牙线下批发", "德国线下批发", "法国线下批发"], gmv: 98000, margin: 0.14, turnover: 82 },
];
const months = ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"];
const dataRows = [];
months.forEach((month, monthIndex) => {
  channels.forEach((channel, channelIndex) => {
    channel.stores.forEach((store, storeIndex) => {
      const seasonalFactor = 0.8 + monthIndex * 0.055 + ((storeIndex + channelIndex) % 3) * 0.035;
      const gmv = Math.round(channel.gmv * seasonalFactor * (0.9 + storeIndex * 0.04));
      const grossProfit = Math.round(gmv * (channel.margin + ((storeIndex % 2) * 0.008)));
      const turnover = Math.max(45, Math.round(channel.turnover - monthIndex * 2 + storeIndex * 5));
      const orders = Math.round(gmv / (120 + channelIndex * 18 + storeIndex * 7));
      dataRows.push([new Date(`${month}T00:00:00`), channel.channel, store, gmv, grossProfit, turnover, orders]);
    });
  });
});

const navy = "#173A70";
const blue = "#2F6BFF";
const lightBlue = "#EEF5FF";
const border = "#D8E2F0";
const muted = "#5E7593";
const headers = ["订单时间", "渠道", "店铺", "GMV（欧元）", "销售毛利（欧元）", "库存周转天数", "订单量"];

dataSheet.showGridLines = false;
dataSheet.mergeCells("A1:G1");
dataSheet.getRange("A1").values = [["大盘任务进度看板 · 渠道与店铺明细数据"]];
dataSheet.getRange("A1:G1").format = { fill: navy, font: { bold: true, color: "#FFFFFF", size: 16 }, horizontalAlignment: "left", verticalAlignment: "center" };
dataSheet.getRange("A1:G1").format.rowHeight = 30;
dataSheet.getRange("A2:G2").values = [["用于绑定：日期字段 = 订单时间；维度 = 渠道；店铺维度 = 店铺；实际指标 = GMV、销售毛利、库存周转天数。目标请在图表的“配置渠道”中设置。", null, null, null, null, null, null]];
dataSheet.mergeCells("A2:G2");
dataSheet.getRange("A2:G2").format = { fill: lightBlue, font: { color: muted, italic: true, size: 10 }, wrapText: true, verticalAlignment: "center" };
dataSheet.getRange("A2:G2").format.rowHeight = 28;
dataSheet.getRange("A4:G4").values = [headers];
dataSheet.getRange("A4:G4").format = { fill: blue, font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: { preset: "all", style: "thin", color: border } };
dataSheet.getRange(`A5:G${dataRows.length + 4}`).values = dataRows;
dataSheet.getRange(`A5:G${dataRows.length + 4}`).format.borders = { preset: "inside", style: "thin", color: "#E7EDF5" };
dataSheet.getRange(`A5:A${dataRows.length + 4}`).format.numberFormat = "yyyy-mm-dd";
dataSheet.getRange(`D5:E${dataRows.length + 4}`).format.numberFormat = "#,##0";
dataSheet.getRange(`F5:F${dataRows.length + 4}`).format.numberFormat = "0";
dataSheet.getRange(`G5:G${dataRows.length + 4}`).format.numberFormat = "#,##0";
dataSheet.getRange(`D5:G${dataRows.length + 4}`).format.horizontalAlignment = "right";
dataSheet.getRange("A:A").format.columnWidth = 14;
dataSheet.getRange("B:B").format.columnWidth = 14;
dataSheet.getRange("C:C").format.columnWidth = 30;
dataSheet.getRange("D:E").format.columnWidth = 17;
dataSheet.getRange("F:G").format.columnWidth = 15;
dataSheet.freezePanes.freezeRows(4);

summarySheet.showGridLines = false;
summarySheet.mergeCells("A1:F1");
summarySheet.getRange("A1").values = [["渠道经营汇总（按统计月份）"]];
summarySheet.getRange("A1:F1").format = { fill: navy, font: { bold: true, color: "#FFFFFF", size: 16 }, verticalAlignment: "center" };
summarySheet.getRange("A1:F1").format.rowHeight = 30;
summarySheet.getRange("A3").values = [["统计月份"]];
summarySheet.getRange("B3").values = [[new Date("2026-08-01T00:00:00")]];
summarySheet.getRange("B3").format.numberFormat = "yyyy-mm";
summarySheet.getRange("A3:B3").format = { fill: lightBlue, font: { bold: true, color: navy }, borders: { preset: "all", style: "thin", color: border } };
summarySheet.getRange("A5:F5").values = [["渠道", "GMV（欧元）", "销售毛利（欧元）", "库存周转天数", "店铺数量", "订单量"]];
summarySheet.getRange("A5:F5").format = { fill: blue, font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", borders: { preset: "all", style: "thin", color: border } };
summarySheet.getRange("A6:A8").values = channels.map((item) => [item.channel]);
summarySheet.getRange("B6").formulas = [["=SUMIFS('渠道店铺明细'!$D$5:$D$76,'渠道店铺明细'!$B$5:$B$76,$A6,'渠道店铺明细'!$A$5:$A$76,$B$3)"]];
summarySheet.getRange("C6").formulas = [["=SUMIFS('渠道店铺明细'!$E$5:$E$76,'渠道店铺明细'!$B$5:$B$76,$A6,'渠道店铺明细'!$A$5:$A$76,$B$3)"]];
summarySheet.getRange("D6").formulas = [["=IFERROR(SUMIFS('渠道店铺明细'!$F$5:$F$76,'渠道店铺明细'!$B$5:$B$76,$A6,'渠道店铺明细'!$A$5:$A$76,$B$3)/COUNTIFS('渠道店铺明细'!$B$5:$B$76,$A6,'渠道店铺明细'!$A$5:$A$76,$B$3),0)"]];
summarySheet.getRange("E6").formulas = [["=COUNTIFS('渠道店铺明细'!$B$5:$B$76,$A6,'渠道店铺明细'!$A$5:$A$76,$B$3)"]];
summarySheet.getRange("F6").formulas = [["=SUMIFS('渠道店铺明细'!$G$5:$G$76,'渠道店铺明细'!$B$5:$B$76,$A6,'渠道店铺明细'!$A$5:$A$76,$B$3)"]];
summarySheet.getRange("B6:F8").fillDown();
summarySheet.getRange("A6:F8").format = { borders: { preset: "all", style: "thin", color: border } };
summarySheet.getRange("B6:C8").format.numberFormat = "#,##0";
summarySheet.getRange("D6:D8").format.numberFormat = "0";
summarySheet.getRange("E6:F8").format.numberFormat = "#,##0";
summarySheet.getRange("B6:F8").format.horizontalAlignment = "right";
summarySheet.getRange("A:A").format.columnWidth = 16;
summarySheet.getRange("B:C").format.columnWidth = 19;
summarySheet.getRange("D:F").format.columnWidth = 16;

guideSheet.showGridLines = false;
guideSheet.mergeCells("A1:D1");
guideSheet.getRange("A1").values = [["大盘任务进度看板 · 导入与绑定说明"]];
guideSheet.getRange("A1:D1").format = { fill: navy, font: { bold: true, color: "#FFFFFF", size: 16 }, verticalAlignment: "center" };
guideSheet.getRange("A1:D1").format.rowHeight = 30;
guideSheet.getRange("A3:D3").values = [["配置项", "选择字段", "说明", "必填"]];
guideSheet.getRange("A3:D3").format = { fill: blue, font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", borders: { preset: "all", style: "thin", color: border } };
guideSheet.getRange("A4:D8").values = [
  ["日期字段", "订单时间", "用于月度、年度选择器过滤数据。", "是"],
  ["维度", "渠道", "排名列表按渠道汇总展示。", "是"],
  ["店铺维度", "店铺", "在“配置渠道”中按渠道筛选、搜索和勾选店铺。", "建议"],
  ["实际指标", "GMV、销售毛利、库存周转天数", "作为三项完成度的实际值。", "是"],
  ["渠道目标", "在图表的“配置渠道”中录入", "按渠道维护 GMV、毛利与周转目标天数。", "是"],
];
guideSheet.getRange("A4:D8").format = { borders: { preset: "all", style: "thin", color: border }, wrapText: true, verticalAlignment: "center" };
guideSheet.getRange("A:A").format.columnWidth = 16;
guideSheet.getRange("B:B").format.columnWidth = 30;
guideSheet.getRange("C:C").format.columnWidth = 52;
guideSheet.getRange("D:D").format.columnWidth = 12;
guideSheet.getRange("A4:A8").format.font = { bold: true, color: navy };
guideSheet.getRange("D4:D8").format.horizontalAlignment = "center";
guideSheet.getRange("A4:D8").format.rowHeight = 28;

const output = await SpreadsheetFile.exportXlsx(workbook);
await fs.mkdir(outputDir, { recursive: true });
await output.save(outputPath);
const inspection = await workbook.inspect({ kind: "table", range: "渠道店铺明细!A1:G12", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 7 });
console.log(inspection.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula errors" });
console.log(errors.ndjson);
for (const sheetName of ["渠道店铺明细", "渠道汇总", "导入说明"]) {
  const image = await workbook.render({ sheetName, autoCrop: "all", scale: 1.5, format: "png" });
  await fs.writeFile(`${outputDir}${sheetName}.png`, new Uint8Array(await image.arrayBuffer()));
}
