# 可视化图表编辑器设计方案

- 日期：2026-07-01
- 状态：已由用户确认
- 目标版本：内部可用 MVP
- 参考：用户提供的三栏式可视化编辑器截图

## 1. 背景与目标

建设一个面向内部用户的可视化图表编辑器。用户从左侧选择图表或展示组件，将其添加到中间画布；在右侧配置数据字段和样式；通过 CSV、Excel 或现有统一业务接口获取数据；保存项目后可通过独立预览页查看结果。

MVP 的成功标准：

1. 用户可在不编写代码的情况下完成“获取数据 → 添加组件 → 映射字段 → 配置样式 → 保存 → 预览”的完整闭环。
2. 编辑器与预览页使用同一份项目配置和渲染器，显示结果一致。
3. 新增图表类型不要求修改画布和属性面板的核心逻辑。
4. 1 万行以内的数据集可流畅完成预览、字段映射和常规编辑。

## 2. MVP 范围

### 2.1 包含

- 三栏式编辑器：左侧组件面板、中间栅格画布、右侧字段与样式面板。
- 画布组件的添加、选择、拖动、缩放、删除、复制和层内自动避让。
- 基础撤销与重做。
- 八个首批组件：柱状图、折线图、饼图、面积图、进度图、指标卡、表格、文本。
- CSV、XLS、XLSX 文件导入。
- 通过现有统一业务接口查询数据。
- 字段类型推断、数据预览和字段槽位映射。
- 项目保存、加载和自动保存。
- 独立预览页。
- 项目配置的 Schema 版本管理与迁移入口。

### 2.2 不包含

- 任意第三方 REST API 地址、请求头或凭据的用户自定义配置。
- 浏览器直连数据库或外部业务接口。
- 多租户计费、多人实时协作、评论和复杂权限系统。
- 草稿/发布版本历史与可视化回滚。
- 图表之间的连线、数据流节点编排和流程图能力。
- 20 个以上的完整图表市场。

## 3. 关键产品决策

### 3.1 栅格画布而非自由画布

画布采用栅格布局。组件以列、行、宽、高描述位置，支持吸附、自动避让和响应式断点布局。MVP 不支持像 Figma/PPT 一样的任意像素定位和叠层。

理由：报表和仪表盘更重视整齐、稳定和响应式；栅格模型也更容易保存、迁移和还原。

### 3.2 不以 React Flow 作为主画布

主画布使用 `react-grid-layout`，字段拖拽可使用 `dnd-kit`。React Flow 的核心模型是节点和边，适用于流程图、拓扑图和数据流编辑器，不适合当前以响应式栅格排版为核心的画布。

若后续增加“数据源 → 转换节点 → 图表”的可视化数据流编排，应将 React Flow 作为独立模块引入，而不是替换当前报表画布。

### 3.3 Schema 驱动

`Project Schema` 是编辑器的唯一事实源。左侧添加组件、画布修改布局、右侧修改字段或样式，最终都转化为对该 Schema 的命令式更新。

编辑器和独立预览页均使用相同的组件注册表及渲染器读取 Schema，避免维护两套渲染逻辑。

## 4. 总体架构

采用模块化单体：一个前端 Monorepo、一个 BFF/API 服务、一个 PostgreSQL 数据库。部署单元保持简单，代码内部按领域隔离。

```text
组件面板 ─┐
栅格画布 ─┼─> Editor Commands ─> Project Schema ─> Chart Renderer
属性面板 ─┤                           │
数据工作台 ┘                           ├─> 保存/加载 API
                                      └─> 独立预览页

API Server
  ├─ Project Module ─────> PostgreSQL
  ├─ DataSource Module ──> 文件解析/字段推断
  └─ Query Gateway ──────> 现有统一业务接口
```

## 5. 前端模块设计

### 5.1 Editor Shell

负责三栏布局、顶部工具栏、路由和模块装配。它不包含图表类型判断和具体字段规则。

### 5.2 Component Palette

从组件注册表读取分组、名称、图标和默认布局。拖入或点击添加时生成组件实例和布局记录。

### 5.3 Grid Canvas

负责：

- 栅格布局、拖动、缩放和碰撞避让。
- 组件选中、悬停工具条和空画布状态。
- 将布局变更转化为编辑器命令。
- 在编辑状态下包裹渲染组件，但不持有图表业务配置。

### 5.4 Inspector

右侧面板分为字段和样式两个页签：

- 字段页签根据组件 `dataSlots` 和 `fieldSchema` 生成配置界面。
- 样式页签根据 `styleSchema` 生成表单。
- 所有修改先经过 Zod 校验，再提交编辑器命令。

### 5.5 Data Workspace

负责数据源选择、文件上传、API 查询参数、字段列表、数据预览和刷新状态。它通过后端获取统一的数据集描述，不直接调用业务接口。

### 5.6 Component Registry

每个组件以统一协议注册：

```ts
interface ComponentDefinition<Props, Binding> {
  type: string;
  title: string;
  category: string;
  defaultLayout: GridLayout;
  defaultProps: Props;
  dataSlots: DataSlotDefinition[];
  fieldSchema: SchemaDefinition;
  styleSchema: SchemaDefinition;
  validateBinding(binding: Binding, dataset: DatasetSchema): ValidationResult;
  render(input: RenderInput<Props, Binding>): React.ReactNode;
}
```

新增组件应主要完成定义注册、ECharts option 转换和针对性测试，不修改画布主体。

### 5.7 Editor Core

编辑操作使用命令模型：

- `AddComponent`
- `RemoveComponent`
- `DuplicateComponent`
- `MoveResizeComponent`
- `UpdateComponentProps`
- `UpdateBinding`
- `ReplaceDataSource`

命令进入历史栈以支持撤销和重做。拖动过程只更新临时状态，在拖动结束时生成一条历史命令，避免历史栈爆炸。

## 6. 数据模型

### 6.1 Project Schema

```ts
interface ProjectSchema {
  schemaVersion: number;
  id: string;
  name: string;
  theme: ThemeConfig;
  layouts: Record<Breakpoint, GridItem[]>;
  components: ComponentInstance[];
  dataSources: DataSourceRef[];
  updatedAt: string;
}

interface ComponentInstance {
  id: string;
  type: ComponentType;
  title?: string;
  props: Record<string, unknown>;
  binding?: DataBinding;
}

interface DataBinding {
  dataSourceId: string;
  slots: Record<string, FieldBinding | FieldBinding[]>;
  transforms?: TransformDefinition[];
}
```

`Project Schema` 只保存数据源引用、字段绑定和必要的展示配置，不将完整 Excel 或业务查询结果嵌入项目 JSON。

### 6.2 Dataset Schema

后端把文件与业务接口响应规范化为：

```ts
interface DatasetSchema {
  id: string;
  name: string;
  sourceType: "file" | "api";
  fields: DatasetField[];
  previewRows: Record<string, unknown>[];
  rowCount?: number;
  refreshedAt: string;
}

interface DatasetField {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean";
  nullable: boolean;
}
```

## 7. 数据流

### 7.1 文件导入

1. 前端上传 CSV/XLS/XLSX。
2. 后端校验类型、大小和行数限制。
3. 后端解析文件并推断字段类型。
4. 后端返回 `DatasetSchema` 和有限行数的数据预览。
5. 前端把字段拖入组件数据槽位。
6. 注册表校验槽位数量和字段类型。
7. 渲染适配器把绑定及样式转换成 ECharts option。

### 7.2 业务接口查询

1. 前端提交数据源标识和被允许的查询参数。
2. BFF 校验参数并透传用户身份或服务端凭据。
3. Query Gateway 调用现有统一业务接口。
4. BFF 将响应规范化为 Dataset Schema 和数据行。
5. 超时、权限和业务错误映射为统一错误码。

浏览器不接收长期服务端凭据，不允许提交任意目标 URL。

## 8. 后端模块

### 8.1 Project Module

- 创建、查询、更新项目。
- 使用乐观版本号防止旧自动保存覆盖新数据。
- 校验 Project Schema。
- 提供独立预览页所需的项目快照。
- 在读取旧 Schema 时执行显式迁移。

### 8.2 DataSource Module

- 文件上传和解析。
- 字段类型推断及预览。
- 数据源元数据管理。
- 文件大小、行数、解析时长限制。

### 8.3 Query Gateway

- 维护允许调用的统一业务接口清单。
- 参数校验、权限透传、超时、重试和错误映射。
- 对查询日志做脱敏，不记录令牌和敏感响应正文。

## 9. API 草案

```text
POST   /projects
GET    /projects/:id
PUT    /projects/:id
GET    /projects/:id/preview

POST   /data-sources/files
GET    /data-sources/:id/schema
POST   /data-sources/business-query
POST   /data-sources/:id/preview
```

`PUT /projects/:id` 请求必须携带版本号。版本冲突返回 `409 PROJECT_VERSION_CONFLICT`，前端提示重新加载或复制为新项目。

## 10. 技术选型

### 10.1 Monorepo 与前端

- pnpm + Turborepo：管理多个应用及共享包。
- React + Vite + TypeScript：编辑器与预览应用。
- Ant Design：基础交互控件和表单。
- Apache ECharts：图表渲染。
- react-grid-layout：栅格拖拽、缩放和响应式断点。
- dnd-kit：组件面板及字段拖放。
- Zustand + Immer：编辑态、选择态和命令历史。
- TanStack Query：服务端数据缓存和请求状态。
- Zod：运行时 Schema 校验与类型推导。

### 10.2 后端与存储

- NestJS + Fastify：模块化 BFF/API 服务。
- Prisma + PostgreSQL：项目配置和数据源元数据持久化。
- OpenAPI：前后端接口契约及客户端生成。
- Redis 不纳入 MVP 默认依赖；只有查询缓存或异步任务有明确需求时再增加。

### 10.3 为什么不使用微服务

当前是内部 MVP，模块化单体能用最低部署成本保持领域边界。只有数据解析、查询网关或渲染任务出现独立伸缩、安全隔离或团队归属需求时，才拆为独立服务。

## 11. 推荐目录结构

```text
apps/
  editor-web/
  preview-web/
  api-server/

packages/
  project-schema/
  component-registry/
  chart-renderer/
  data-engine/
  editor-core/
  api-client/
  ui/
  eslint-config/
  tsconfig/
```

依赖方向：

```text
apps -> feature packages -> project-schema
chart-renderer -> component-registry + project-schema
editor-core -> project-schema
project-schema -> 不依赖 UI、网络和数据库
```

禁止 `project-schema` 反向依赖任何应用或渲染库。

## 12. 错误处理

- 每个画布组件设局部 Error Boundary，单个图表失败不拖垮整个画布。
- 数据源状态统一为 `idle/loading/success/error/stale`。
- 字段缺失或类型不匹配时，组件显示可操作的空态并定位到右侧字段配置。
- API 统一返回稳定错误码，UI 文案不直接展示后端堆栈。
- 文件格式、大小、工作表为空、列名重复、日期解析失败分别给出明确提示。
- 自动保存失败时保留本地未保存标记，并允许手动重试。

## 13. 性能策略

- 数据预览只返回有限行数，默认 100 行。
- 1 万行以内允许前端完成轻量筛选和映射；更大数据要求业务接口聚合或分页。
- 拖动时暂停不必要的图表重绘，在拖动结束后触发 resize。
- 画布组件使用稳定引用和按组件订阅，避免整张画布因单个属性变化而重渲染。
- ECharts 实例复用并在组件卸载时释放。
- 文件解析设置可配置的大小、行数和超时上限；超限文件拒绝或转异步任务，不阻塞 API 进程。

## 14. 测试策略

### 14.1 单元测试

- Project Schema 校验及迁移。
- 字段类型推断和绑定校验。
- ECharts option 转换。
- 命令历史、撤销和重做。
- 自动保存版本冲突处理。

### 14.2 组件与集成测试

- 组件注册表与 Schema 表单生成。
- 数据源状态和错误态。
- 栅格布局变更到 Project Schema 的同步。
- 后端项目模块和 Query Gateway 的契约测试。

### 14.3 E2E

核心路径：

1. 导入 Excel 或查询业务接口。
2. 添加柱状图。
3. 映射维度与指标字段。
4. 修改标题、颜色和图例。
5. 拖动并调整尺寸。
6. 保存项目。
7. 打开独立预览页并验证结果。

附加路径包括接口超时、错误文件、字段被移除、保存冲突和刷新恢复。

## 15. 开发节奏

以下按 2 名前端和 1 名后端估算；单人全栈建议按 8–10 周执行。

### 第 1 周：骨架与最小闭环

- 初始化 Monorepo、应用和共享包。
- 定义 Project Schema v1 和组件注册协议。
- 完成三栏编辑器、栅格画布、柱状图和文本组件。
- 完成拖入、选择、移动、缩放及本地保存恢复。

退出条件：用户能添加组件、修改布局，刷新后项目恢复。

### 第 2 周：数据闭环

- CSV/Excel 上传和解析。
- 统一业务接口查询网关。
- 字段类型推断、预览和字段拖放。
- 完成柱状图端到端字段绑定。

退出条件：文件和 API 数据均能驱动柱状图。

### 第 3 周：组件与配置体系

- 接入其余六个组件。
- 完成 Schema 驱动的字段和样式面板。
- 统一加载、空态、错误态和主题基线。

退出条件：新增组件不修改编辑器主体；八个组件均可完成合理配置。

### 第 4 周：持久化与预览

- 后端保存/加载及乐观版本控制。
- 自动保存。
- 独立预览页。
- Schema 迁移入口、权限透传和查询错误处理。

退出条件：编辑态和预览态一致，版本冲突不会静默覆盖。

### 第 5 周：稳定性与内部试用

- 完成核心 E2E 和性能基线。
- 验证 1 万行数据集。
- 增加异常恢复和必要埋点。
- 内部用户试用并收口缺陷。

退出条件：核心 E2E 通过，P0/P1 缺陷清零，可交付内部用户使用。

## 16. 主要风险与控制

| 风险 | 控制措施 |
| --- | --- |
| 图表配置逐渐充满条件分支 | 强制使用组件注册协议和 Schema 表单 |
| 编辑器与预览结果不一致 | 共用注册表、渲染器和 Project Schema |
| 大数据导致浏览器卡顿 | 服务端分页/聚合、预览限行、前端性能基线 |
| API 返回结构不统一 | Query Gateway 规范化为 Dataset Schema |
| 自动保存覆盖新内容 | 乐观版本号、409 冲突和本地未保存标记 |
| 项目配置升级后无法打开 | 从 v1 开始维护 schemaVersion 和迁移函数 |
| 过早引入复杂画布能力 | MVP 限定栅格画布，不引入 React Flow |

## 17. 交付物

- 可运行的编辑器应用。
- 可运行的独立预览应用。
- BFF/API 服务与数据库迁移。
- 八个组件及其字段/样式配置。
- CSV/Excel 与统一业务接口数据链路。
- Project Schema、OpenAPI 和组件注册协议文档。
- 核心自动化测试与内部试用清单。
