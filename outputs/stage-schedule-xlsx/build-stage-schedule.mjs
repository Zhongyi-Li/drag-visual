import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL(".", import.meta.url).pathname;
const outputPath = `${outputDir}/frontend_stage_schedule_weekly.xlsx`;

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("阶段排期总览");
sheet.showGridLines = false;

const rows = [
  ["W1", "7.6-7.12", "阶段 1", "编辑器壳子与三列布局", "编辑器路由、三列布局、顶部工具栏、基础 store、组件面板入口"],
  ["W2", "7.13-7.19", "阶段 1", "画布交互与图表组件体系", "可拖拽画布、组件移动缩放、防碰撞、图表 registry、统一渲染器、空状态 demo"],
  ["W3", "7.20-7.26", "阶段 2", "组件属性面板与基础配置项", "右侧属性面板、基础展示属性、组件配置保存、配置校验提示"],
  ["W4", "7.27-8.2", "阶段 2", "数据集本地管理", "本地数据集导入、字段识别、数据预览、字段元数据调整"],
  ["W5", "8.3-8.9", "阶段 2", "数据绑定闭环", "数据集选择、字段绑定、绑定校验、绑定异常提示、组件联动展示"],
  ["W6", "8.10-8.16", "阶段 3", "接口数据接入", "数据集接口适配、查询参数传递、真实数据读取、加载与失败状态"],
  ["W7", "8.17-8.23", "阶段 3", "真实数据调测", "图表真实数据渲染、字段类型适配、空值处理、接口异常调测"],
  ["W8", "8.24-8.30", "阶段 3", "后端保存联动", "看板配置保存、修订版本处理、冲突处理、保存状态反馈"],
  ["W9", "8.31-9.6", "阶段 4", "预览链路", "预览页、只读渲染、预览数据加载、预览异常状态"],
  ["W10", "9.7-9.13", "阶段 4", "发布链路", "发布入口、发布查看页、发布状态反馈、发布失败处理"],
  ["W11", "9.14-9.20", "阶段 4", "体验打磨", "交互 polish、视觉一致性、空状态与错误状态补齐、性能初步优化"],
  ["W12", "9.21-9.27", "阶段 4", "测试验收", "单元测试、集成测试、主流程回归、验收问题修复"],
  ["W13", "9.28-9.30", "阶段 4", "最终收口", "验收清单确认、发布材料整理、遗留问题分级、季度版本收口"],
];

sheet.getRange("A1:E1").merge();
sheet.getRange("A1").values = [["阶段排期总览"]];
sheet.getRange("A1").format.font.bold = true;
sheet.getRange("A1").format.font.size = 18;
sheet.getRange("A1").format.font.color = "#102A43";
sheet.getRange("A1").format.fill.color = "#E8F1FF";
sheet.getRange("A1").format.rowHeightPx = 38;

sheet.getRange("A2:E2").merge();
sheet.getRange("A2").values = [["排期从 2026.7.6（周一）开始，到 2026.9.30 结束。整体按自然周拆分为 13 个周窗口，其中第 13 周为 9.28-9.30 的短周收口。"]];
sheet.getRange("A2").format.font.color = "#475569";
sheet.getRange("A2").format.wrapText = true;
sheet.getRange("A2").format.rowHeightPx = 42;

sheet.getRange("A4:E4").values = [["周次", "日期范围", "所属阶段", "本周主题", "核心交付"]];
sheet.getRange("A5:E17").values = rows;

const header = sheet.getRange("A4:E4");
header.format.fill.color = "#17324D";
header.format.font.color = "#FFFFFF";
header.format.font.bold = true;
header.format.rowHeightPx = 30;

const table = sheet.getRange("A4:E17");
table.format.borders = { preset: "all", style: "thin", color: "#D8DEE9" };
sheet.getRange("A5:A17").format.font.bold = true;
sheet.getRange("A5:C17").format.horizontalAlignment = "center";
sheet.getRange("D5:E17").format.wrapText = true;
sheet.getRange("A5:E17").format.verticalAlignment = "top";

sheet.getRange("A5:E6").format.fill.color = "#F8FBFF";
sheet.getRange("A7:E9").format.fill.color = "#FFFDF7";
sheet.getRange("A10:E12").format.fill.color = "#F7FCFA";
sheet.getRange("A13:E17").format.fill.color = "#FAF8FF";

sheet.getRange("A:A").format.columnWidthPx = 70;
sheet.getRange("B:B").format.columnWidthPx = 105;
sheet.getRange("C:C").format.columnWidthPx = 90;
sheet.getRange("D:D").format.columnWidthPx = 210;
sheet.getRange("E:E").format.columnWidthPx = 520;
sheet.getRange("A5:E17").format.rowHeightPx = 46;

sheet.freezePanes.freezeRows(4);
sheet.tables.add("A4:E17", true, "FrontendWeeklyStageSchedule");

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "阶段排期总览", range: "A1:E17", scale: 2 });
await fs.writeFile(`${outputDir}/frontend_stage_schedule_weekly.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
