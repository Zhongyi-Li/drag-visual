# 阶段 1：Dashboard 草稿 CRUD

## 交付接口

```text
POST /dashboards
GET  /dashboards/{dashboardId}
PUT  /dashboards/{dashboardId}
```

## Spring Boot DTO

```java
public record CreateDashboardRequest(
    @Nullable @Size(max = 100) String name
) {}

public record ErrorResponse(String code, String message) {}
```

Dashboard 主体可使用 `JsonNode` 接收，但进入 Service 前必须执行完整 Schema v1 校验；不能只校验顶层字段。建议把校验器封装为 `DashboardSchemaValidator`，Controller 不直接操作数据库。

固定结构 DTO 拒绝未知字段；`props` 和 `parameters` 是递归 JSON-only 开放映射，`slots` 只开放 key、值仍严格为 `FieldBinding | FieldBinding[]`；三者都必须在嵌套层安全保留任意自有字符串 key。Dashboard 请求体最大 2 MiB（2,097,152 UTF-8 bytes），`components` 与 `layout` 各最多 100 项，`datasets` 最多 20 项。请求体超限可能在 Controller 前发生，必须由全局异常处理器转换为同结构的 `400 DASHBOARD_SCHEMA_INVALID`。

## POST /dashboards

请求：

```json
{ "name": "销售看板" }
```

以下请求同样合法并生成默认名称：`{}`、`{ "name": null }`、`{ "name": "   " }`。

规则：

- `name` 缺失、`null` 或 trim 后为空时使用 `未命名看板`。
- 超过 100 字符返回 `400 DASHBOARD_SCHEMA_INVALID`。
- 服务端生成 UUID、`revision=1`、更新时间和默认主题。

响应：`201` + 完整 Dashboard Schema。

响应示例（省略的数组确实为空，不是未返回）：

```json
{
  "schemaVersion": 1,
  "id": "6c614d7a-386b-4f36-a9ad-f9305b255b4f",
  "name": "销售看板",
  "theme": { "primaryColor": "#1677ff", "backgroundColor": "#f5f7fa" },
  "layout": [],
  "components": [],
  "datasets": [],
  "revision": 1,
  "updatedAt": "2026-07-02T08:00:00.000Z"
}
```

## GET /dashboards/{id}

- `{id}` 不是合法 UUID：在查询数据库前返回精确的 `400` + `{ "code": "DASHBOARD_SCHEMA_INVALID", "message": "Dashboard schema is invalid" }`。
- 存在：`200` + `draft_schema`。
- 不存在：`404 DASHBOARD_NOT_FOUND`。
- 从数据库读出的 JSON 也要校验；损坏数据返回 `500` + `{ "code": "INTERNAL_ERROR", "message": "Internal server error" }`，服务端日志记录 dashboardId，但响应不得返回损坏 JSON 或内部细节。

## PUT /dashboards/{id}

- `{id}` 不是合法 UUID：必须优先于 URL/body ID 比较和数据库操作返回精确的 `400 DASHBOARD_SCHEMA_INVALID`。
- 请求体为完整 Dashboard Schema。
- URL ID 与 body.id 不同：`409 DASHBOARD_ID_MISMATCH`。
- revision 过期：`409 DASHBOARD_VERSION_CONFLICT`。
- 成功：revision 精确加 1，updatedAt 由服务端重写，返回新 Schema。

请求体是[总览文档](./00-overview-and-contract.md)中的完整 Dashboard 示例；例如请求 `revision: 3`，成功响应返回相同业务配置、`revision: 4` 和新的 `updatedAt`。GET 与 PUT 的成功响应都不得删减字段或增加包装层。

原子更新 SQL 语义：

```sql
UPDATE bi_dashboard
SET name = :name,
    revision = :next_revision,
    draft_schema = :next_schema::jsonb,
    updated_at = :next_updated_at
WHERE id = :id
  AND revision = :expected_revision;
```

受影响行数不是 1 时，不得再执行无条件覆盖。

`next_schema` 必须先由服务端从已校验请求构造，并把其中的 `revision` 改为 `expected_revision + 1`、`updatedAt` 改为与 `:next_updated_at` 完全相同的 UTC 时间；随后用上面的单条 SQL 同时写入列与 JSONB，避免列值和 JSON 值分叉。

受影响行数为 0 时，用同一连接查询 `SELECT revision FROM bi_dashboard WHERE id=:id`：查不到返回 `404 DASHBOARD_NOT_FOUND`；查到则返回 `409 DASHBOARD_VERSION_CONFLICT`。不要先查再更新，也不要把所有 0 行都误报为 409。

错误示例（所有 400/404/409/500 均保持相同结构）：

```json
{ "code": "DASHBOARD_VERSION_CONFLICT", "message": "Dashboard revision is stale" }
```

## PostgreSQL 表

```sql
CREATE TABLE bi_dashboard (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  draft_schema JSONB NOT NULL,
  published_schema JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bi_dashboard_updated_at
  ON bi_dashboard (updated_at DESC);
```

## 必测用例

1. 创建空看板，默认字段与 Schema v1 完整。
2. 空白名称变为 `未命名看板`。
3. 获取不存在看板返回精确 404 错误码。
4. 正常保存 revision 从 1 变 2。
5. 两个请求同时带 revision 1，只有一个成功，另一个 409。
6. URL/body ID 不一致返回 409，数据库不变。
7. 非法组件类型、重复组件 ID、孤立布局和未声明数据集绑定均返回 400。
8. `props` 和 `parameters` 中包含合法 JSON key `__proto__`、`constructor`、`prototype` 时不得丢失或改变对象结构。
9. 2 MiB（2,097,152 bytes）边界内成功、超过边界返回 400；101 个组件、101 条布局或 21 个数据集分别返回 400。
10. 固定 DTO 的未知字段返回 400；`props`、`parameters` 的递归 JSON-only 值与 `slots` 的严格绑定值均校验；三者任意自有字符串 key 在嵌套往返后保持不变且无原型污染。
11. 更新成功后数据库列与 `draft_schema.revision/updatedAt` 完全一致；0 行更新分别正确区分 404 和 409。
12. GET/PUT 路径 ID 非 UUID 时精确返回 `400 DASHBOARD_SCHEMA_INVALID`，且不执行查询或更新；路径 ID 与 body.id 均为合法 UUID 但不同时仍返回 409。

## 阶段验收

前端关闭 MSW 后，仅替换 API base URL，即可创建、读取和保存看板；无需修改 DTO 映射。
