# 阶段 4：NestJS 后端联调与验收清单

## 联调前置

- OpenAPI 与前端仓库当前提交一致。
- `apps/api` 提供测试环境 base URL。
- 数据同事提供至少 3 个脱敏数据集。
- 服务部署在公司内网、VPN 或现有网关之后；应用本身没有登录接口。
- CORS 仅允许内部前端域名，或由同源网关转发。

## 契约检查

- [ ] 所有 JSON 字段名和枚举大小写与 OpenAPI 一致。
- [ ] 所有必填/可选字段与 OpenAPI 一致。
- [ ] 时间为 UTC ISO 8601。
- [ ] 成功响应不包裹额外 `data` 层。
- [ ] 错误响应固定为 `{ code, message }`。
- [ ] 409、404、502、504 不被统一改写成 200。
- [ ] 未知字段处理策略一致。
- [ ] 固定 DTO 拒绝未知字段；`props`、`parameters`、`rows` 递归只接受 JSON 值，`slots` 值严格为 `FieldBinding | FieldBinding[]`；所有开放 key 在嵌套层安全往返。
- [ ] Dashboard ID 为 UUID；组件 ID、datasetId 与字段/参数 key 只要求非空稳定字符串。
- [ ] Dataset 的 `date` 参数和行值严格为日历有效的 `YYYY-MM-DD`。
- [ ] 必填参数不能缺失或为 `null`；可选参数可省略、但出现时不能为 `null`。
- [ ] 行值为 `null` 仅当对应列 `nullable: true`。

## 核心 E2E

1. `POST /dashboards` 创建看板。
2. `GET /datasets` 选择数据集。
3. `GET /datasets/{id}/schema` 获取字段和参数。
4. `POST /datasets/{id}/query` 返回图表数据。
5. 前端添加柱状图并绑定维度、指标。
6. `PUT /dashboards/{id}` 保存草稿。
7. `POST /dashboards/{id}/publish` 发布。
8. `GET /published-dashboards/{id}` 返回相同布局和配置。

## 异常 E2E

- [ ] 旧 revision 保存返回 409，较新草稿不被覆盖。
- [ ] 上游超时返回 504，前端显示可重试错误。
- [ ] 数据集字段版本变化后，旧绑定被前端标红。
- [ ] 发布失败时旧发布页仍可访问。
- [ ] 单个数据集异常不会让 Dashboard CRUD 不可用。
- [ ] 不存在的草稿和发布快照分别返回正确 404 code。
- [ ] 非 UUID Dashboard 路径参数返回 400 `DASHBOARD_SCHEMA_INVALID`，且不进入仓储操作。
- [ ] 损坏的持久化草稿发布返回 500 `INTERNAL_ERROR`；事务/持久化失败返回 500 `PUBLISH_FAILED`，两者都保留旧快照。
- [ ] 日期参数/日期行值的格式边界、required/optional 的 missing/null 组合，以及 nullable/non-nullable 行值组合均与阶段 2 用例一致。

## 性能与限制

- [ ] 看板 CRUD P95 小于 500ms（不含公司网关额外耗时）。
- [ ] 数据查询遵守 10 秒超时、10000 行和 5 MiB（5,242,880 bytes）限制；超行数/体积返回 502 `DATASET_INVALID_RESPONSE`。
- [ ] Dashboard 请求体遵守 2 MiB（2,097,152 bytes）、最多 100 个组件/布局项和 20 个数据集限制。
- [ ] 发布事务不调用上游数据接口。
- [ ] 数据库为 `updated_at` 建立索引。
- [ ] 普通日志中没有服务凭据和完整业务数据行。

## 后端交付证据

需要沉淀以下证据：

- OpenAPI 对照结果或契约测试报告。
- 数据库 migration 文件。
- Controller/Service 单元与集成测试结果。
- 核心/异常 E2E 结果。
- 测试环境 base URL。
- 上线与回滚说明。

本清单属于真实后端就绪后的生产联调门禁：不阻塞基于 MSW E2E 已通过的前端 MVP 完成与提交。全部勾选且 P0/P1 缺陷为 0 后，才切换生产前端的 API base URL。
