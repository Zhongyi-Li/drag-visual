# Drag Visual 内部 BI 看板 MVP 设计方案

- 日期：2026-07-01
- 状态：已确认，待书面复核
- 目标用户：公司内部单组织用户
- 开发资源：1 名全栈开发，1 名数据同事协作
- 视觉参考：用户提供的三栏式 BI 看板编辑器截图

## 1. 目标

建设一个内部可用的拖拽式 BI 看板平台。用户无需编写代码，即可完成以下闭环：

1. 从统一业务接口选择数据集。
2. 查看字段和预览数据。
3. 将图表拖入栅格画布。
4. 配置维度、指标、系列和基础样式。
5. 保存看板草稿。
6. 预览并发布为内部访问页面。

MVP 成功标准：内部用户可在 10 分钟内完成一张包含指标卡、趋势图和明细表的看板，并成功保存、发布；图表渲染 1 万行以内的查询结果不会造成明显卡顿，表格预览仍限制为前 100 行。

## 2. 范围

### 2.1 包含

- 三栏式编辑器：左侧组件区、中间栅格画布、右侧字段和样式面板。
- 组件添加、选择、移动、缩放、复制、删除。
- 撤销和重做。
- 六类组件：柱状图、折线图、饼图/环形图、指标卡、表格、文本。
- 折线图通过样式切换为面积图。
- 数据集选择、查询参数、字段 Schema 和前 100 行数据预览。
- 维度、指标和系列字段绑定。
- 简单排序、Top N 和数字格式。
- 看板主题色、背景和基础页面设置。
- 手动保存、自动保存、未保存状态提示。
- 预览、发布快照和重新发布。
- 接入公司现有内部身份体系或反向代理身份，不自建账号体系。

### 2.2 不包含

- CSV、Excel 导入。
- 数据库直连。
- 用户配置任意 REST URL、请求头或凭据。
- SQL 编辑器、跨表关联、计算字段和复杂数据转换。
- 多租户、计费、复杂 RBAC、多人实时协作和评论。
- 发布历史、版本回滚和审批流。
- 自由像素画布、任意叠层、连线和数据流节点编排。
- 图表市场、插件市场和移动端编辑。
- Redis、消息队列、微服务和独立数据处理服务。

## 3. 方案选择

采用 TypeScript 模块化单体：一个 React Web 应用、一个 NestJS API、一个 PostgreSQL 数据库。代码使用 pnpm Workspace 组织，共享 Schema、组件注册表和渲染器，但不引入 Turborepo。

没有采用纯前端直连业务接口，因为鉴权、接口结构、查询限制和发布快照会与前端强耦合。没有拆分微服务，因为单人开发阶段的部署、监控和服务通信成本超过收益。

## 4. 总体架构

```text
React Web
  ├─ 编辑器 /editor/:dashboardId
  ├─ 预览页 /preview/:dashboardId
  └─ 发布页 /view/:dashboardId
            │
            ▼
NestJS API
  ├─ Dashboard Module
  ├─ Publish Module
  └─ Dataset Gateway ──> 统一业务接口
            │
            ▼
       PostgreSQL
```

编辑器、预览页和发布页使用同一套 `Dashboard Schema`、组件注册表和渲染器。编辑器只增加选中态、拖拽外壳和配置面板，避免编辑态与发布态出现两套渲染逻辑。

## 5. 技术选型

| 领域 | 技术 |
| --- | --- |
| Web | React、Vite、TypeScript |
| UI | Ant Design |
| 图表 | Apache ECharts |
| 栅格画布 | react-grid-layout |
| 面板拖拽 | dnd-kit |
| 编辑器状态 | Zustand、Immer |
| 服务端状态 | TanStack Query |
| 表单 | React Hook Form |
| Schema 校验 | Zod |
| API | NestJS、Fastify |
| 持久化 | PostgreSQL、Prisma |
| 接口契约 | OpenAPI |
| 测试 | Vitest、Testing Library、Playwright |
| 仓库 | pnpm Workspace |

Vite 只负责 TypeScript 转译，CI 必须独立运行 `tsc --noEmit`。依赖版本在初始化时锁定，升级应单独验证 react-grid-layout、dnd-kit 和 ECharts 的交互回归。

## 6. 前端模块

### 6.1 Editor Shell

负责三栏布局、顶部工具栏、路由、保存状态和模块装配，不包含具体图表判断。

### 6.2 Component Palette

从组件注册表读取组件名称、图标、默认尺寸和默认配置。用户可以拖入组件，也可以点击添加。

### 6.3 Grid Canvas

采用栅格坐标保存 `x`、`y`、`w`、`h`。负责移动、缩放、碰撞避让、选择态和组件外壳，不持有图表业务配置。MVP 不支持像素级自由定位和重叠。

### 6.4 Inspector

右侧面板包含“数据”和“样式”两个页签。字段面板根据组件的数据槽位生成；样式面板根据组件配置 Schema 生成。所有提交先通过 Zod 校验。

### 6.5 Dataset Workspace

负责选择数据集、填写被允许的查询参数、展示字段和预览前 100 行。前端只调用本系统 API，不直接接触统一业务接口的长期凭据。

### 6.6 Component Registry

每个组件以统一定义注册：

```ts
interface ComponentDefinition<Props, Binding> {
  type: string;
  title: string;
  defaultLayout: GridLayout;
  defaultProps: Props;
  dataSlots: DataSlotDefinition[];
  propsSchema: ZodType<Props>;
  bindingSchema: ZodType<Binding>;
  validateBinding(binding: Binding, dataset: DatasetSchema): ValidationResult;
  render(input: RenderInput<Props, Binding>): React.ReactNode;
}
```

新增图表类型时，主要增加组件定义、ECharts option 转换和测试，不修改画布主体。

### 6.7 Editor Core

编辑操作使用命令模型：

- `AddComponent`
- `RemoveComponent`
- `DuplicateComponent`
- `MoveResizeComponent`
- `UpdateComponentProps`
- `UpdateBinding`
- `ReplaceDataset`

拖动和缩放过程使用临时状态，结束后只写入一条历史命令，避免撤销栈膨胀。

## 7. 状态边界

- Zustand 管理画布、选中项、临时配置和撤销历史。
- TanStack Query 管理数据集查询、草稿读取、保存和发布等服务端状态。
- 持久化事实源是 `Dashboard Schema`；选中项、面板展开状态和拖动中的临时坐标不写入数据库。
- 编辑器内不得复制一份独立的服务端缓存到 Zustand。

## 8. 数据契约

数据同事提供统一业务接口，本系统的 Dataset Gateway 将其规范化为固定契约：

```text
GET  /datasets
GET  /datasets/:datasetId/schema
POST /datasets/:datasetId/query
```

建议响应模型：

```ts
interface DatasetSchema {
  id: string;
  name: string;
  fields: DatasetField[];
  parameters: QueryParameter[];
  schemaVersion: string;
}

interface DatasetField {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean";
  nullable: boolean;
}

interface DatasetQueryResult {
  columns: DatasetField[];
  rows: Record<string, unknown>[];
  total?: number;
  sampledAt: string;
}
```

统一业务接口负责权限过滤、复杂聚合、分页和大数据处理。看板平台只做字段映射、简单排序和 Top N。查询网关必须限制超时、最大返回行数和响应体大小，并将业务错误转换为稳定错误码。

## 9. Dashboard Schema

```ts
interface DashboardSchema {
  schemaVersion: number;
  id: string;
  name: string;
  theme: ThemeConfig;
  layout: GridItem[];
  components: ComponentInstance[];
  datasets: DashboardDatasetRef[];
  revision: number;
  updatedAt: string;
}

interface ComponentInstance {
  id: string;
  type: "bar" | "line" | "pie" | "kpi" | "table" | "text";
  title?: string;
  props: Record<string, unknown>;
  binding?: DataBinding;
}

interface DataBinding {
  datasetId: string;
  slots: Record<string, FieldBinding | FieldBinding[]>;
  sort?: SortDefinition;
  limit?: number;
}
```

Schema 只保存数据集引用、查询参数、字段绑定、布局和展示配置，不嵌入完整查询结果。`schemaVersion` 从第一版开始存在，读取旧 Schema 时通过显式迁移函数升级。

## 10. 保存和发布

数据库中保留两类状态：

- `draftSchema`：当前编辑内容。
- `publishedSchema`：当前可访问的发布快照。

手动保存和自动保存均携带 `revision`。版本不匹配时返回 `409 DASHBOARD_VERSION_CONFLICT`，前端保留本地未保存内容并提示重新加载或另存。

发布在数据库事务中将已校验的草稿复制为发布快照。发布页只读取 `publishedSchema`，草稿后续变化不会影响线上展示；再次点击发布才替换快照。

## 11. API 草案

```text
POST   /dashboards
GET    /dashboards/:dashboardId
PUT    /dashboards/:dashboardId
POST   /dashboards/:dashboardId/publish
GET    /published-dashboards/:dashboardId

GET    /datasets
GET    /datasets/:datasetId/schema
POST   /datasets/:datasetId/query
```

所有请求复用公司内部身份。Dashboard API 校验用户是否具有内部访问权限；Dataset Gateway 将用户身份或服务端身份按公司约定透传，浏览器不保存长期服务端凭据。

## 12. 错误处理

- 每个图表使用局部 Error Boundary，单个组件异常不影响整张看板。
- 字段缺失或类型不匹配时显示可操作空态，并定位到字段面板。
- 数据集 `schemaVersion` 变化后重新校验绑定；失效字段标红，不自动替换。
- 查询状态统一为 `idle`、`loading`、`success`、`error`、`stale`。
- API 返回稳定错误码，前端不展示后端堆栈或上游敏感信息。
- 自动保存失败时保留未保存标记和本地编辑态，允许手动重试。
- 发布失败时继续保留上一个有效发布快照。

## 13. 性能约束

- 预览默认最多 100 行。
- 首版性能基线以 1 万行以内的查询结果为上限；超限由统一业务接口分页或聚合。
- 拖动时暂停不必要的 ECharts 重绘，拖动结束后调用 resize。
- 画布组件按组件 ID 订阅状态，单个属性变化不得触发全部组件重渲染。
- ECharts 实例复用并在卸载时释放。
- 发布页按路由拆包，编辑器依赖不进入发布页首屏包。

## 14. 测试策略

### 14.1 单元测试

- Dashboard Schema 校验和迁移。
- 字段绑定类型规则。
- 六类组件的 ECharts option 或展示模型转换。
- 命令历史、撤销和重做。
- 保存版本冲突和发布快照逻辑。

### 14.2 集成测试

- Dataset Gateway 的成功、超时、权限错误和异常响应。
- 栅格布局变化到 Dashboard Schema 的同步。
- Inspector 表单到组件配置的同步。
- 草稿保存、自动保存和发布事务。

### 14.3 E2E

核心路径：选择数据集，预览字段，添加柱状图，绑定维度和指标，调整样式和布局，保存，发布，打开发布页并验证结果。

附加路径：字段被移除、查询超时、保存冲突、发布失败、刷新恢复和单组件渲染异常。

## 15. 开发节奏

| 周次 | 重点 | 退出条件 |
| --- | --- | --- |
| 第 1 周 | Workspace、React、NestJS、PostgreSQL、Schema 和数据契约 | 可创建并读取空看板 |
| 第 2 周 | 三栏编辑器、栅格画布、基础编辑命令 | 可添加、移动、缩放和恢复占位组件 |
| 第 3 周 | Dataset Gateway、数据集选择、字段和预览 | 可选择真实数据集并看到字段和前 100 行 |
| 第 4 周 | 组件注册表、字段槽位、柱状图闭环 | 柱状图可绑定维度和指标并正确渲染 |
| 第 5 周 | 其余五类组件、字段和样式面板 | 六类组件均可合理配置 |
| 第 6 周 | 撤销、复制、保存、自动保存和异常恢复 | 刷新不丢数据，保存失败不覆盖编辑态 |
| 第 7 周 | 预览、发布快照、重新发布和内部身份接入 | 发布页与编辑器渲染一致 |
| 第 8 周 | E2E、性能、安全、内部试用和缺陷收口 | 核心流程通过，P0/P1 缺陷清零 |

功能开发以第 6 周完成为目标，第 7 至 8 周不再增加新的组件类型。

## 16. 数据同事协作事项

数据同事应在前两周完成：

- 固定数据集列表、字段描述和查询协议。
- 提供 3 至 5 个真实脱敏数据集。
- 覆盖字符串、数字、日期、空值和大数据量场景。
- 明确超时、权限错误和业务错误格式。
- 明确聚合、分页、最大行数和字段变更策略。

若第 2 周末真实接口尚未稳定，全栈开发使用同一 OpenAPI 契约的 Mock Server 继续推进，不让前端等待数据接口完成。

## 17. 主要风险

| 风险 | 控制措施 |
| --- | --- |
| 图表逻辑充满类型判断 | 使用组件注册表和统一数据槽位协议 |
| 编辑器和发布页不一致 | 共用 Schema、注册表和渲染器 |
| 上游接口变化导致看板失效 | 保存字段 key 和数据集 schemaVersion，加载时重新校验 |
| 大数据拖慢浏览器 | 预览限行，上游分页和聚合，建立 1 万行性能基线 |
| 自动保存覆盖新内容 | revision 乐观锁和 409 冲突处理 |
| 单人开发范围失控 | 固定六类组件，第 6 周后停止新增功能 |
| 数据接口延期 | 第 1 周锁定 OpenAPI，第 2 周准备契约 Mock |

## 18. 交付物

- 可运行的内部 BI 看板 Web 应用。
- NestJS API 和 PostgreSQL 数据库迁移。
- 六类组件及字段、样式配置。
- 统一业务接口数据链路。
- Dashboard Schema、OpenAPI 和组件注册协议。
- 草稿保存、预览、发布和重新发布。
- 核心自动化测试与内部试用清单。
