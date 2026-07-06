# 数据集查询网关

## 当前状态

`apps/api` 已新增 Dataset Gateway 的第一版真实接口。它使用服务端固定 fixtures，不依赖前端 MSW，也不接任意外部数据源。

第一版目标是让前端在关闭 MSW 后，也能完成数据集列表、字段 Schema、查询预览和图表绑定流程。

## 已实现接口

```text
GET  /datasets
GET  /datasets/:datasetId/schema
POST /datasets/:datasetId/query
```

固定允许列表：

- `sales`
- `inventory`

## 模块结构

```text
apps/api/src/datasets/
  dataset.controller.ts
  dataset.module.ts
  dataset.repository.ts
  dataset.service.ts
  fixture-dataset.repository.ts
```

职责划分：

- `DatasetController`：HTTP 路由、请求体解析、稳定错误响应。
- `DatasetService`：参数校验、日期校验、结果校验、大小限制。
- `DatasetRepository`：数据源抽象。
- `FixtureDatasetRepository`：当前固定 fixtures 实现。

后续接真实数据源时，优先替换 repository 实现，不改 Controller 和前端契约。

## 查询参数规则

- 必填参数必须存在，且不能为 `null`。
- 可选参数可以省略。
- 可选参数出现时不能为 `null`。
- 未知参数返回 `400 DATASET_QUERY_INVALID`。
- 参数类型必须与 Schema 声明一致。
- `date` 参数必须是严格、日历有效的 `YYYY-MM-DD` 字符串。

## 响应校验规则

- `columns.key` 必须唯一。
- `rows` 必须是数组。
- 非 `nullable` 列不能返回 `null`。
- 非空值必须匹配列类型。
- `date` 列值必须是严格、日历有效的 `YYYY-MM-DD` 字符串。
- 最多返回 10000 行。
- 规范化 JSON 结果最大 5 MiB。

## 错误响应

所有错误保持 `{ code, message }`：

```json
{ "code": "DATASET_QUERY_INVALID", "message": "Dataset query is invalid" }
```

当前 fixture-backed 版本会返回：

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `DATASET_QUERY_INVALID` | 查询请求体或参数非法 |
| 404 | `DATASET_NOT_FOUND` | datasetId 不在允许列表 |
| 502 | `DATASET_INVALID_RESPONSE` | 服务端数据结果不符合契约 |

`DATASET_TIMEOUT` 和 `DATASET_UPSTREAM_ERROR` 仍保留在契约中，等真实上游 adapter 接入时实现。

## 手工验证

启动 API 后：

```bash
curl http://127.0.0.1:3000/datasets
curl http://127.0.0.1:3000/datasets/sales/schema
curl -X POST http://127.0.0.1:3000/datasets/sales/query \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"year":2026,"fromDate":"2026-01-01"}}'
```

## 自动验证

```bash
corepack pnpm --filter @drag-visual/api exec vitest run src/datasets/dataset.service.test.ts src/datasets/dataset.controller.test.ts
corepack pnpm --filter @drag-visual/api test
corepack pnpm --filter @drag-visual/api typecheck
```

## 后续工作

- 增加真实上游数据源 adapter。
- 将 `DATASET_TIMEOUT` 和 `DATASET_UPSTREAM_ERROR` 映射到真实请求失败场景。
- 前端关闭 MSW 后，用 `VITE_API_BASE_URL` 指向 `apps/api` 跑核心绑定流程。
