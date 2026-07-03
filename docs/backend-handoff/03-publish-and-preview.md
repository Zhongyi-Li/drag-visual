# 阶段 3：发布快照与只读预览

## 交付接口

```text
POST /dashboards/{dashboardId}/publish
GET  /published-dashboards/{dashboardId}
```

## 发布规则

1. 读取当前 `draft_schema`。
2. 使用完整 Dashboard Schema v1 再校验一次。
3. 在一个数据库事务内把草稿深拷贝为 `published_schema`。
4. 返回已发布快照。
5. 后续草稿编辑不得影响已发布页面；再次 publish 才替换快照。
6. 发布失败时保留上一个有效 `published_schema`。

发布请求没有请求体，也不要求发送 `{}`：

```http
POST /dashboards/6c614d7a-386b-4f36-a9ad-f9305b255b4f/publish
Content-Length: 0
```

Spring Service 伪代码：

```java
@Transactional
public JsonNode publish(UUID dashboardId) {
    DashboardEntity entity = repository.findByIdForUpdate(dashboardId)
        .orElseThrow(DashboardNotFoundException::new);
    JsonNode validated = dashboardSchemaValidator.validate(entity.getDraftSchema());
    entity.setPublishedSchema(validated.deepCopy());
    repository.save(entity);
    return entity.getPublishedSchema();
}
```

## 响应

- 发布成功：`200` + 完整 Dashboard Schema。
- 草稿不存在：`404 DASHBOARD_NOT_FOUND`。
- 尚未发布：`GET` 返回 `404 PUBLISHED_DASHBOARD_NOT_FOUND`。
- 持久化的 `draft_schema` 损坏、无法通过完整 Schema v1 校验：`500 INTERNAL_ERROR`，不覆盖旧快照；响应不得暴露损坏 JSON 或校验细节。
- 事务或持久化失败：`500 PUBLISH_FAILED`，旧快照保持可读。

成功响应示例就是发布时完整的 `published_schema`（字段与[总览示例](./00-overview-and-contract.md)完全相同），不返回 `{data: ...}` 包装；随后 GET 返回逐字段相同的 JSON 快照。

错误响应仍固定为 `{ "code": "...", "message": "..." }`，例如：

```json
{ "code": "PUBLISHED_DASHBOARD_NOT_FOUND", "message": "Published dashboard was not found" }
```

## 数据查询

发布页仍通过 Dataset Gateway 获取实时业务数据，因此相同发布快照在不同时间看到的业务数值可以变化；固定不变的是布局、组件、字段绑定、查询参数和样式配置。配置只在再次发布后变化，查询结果永远不写入 `published_schema` JSONB。

## 必测用例

1. 首次发布后 GET 返回完全相同的快照。
2. 修改草稿但不发布，GET 仍返回旧快照。
3. 再次发布后 GET 返回新快照。
4. 人工构造损坏的持久化草稿，发布精确返回 `500 INTERNAL_ERROR`，旧快照未改变且响应不泄漏草稿/校验细节。
5. 事务或持久化异常精确返回 `500 PUBLISH_FAILED` 并回滚，旧快照未改变。
6. 尚未发布返回精确 404 错误码。
7. `published_schema` 是独立 JSON 值，不与内存中的草稿对象共享可变引用。

## 阶段验收

前端可保存草稿、点击发布、打开 `/view/{id}`；编辑器继续修改时，发布页的布局、绑定和样式配置不变化，重新发布后才更新配置。发布页实时查询的业务数值允许随上游数据变化。
