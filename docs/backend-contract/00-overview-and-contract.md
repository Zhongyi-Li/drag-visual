# BI 看板 MVP：NestJS + Prisma 后端总览与契约

> 当前后端技术栈固定为仓库内 `apps/api` 的 NestJS + Fastify + Prisma + PostgreSQL。本文档作为接口契约和边界用例参考；实际实施路线请看 [自研后端工作规划](../backend-self-build/00-roadmap.md)。

## 目标

后端为公司内部单组织 BI 看板提供三类能力：看板草稿 CRUD、统一数据集查询网关、发布快照。`apps/api` 实现必须保持字段名、枚举、HTTP 状态码和错误码一致，前端可通过 OpenAPI 和固定示例独立开发。

## MVP 明确不做

- 登录页、用户表、JWT、Session、验证码。
- 角色、看板级权限、审计记录。
- CSV/Excel、数据库直连、任意 REST URL。
- SQL 编辑、跨表关联、计算字段、复杂数据转换。
- 多租户、发布历史、版本回滚和审批流。

服务只部署在公司内网、VPN 或现有网关之后。所有内部访问者暂时拥有相同能力。

## 技术建议

- NestJS + Fastify，保持当前 `apps/api` 模块结构。
- Prisma 作为 ORM 和 migration 工具。
- PostgreSQL，`jsonb` 保存看板 Schema。
- 复用 `@drag-visual/contracts` 作为 Dashboard Schema 校验来源。
- OpenAPI 由 `apps/api` 根据 Controller/DTO 生成，并与前端 mock 契约保持一致。

## 通用协议

- Content-Type：`application/json`。
- 时间：UTC ISO 8601，例如 `2026-07-02T08:00:00.000Z`。
- Dashboard ID：UUID 字符串；仅 Dashboard 路径参数和 `Dashboard.id` 使用 UUID 规则。
- `components.id`、`layout.i`、`datasetId`、字段 key 和参数 key：非空、保存后稳定的字符串，不要求 UUID。
- 字段 key 区分大小写，保存后不得自动改名。
- 固定结构 DTO（Dashboard、组件、binding、layout、dataset schema/result 等）拒绝未知字段。
- 开放 JSON 映射 `props`、Dashboard/Dataset 查询 `parameters` 和每个 `rows` 行对象保留任意自有字符串 key，值只能递归包含 `null`、字符串、布尔值、有限数字、数组和普通对象；拒绝 undefined、日期对象、NaN/Infinity、BigInt、函数、Symbol 和循环引用。
- `slots` 同样安全保留任意自有字符串 key，但每个值必须严格是 `FieldBinding` 或 `FieldBinding[]`，不能接收任意 JSON 值。
- 所有开放映射在每个嵌套层级都必须安全保留 `__proto__`、`constructor`、`prototype`，不得用原型继承对象做中间映射或发生原型污染。
- 成功响应直接返回业务对象，不再包裹 `{ code, data }`。

错误响应固定为：

```json
{
  "code": "DASHBOARD_NOT_FOUND",
  "message": "Dashboard was not found"
}
```

禁止向前端返回堆栈、SQL、上游响应正文、令牌或服务端凭据。

## Dashboard Schema v1

```json
{
  "schemaVersion": 1,
  "id": "6c614d7a-386b-4f36-a9ad-f9305b255b4f",
  "name": "销售看板",
  "theme": {
    "primaryColor": "#1677ff",
    "backgroundColor": "#f5f7fa"
  },
  "layout": [
    { "i": "cmp-1", "x": 0, "y": 0, "w": 6, "h": 5 }
  ],
  "components": [
    {
      "id": "cmp-1",
      "type": "bar",
      "title": "月收入",
      "props": { "color": "#1677ff" },
      "binding": {
        "datasetId": "sales",
        "slots": {
          "dimension": { "fieldKey": "month" },
          "measure": { "fieldKey": "revenue" }
        },
        "limit": 100
      }
    }
  ],
  "datasets": [
    {
      "datasetId": "sales",
      "schemaVersion": "v1",
      "parameters": { "year": 2026 }
    }
  ],
  "revision": 3,
  "updatedAt": "2026-07-02T08:00:00.000Z"
}
```

约束：

- `schemaVersion` 首版只能为 `1`。
- 已保存 Dashboard 的 `name` 长度 1–100；创建请求中的 `name` 可缺失或为 `null`，trim 后为空时服务端写入 `未命名看板`。
- 颜色必须是 `#RRGGBB`。
- 组件类型：`bar | line | pie | kpi | table | text`。
- `layout.i` 与 `components.id` 必须一一对应且各自唯一。
- `datasets.datasetId` 唯一。
- 每个绑定的 `datasetId` 必须在 `datasets` 中声明。
- `revision >= 1`，由服务端控制递增。
- `limit` 为 1–10000。
- Dashboard JSON 请求体最大 2 MiB（2,097,152 UTF-8 bytes）；超限返回 `400 DASHBOARD_SCHEMA_INVALID`。
- `components` 与 `layout` 各最多 100 项，`datasets` 最多 20 项；超限返回 `400 DASHBOARD_SCHEMA_INVALID`。

## 稳定错误码

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `DASHBOARD_SCHEMA_INVALID` | 看板 JSON 不满足 v1 Schema，或 Dashboard 路径参数不是 UUID |
| 404 | `DASHBOARD_NOT_FOUND` | 草稿不存在 |
| 404 | `PUBLISHED_DASHBOARD_NOT_FOUND` | 尚未发布或记录不存在 |
| 409 | `DASHBOARD_ID_MISMATCH` | URL ID 与请求体 ID 不一致 |
| 409 | `DASHBOARD_VERSION_CONFLICT` | revision 已过期 |
| 400 | `DATASET_QUERY_INVALID` | 查询参数不符合字段定义 |
| 404 | `DATASET_NOT_FOUND` | 数据集不存在 |
| 502 | `DATASET_INVALID_RESPONSE` | 上游响应无法规范化 |
| 502 | `DATASET_UPSTREAM_ERROR` | 上游非超时错误 |
| 504 | `DATASET_TIMEOUT` | 上游查询超时 |
| 500 | `PUBLISH_FAILED` | 发布事务/持久化失败，旧快照仍有效 |
| 500 | `INTERNAL_ERROR` | 持久化草稿损坏或未分类内部错误；响应不得暴露内部细节 |

表中每个错误都必须返回 JSON 对象 `{ "code": "...", "message": "..." }`，包括框架层参数校验、请求体超限、未捕获异常和上游错误；不得返回框架默认错误页或另一种错误结构。若 `apps/api` 与本文契约存在差异，以修正实现或更新契约为准，冻结前必须保持一致。

## 后端阶段顺序

1. [看板草稿 CRUD](./01-dashboard-crud.md)
2. [数据集查询网关](./02-dataset-query-gateway.md)
3. [发布与预览](./03-publish-and-preview.md)
4. [联调验收](./04-integration-acceptance.md)
