import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL("./", import.meta.url).pathname;
const workbook = Workbook.create();
const data = workbook.worksheets.add("多维分析数据");
const notes = workbook.worksheets.add("使用说明");

const rows = [
  ["业务日期", "月份", "地区", "品类", "渠道", "客户类型", "销售额", "订单数", "访客数", "转化率"],
  ["2026-01-01", "2026-01", "华东", "手机", "自然流量", "新客", 186000, 820, 11400, 0.0719],
  ["2026-01-05", "2026-01", "华东", "手机", "付费投放", "老客", 142000, 610, 7600, 0.0803],
  ["2026-01-09", "2026-01", "华东", "电脑", "自然流量", "老客", 214000, 420, 5100, 0.0824],
  ["2026-01-12", "2026-01", "华南", "手机", "自然流量", "新客", 156000, 720, 9800, 0.0735],
  ["2026-01-18", "2026-01", "华南", "配件", "私域运营", "老客", 68000, 980, 6200, 0.1581],
  ["2026-01-24", "2026-01", "华北", "电脑", "付费投放", "新客", 198000, 390, 4700, 0.0830],
  ["2026-02-02", "2026-02", "华东", "手机", "自然流量", "新客", 204000, 900, 12100, 0.0744],
  ["2026-02-06", "2026-02", "华东", "电脑", "付费投放", "老客", 238000, 455, 5400, 0.0843],
  ["2026-02-10", "2026-02", "华南", "手机", "私域运营", "老客", 174000, 760, 8300, 0.0916],
  ["2026-02-14", "2026-02", "华南", "配件", "自然流量", "新客", 73000, 1030, 6900, 0.1493],
  ["2026-02-19", "2026-02", "华北", "手机", "付费投放", "新客", 166000, 710, 8900, 0.0798],
  ["2026-02-25", "2026-02", "华北", "电脑", "自然流量", "老客", 221000, 438, 5200, 0.0842],
  ["2026-03-03", "2026-03", "华东", "手机", "私域运营", "老客", 229000, 980, 9800, 0.1000],
  ["2026-03-07", "2026-03", "华东", "配件", "自然流量", "新客", 84000, 1180, 7600, 0.1553],
  ["2026-03-11", "2026-03", "华南", "电脑", "付费投放", "新客", 252000, 502, 6100, 0.0823],
  ["2026-03-16", "2026-03", "华南", "手机", "自然流量", "新客", 191000, 850, 11300, 0.0752],
  ["2026-03-20", "2026-03", "华北", "配件", "私域运营", "老客", 79000, 1090, 6600, 0.1652],
  ["2026-03-27", "2026-03", "华北", "电脑", "付费投放", "老客", 246000, 470, 5600, 0.0839],
  ["2026-04-02", "2026-04", "华东", "手机", "自然流量", "老客", 238000, 1010, 12600, 0.0802],
  ["2026-04-06", "2026-04", "华东", "电脑", "私域运营", "老客", 268000, 530, 5700, 0.0930],
  ["2026-04-11", "2026-04", "华南", "配件", "付费投放", "新客", 96000, 1320, 8100, 0.1630],
  ["2026-04-15", "2026-04", "华南", "手机", "自然流量", "新客", 208000, 920, 11900, 0.0773],
  ["2026-04-21", "2026-04", "华北", "手机", "私域运营", "老客", 184000, 820, 7800, 0.1051],
  ["2026-04-28", "2026-04", "华北", "电脑", "自然流量", "新客", 259000, 498, 5900, 0.0844],
];

data.getRange("A1:J25").values = rows;
data.getRange("A1:J1").format.fill.color = "#EAF2FF";
data.getRange("A1:J1").format.font.bold = true;
data.getRange("A1:J1").format.font.color = "#1F4E79";
data.getRange("A1:J25").format.borders = { preset: "inside", style: "thin", color: "#D9E2F3" };
data.getRange("A1:J25").format.autofitColumns();
data.getRange("G2:I25").setNumberFormat("#,##0");
data.getRange("J2:J25").setNumberFormat("0.0%");
data.freezePanes.freezeRows(1);
data.showGridLines = false;

notes.getRange("A1:D1").values = [["多维分析图表测试说明", null, null, null]];
notes.getRange("A1:D1").merge();
notes.getRange("A1:D1").format.fill.color = "#1677FF";
notes.getRange("A1:D1").format.font.color = "#FFFFFF";
notes.getRange("A1:D1").format.font.bold = true;
notes.getRange("A1:D1").format.font.size = 14;
notes.getRange("A3:D10").values = [
  ["推荐绑定", "字段", "作用", "说明"],
  ["数据集", "multidimensional_analysis_sample", "数据来源", "上传本文件后选择第一张工作表数据"],
  ["日期", "业务日期", "时间字段", "日期槽位请选择天级日期，时间粒度可在右侧切换为天、周、月、季度或年"],
  ["维度字段", "地区、品类、渠道", "分组层级", "也可以加入客户类型，形成多层拆解"],
  ["指标字段", "销售额、订单数、访客数", "汇总指标", "支持一次选择多个数值指标"],
  ["聚合", "sum", "默认汇总", "同一维度组合下的指标会加总"],
  ["预期效果", "多维聚合表", "维度 + 指标", "表格展示每个维度组合的多个指标和合计"],
  ["注意", "第一张表", "用于系统导入", "请不要把使用说明工作表移到第一位"],
];
notes.getRange("A3:D3").format.fill.color = "#F5F7FA";
notes.getRange("A3:D3").format.font.bold = true;
notes.getRange("A3:D10").format.borders = { preset: "inside", style: "thin", color: "#E8E8E8" };
notes.getRange("A:D").format.autofitColumns();
notes.showGridLines = false;

const tableInspect = await workbook.inspect({
  kind: "table",
  sheetId: "多维分析数据",
  range: "A1:J8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 10,
  maxChars: 5000,
});
console.log(tableInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "多维分析数据", range: "A1:J25", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/multidimensional_analysis_sample_preview.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/multidimensional_analysis_sample.xlsx`);
