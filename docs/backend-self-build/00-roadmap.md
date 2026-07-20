# 自研后端工作规划

> 本文记录现阶段 MVP 的实现路线。鉴权、会话、资源级权限和对接同事业务服务的数据编排，见 [Nest BFF 架构规划](./05-nest-bff-architecture.md)；这些能力将在 MVP 的草稿、发布和数据集网关稳定后推进。

## 背景

后端技术栈固定为仓库内已有的 `apps/api`：NestJS + Fastify + Prisma + PostgreSQL。后续所有后端能力都在这个应用内推进，让前端、契约、mock、真实 API 和测试在同一个仓库内收敛。

现状：

- `apps/web` 仍主要通过 MSW mock API 开发和演示。
- `apps/api` 已有 NestJS + Fastify + Prisma + PostgreSQL 的后端骨架。
- `apps/api` 已实现 Dashboard 草稿 CRUD、发布快照、健康检查和 OpenAPI 页面。
- 数据集接口目前仍只在前端 mock 中完整存在，真实后端还没实现。
- 预览目前是前端实时快照；保存和发布后续要接真实后端。

## 目标

后端第一阶段目标不是做完整 BI 平台，而是让当前前端 MVP 能从 mock 切到真实 API：

1. 看板创建、读取、保存稳定可用。
2. 发布快照稳定可用。
3. 数据集列表、Schema、查询接口可用，先支持固定脱敏数据源。
4. 前端可以通过 API base URL 切换到 `apps/api`，不改业务代码。
5. 保存、发布、查看页行为与 MSW mock 契约一致。

## 不做范围

短期不要做这些，避免把后端范围撑大：

- 登录、账号、权限、组织、多租户。
- 任意数据源配置、任意 SQL、任意 REST URL。
- 数据集管理后台。
- 发布历史、回滚、审批流。
- 复杂缓存、任务队列、实时推送。
- 后端持久化预览快照。

预览保持前端实时快照即可；后端只负责保存草稿和发布快照。

## 当前后端模块职责

### `apps/api/src/dashboards`

负责编辑草稿：

- `POST /dashboards`
- `GET /dashboards/:id`
- `PUT /dashboards/:id`

已有能力：

- 使用 `DashboardSchema` 校验请求和响应。
- revision 乐观锁。
- Prisma 持久化 `draftSchema`。
- 统一错误码：`DASHBOARD_SCHEMA_INVALID`、`DASHBOARD_NOT_FOUND`、`DASHBOARD_ID_MISMATCH`、`DASHBOARD_VERSION_CONFLICT`。

### `apps/api/src/publishing`

负责发布快照：

- `POST /dashboards/:id/publish`
- `GET /published-dashboards/:id`

已有能力：

- 从 `draftSchema` 生成 `publishedSchema`。
- 发布页读取独立快照。
- 发布失败时不应该污染旧快照。

### 待新增：`apps/api/src/datasets`

负责统一数据集查询网关：

- `GET /datasets`
- `GET /datasets/:id/schema`
- `POST /datasets/:id/query`

第一版先对齐前端 mock 中的 `sales` 和 `inventory`，可以先使用服务端固定 fixtures，后续再接公司真实数据源。

## 阶段计划

### 阶段 0：本地后端可运行

目标：让自己能稳定启动和验证 `apps/api`。

任务：

- 明确本地 PostgreSQL 连接方式和 `.env`。
- 补齐 Prisma migration 或初始化 SQL。
- 跑通 `prisma generate`、schema validate、API typecheck、API tests。
- 确认 `GET /health`、`/openapi` 可访问。
- 写一段本地启动说明到 `docs/backend-self-build/01-local-dev.md`。

验收：

- `corepack pnpm --filter @drag-visual/api test`
- `corepack pnpm --filter @drag-visual/api typecheck`
- `corepack pnpm --filter @drag-visual/api prisma:validate`
- 本地 API 可响应 `GET /health`。

### 阶段 1：Dashboard 草稿 CRUD 打磨

目标：真实后端草稿接口与前端 mock 行为一致。

任务：

- 对照 `apps/web/src/mocks/handlers.ts` 校验真实 API 的状态码和错误码。
- 校验 2 MiB body 限制、组件/布局/数据集数量上限。
- 保证固定结构拒绝未知字段，开放 JSON 字段安全保留。
- 确认路径 ID 非 UUID 返回 `400 DASHBOARD_SCHEMA_INVALID`。
- 确认 URL/body ID 不一致返回 `409 DASHBOARD_ID_MISMATCH`。
- 确认 revision 冲突返回 `409 DASHBOARD_VERSION_CONFLICT`。
- 确认数据库列 `revision/name/updatedAt` 和 JSON 内部字段一致。

验收：

- API 单元/集成测试覆盖上述错误分支。
- 前端 `dashboardApi.test.ts` 能指向真实 API 或契约测试适配层通过。

### 阶段 2：发布快照打磨

目标：发布页读稳定快照，草稿后续编辑不影响已发布版本。

任务：

- 确认 publish 使用数据库事务。
- 确认损坏草稿发布失败不覆盖旧快照。
- 确认尚未发布时 `GET /published-dashboards/:id` 返回 `404 PUBLISHED_DASHBOARD_NOT_FOUND`。
- 确认发布接口无请求体也可成功。
- 确认发布成功返回完整 Dashboard Schema。

验收：

- 修改草稿但不发布，发布页仍显示旧快照。
- 再次发布后发布页更新。
- 事务失败测试能证明旧快照保留。

### 阶段 3：数据集查询网关

目标：前端数据绑定面板和查看页可以从真实 API 获取数据集信息和查询结果。

任务：

- 新增 `datasets` module/controller/service/repository。
- 先实现固定允许列表：
  - `sales`
  - `inventory`
- 从前端 mock fixtures 迁移一份后端测试 fixtures，保证字段名一致。
- 实现：
  - `GET /datasets`
  - `GET /datasets/:datasetId/schema`
  - `POST /datasets/:datasetId/query`
- 校验参数：
  - required 参数缺失或 `null` 返回 400。
  - optional 参数可省略，但出现时不能为 `null`。
  - 未知参数返回 400。
  - 日期必须是有效 `YYYY-MM-DD`。
- 校验响应：
  - columns key 唯一。
  - rows 是数组。
  - nullable false 字段不能返回 `null`。
  - 最多 10000 行。
  - JSON 最大 5 MiB。
- 错误码对齐：
  - `DATASET_NOT_FOUND`
  - `DATASET_QUERY_INVALID`
  - `DATASET_INVALID_RESPONSE`
  - `DATASET_UPSTREAM_ERROR`
  - `DATASET_TIMEOUT`

验收：

- 前端数据集页面能关闭 MSW 后正常列出数据集、查看 Schema、查询预览数据。
- 绑定后的发布页/预览页能查询 mock-equivalent 数据并渲染。

### 阶段 4：前端切真实 API

目标：保留 MSW 开发模式，同时支持真实 API 模式。

任务：

- 确认 `apps/web` 的 API base URL 配置。
- 增加一个真实 API 启动文档。
- 明确 dev mock 与真实 API 的切换方式。
- 跑核心 E2E：
  - 创建看板
  - 添加图表
  - 绑定数据
  - 保存
  - 发布
  - 打开发布页
- 保持预览前端实时快照，不依赖后端保存。

验收：

- mock 模式仍可用。
- 真实 API 模式完成核心流程。
- 保存/发布结果刷新页面后仍存在。

### 阶段 5：收口与上线准备

目标：从“能跑”变成“可交付”。

任务：

- OpenAPI 文档补全 DTO 和错误响应。
- CORS/网关配置确认。
- 环境变量说明。
- PostgreSQL migration 和回滚说明。
- 日志脱敏检查。
- 性能和大小限制检查。
- 发布前验收清单更新。

验收：

- `docs/release/frontend-mvp-checklist.md` 更新真实后端相关项。
- `docs/backend-self-build/04-acceptance.md` 勾选完成。

## 推荐执行顺序

1. 先跑通 `apps/api` 本地 PostgreSQL。
2. 再补齐 Dashboard/Publishing 的边界测试。
3. 然后做 Dataset Gateway。
4. 最后切前端真实 API 联调。

不要先做复杂数据源接入。第一版 Dataset Gateway 用固定 fixtures 更快，也能让前端完整流程先闭环。

## 前端与后端语义对齐

| 行为 | 当前前端语义 | 后端职责 |
| --- | --- | --- |
| 预览 | 当前编辑器实时快照 | 暂时无后端职责 |
| 保存 | 持久化草稿 | `PUT /dashboards/:id` |
| 发布 | 保存后生成稳定快照 | `POST /dashboards/:id/publish` |
| 编辑器加载 | 读取草稿 | `GET /dashboards/:id` |
| 发布页加载 | 读取发布快照 | `GET /published-dashboards/:id` |
| 数据绑定 | 读取数据集 schema/query | `GET/POST /datasets...` |

## 风险与决策

- `docs/backend-contract/` 仅保留为接口契约参考；实现以 `apps/api` 的 NestJS + Prisma 为准。
- 数据集真实来源未确定；先用固定允许列表和 fixtures，避免阻塞。
- 预览不走后端保存，刷新预览页或跨设备预览不是当前目标。
- 发布页查询业务数据仍是实时查询；发布快照固定的是布局、绑定、样式配置，不固定数据结果。

## 立即下一步

新增以下后续文档：

- `docs/backend-self-build/01-local-dev.md`
- `docs/backend-self-build/02-dashboard-publishing-hardening.md`
- `docs/backend-self-build/03-dataset-gateway.md`
- `docs/backend-self-build/04-acceptance.md`

然后从 `01-local-dev.md` 开始，把本地数据库、启动命令、迁移和 smoke test 固化下来。
