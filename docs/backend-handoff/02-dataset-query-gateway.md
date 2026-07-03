# 阶段 2：统一数据集查询网关

## 交付接口

```text
GET  /datasets
GET  /datasets/{datasetId}/schema
POST /datasets/{datasetId}/query
```

浏览器不得传入任意 URL、请求头或服务端凭据。`datasetId` 必须映射到服务端允许列表。

## DTO

```java
public record DatasetFieldDto(
    String key,
    String label,
    FieldType type,
    boolean nullable
) {}

public record DatasetSummaryDto(
    String id,
    String name,
    String schemaVersion
) {}

public enum FieldType { string, number, date, boolean }

public record QueryParameterDto(
    String key,
    String label,
    FieldType type,
    boolean required
) {}

public record DatasetSchemaDto(
    String id,
    String name,
    List<DatasetFieldDto> fields,
    List<QueryParameterDto> parameters,
    String schemaVersion
) {}

public record DatasetQueryRequest(Map<String, Object> parameters) {}

public record DatasetQueryResultDto(
    List<DatasetFieldDto> columns,
    List<Map<String, Object>> rows,
    Long total,
    Instant sampledAt
) {}
```

字段、参数和返回列的 key 必须各自唯一。

值语义固定如下：

- `date` 参数和 `date` 列值一律使用严格、日历有效的 `YYYY-MM-DD` 字符串（例如 `2026-07-02`）；不得发送时间戳、时区后缀或 JavaScript/Java 日期对象的默认字符串。
- `required: true` 的参数缺失或为 `null` 都是 400；`required: false` 的参数可以省略，但只要出现就不能为 `null`。
- 行中字段为 `null` 仅当对应返回列 `nullable: true`；`nullable: false` 的列出现 `null` 必须判为上游响应非法。

`GET /datasets` 精确返回 `DatasetSummaryDto[]`，不包裹 `data`、分页或上游连接信息：

```json
[
  { "id": "sales", "name": "销售数据", "schemaVersion": "v1" },
  { "id": "inventory", "name": "库存数据", "schemaVersion": "v3" }
]
```

`datasetId`、字段 key 和参数 key 是非空稳定字符串，不要求 UUID。固定 DTO 拒绝未知字段；请求 `parameters` 和响应中每个 `rows` 行对象是开放映射，必须安全保留任意自有字符串 key 和 JSON 值。

## 示例 Schema

```json
{
  "id": "sales",
  "name": "销售数据",
  "fields": [
    { "key": "month", "label": "月份", "type": "string", "nullable": false },
    { "key": "businessDate", "label": "业务日期", "type": "date", "nullable": false },
    { "key": "revenue", "label": "收入", "type": "number", "nullable": false },
    { "key": "discount", "label": "折扣", "type": "number", "nullable": true }
  ],
  "parameters": [
    { "key": "year", "label": "年份", "type": "number", "required": true },
    { "key": "fromDate", "label": "开始日期", "type": "date", "required": true },
    { "key": "region", "label": "区域", "type": "string", "required": false }
  ],
  "schemaVersion": "v1"
}
```

查询请求：

```json
{ "parameters": { "year": 2026, "fromDate": "2026-01-01" } }
```

查询响应：

```json
{
  "columns": [
    { "key": "month", "label": "月份", "type": "string", "nullable": false },
    { "key": "businessDate", "label": "业务日期", "type": "date", "nullable": false },
    { "key": "revenue", "label": "收入", "type": "number", "nullable": false },
    { "key": "discount", "label": "折扣", "type": "number", "nullable": true }
  ],
  "rows": [
    { "month": "1月", "businessDate": "2026-01-15", "revenue": 120000, "discount": null }
  ],
  "total": 1,
  "sampledAt": "2026-07-02T08:00:00.000Z"
}
```

## 服务端限制

- 上游超时：10 秒，返回 `504 DATASET_TIMEOUT`。
- 最大返回：10000 行；超限时由上游分页或聚合，不能把无限数据透传浏览器。
- 最大上游响应或规范化 JSON：5 MiB（5,242,880 UTF-8 bytes）；读取上游正文时也要设置流式硬上限，避免先完整载入超大响应。
- 数据预览前端只展示前 100 行，但接口可返回图表所需的受限结果。
- 服务端凭据仅来自环境变量、配置中心或公司服务身份。
- 日志记录 datasetId、耗时、行数和错误码；不记录令牌与完整数据行。
- 不自动重试非幂等查询；若统一接口查询为幂等，最多重试一次网络错误。

## 错误映射

| 场景 | HTTP/code |
| --- | --- |
| datasetId 不在允许列表 | 404 `DATASET_NOT_FOUND` |
| 缺少必填参数、类型不符、未知参数 | 400 `DATASET_QUERY_INVALID` |
| 上游超时 | 504 `DATASET_TIMEOUT` |
| 上游 4xx/5xx 或网络错误 | 502 `DATASET_UPSTREAM_ERROR` |
| 上游字段重复、类型非法、rows 非数组 | 502 `DATASET_INVALID_RESPONSE` |
| 上游或规范化结果超过 10000 行或 5 MiB | 502 `DATASET_INVALID_RESPONSE` |

所有错误响应均为 `{ "code": "...", "message": "..." }`。例如：

```json
{ "code": "DATASET_INVALID_RESPONSE", "message": "Dataset response exceeds the supported limit" }
```

## 必测用例

1. 数据集列表不暴露上游 URL 和凭据。
2. Schema 字段与参数 key 唯一。
3. 必填参数缺失和显式 `null` 都返回 400；可选参数省略成功、显式 `null` 返回 400；未知参数和类型不符返回 400。
4. 日期参数与日期行值只接受日历有效的 `YYYY-MM-DD`；`2026-02-29`、时间戳和带时区字符串被拒绝。
5. 字符串、数字、日期、布尔值能规范化；行 `null` 仅在对应列 `nullable: true` 时成功，非 nullable 列为 `null` 返回 `502 DATASET_INVALID_RESPONSE`。
6. 10000 行成功；规范化后 10001 行精确返回 `502 DATASET_INVALID_RESPONSE`。
7. 10 秒超时映射为 504。
8. 5 MiB 边界内成功；上游正文或规范化 JSON 超限精确返回 `502 DATASET_INVALID_RESPONSE`。
9. 上游异常正文和令牌不出现在 API 响应或普通日志中。
10. 固定 DTO 未知字段被拒绝，`parameters` 与行对象中的 `__proto__`、`constructor`、`prototype` 等自有 key 安全往返，包括数组/对象嵌套层级。

## 阶段验收

前端关闭 Dataset MSW handlers 后，可列出数据集、提交参数、查看字段和预览数据；错误码与 Mock 完全一致。
