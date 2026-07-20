# 后端本地开发启动说明

## 目标

让 `apps/api` 在本地连接 PostgreSQL 后稳定启动，并具备最小 smoke test。

## 服务组成

- Runtime：Node.js / pnpm workspace
- Web framework：NestJS + Fastify
- ORM：Prisma 7
- Database：PostgreSQL
- Schema：`prisma/schema.prisma`
- Prisma Client 输出：`apps/api/src/generated/prisma`

## 环境变量

在项目根目录复制环境变量模板：

```bash
cp .env.example .env
```

然后在根目录 `.env` 中至少配置：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME"
PORT=3000
```

`PORT` 可省略，默认 `3000`。

## 初始化步骤

1. 安装依赖

```bash
corepack pnpm install
```

2. 启动本地 PostgreSQL

```bash
corepack pnpm db:up
```

这会启动仓库内 `compose.yaml` 定义的 PostgreSQL 16 服务，使用 `.env.example` 中的默认连接信息。

3. 校验 Prisma schema

```bash
corepack pnpm prisma:validate
```

4. 生成 Prisma Client

```bash
corepack pnpm prisma:generate
```

5. 准备数据库表

当前 schema 对应的表模型是 `DashboardRecord`。首次初始化时创建 migration：

```bash
corepack pnpm prisma:migrate --name init
```

6. 启动 API

```bash
corepack pnpm --filter @drag-visual/api dev
```

6. 验证健康检查

```bash
curl http://127.0.0.1:3000/health
```

期望响应：

```json
{ "status": "ok" }
```

## 常用验证命令

```bash
corepack pnpm --filter @drag-visual/api test
corepack pnpm --filter @drag-visual/api typecheck
corepack pnpm prisma:validate
```

## 最小手工联调

创建看板：

```bash
curl -X POST http://127.0.0.1:3000/dashboards \
  -H 'Content-Type: application/json' \
  -d '{"name":"本地测试看板"}'
```

读取看板：

```bash
curl http://127.0.0.1:3000/dashboards/<dashboard-id>
```

发布看板：

```bash
curl -X POST http://127.0.0.1:3000/dashboards/<dashboard-id>/publish
```

读取发布快照：

```bash
curl http://127.0.0.1:3000/published-dashboards/<dashboard-id>
```

## 待补齐

- [ ] 正式 Prisma migration。
- [ ] 本地 Docker Compose 或明确复用已有 PostgreSQL。
- [ ] `.env.example`。
- [ ] `apps/api/scripts/start-smoke.mjs` 的使用说明。
- [ ] 前端真实 API 模式的 base URL 配置说明。
