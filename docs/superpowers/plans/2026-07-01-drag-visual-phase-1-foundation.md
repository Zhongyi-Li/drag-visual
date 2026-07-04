# Phase 1: Workspace, Contracts, and API Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the pnpm workspace, shared dashboard contracts, React route shell, NestJS/Fastify API, PostgreSQL persistence, and the first create/read dashboard vertical slice.

**Architecture:** Keep domain contracts in a dependency-free package shared by Web and API. Persist validated dashboard drafts as JSON through a repository boundary, while the Web app accesses the API through TanStack Query.

**Tech Stack:** pnpm Workspace, TypeScript, React, Vite, React Router, TanStack Query, Zod, NestJS, Fastify, Prisma, PostgreSQL, Vitest, Testing Library, Supertest.

---

## Task 1: Initialize the workspace and quality gates

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create the root package manifest**

```json
{
  "name": "drag-visual",
  "private": true,
  "packageManager": "pnpm@10",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "pnpm --parallel --filter @drag-visual/web --filter @drag-visual/api dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "vitest run --workspace vitest.workspace.ts",
    "test:watch": "vitest --workspace vitest.workspace.ts",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "@types/node": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Define workspace discovery**

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 3: Define strict shared TypeScript settings**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: Configure Vitest workspace projects**

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "apps/*/vitest.config.ts",
]);
```

- [ ] **Step 5: Add environment documentation**

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/drag_visual
PORT=3000
VITE_API_BASE_URL=http://localhost:3000
BUSINESS_API_BASE_URL=http://localhost:4010
```

- [ ] **Step 6: Install root dependencies and verify the workspace**

Run: `pnpm install && pnpm typecheck`

Expected: install succeeds; recursive typecheck exits successfully even before child packages exist.

- [ ] **Step 7: Commit the workspace foundation**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts .env.example .gitignore
git commit -m "chore: initialize drag visual workspace"
```

## Task 2: Define versioned dashboard and dataset contracts

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/vitest.config.ts`
- Create: `packages/contracts/src/dashboard.ts`
- Create: `packages/contracts/src/dataset.ts`
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/dashboard.test.ts`
- Test: `packages/contracts/src/dataset.test.ts`

- [ ] **Step 1: Create the contracts package**

```json
{
  "name": "@drag-visual/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "zod": "latest" },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

- [ ] **Step 2: Write failing dashboard schema tests**

```ts
import { describe, expect, it } from "vitest";
import { DashboardSchema } from "./dashboard";

describe("DashboardSchema", () => {
  it("accepts a new empty dashboard", () => {
    expect(
      DashboardSchema.parse({
        schemaVersion: 1,
        id: "dash-1",
        name: "销售概览",
        theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
        layout: [],
        components: [],
        datasets: [],
        revision: 1,
        updatedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).toMatchObject({ id: "dash-1", schemaVersion: 1 });
  });

  it("rejects an unknown component type", () => {
    const result = DashboardSchema.safeParse({
      schemaVersion: 1,
      id: "dash-1",
      name: "Invalid",
      theme: { primaryColor: "#1677ff", backgroundColor: "#fff" },
      layout: [{ i: "cmp-1", x: 0, y: 0, w: 4, h: 4 }],
      components: [{ id: "cmp-1", type: "map", props: {} }],
      datasets: [],
      revision: 1,
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the dashboard test and verify failure**

Run: `pnpm --filter @drag-visual/contracts test -- dashboard.test.ts`

Expected: FAIL because `./dashboard` does not exist.

- [ ] **Step 4: Implement the dashboard schema**

```ts
import { z } from "zod";

export const ComponentTypeSchema = z.enum(["bar", "line", "pie", "kpi", "table", "text"]);

export const GridItemSchema = z.object({
  i: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const FieldBindingSchema = z.object({
  fieldKey: z.string().min(1),
});

export const DataBindingSchema = z.object({
  datasetId: z.string().min(1),
  slots: z.record(z.string(), z.union([FieldBindingSchema, z.array(FieldBindingSchema)])),
  sort: z.object({ fieldKey: z.string(), direction: z.enum(["asc", "desc"]) }).optional(),
  limit: z.number().int().positive().max(10_000).optional(),
});

export type DataBinding = z.infer<typeof DataBindingSchema>;

export const ComponentInstanceSchema = z.object({
  id: z.string().min(1),
  type: ComponentTypeSchema,
  title: z.string().optional(),
  props: z.record(z.string(), z.unknown()),
  binding: DataBindingSchema.optional(),
});

export const DashboardSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  theme: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  layout: z.array(GridItemSchema),
  components: z.array(ComponentInstanceSchema),
  datasets: z.array(z.object({
    datasetId: z.string(),
    schemaVersion: z.string().min(1),
    parameters: z.record(z.string(), z.unknown()),
  })),
  revision: z.number().int().positive(),
  updatedAt: z.string().datetime(),
}).superRefine((value, context) => {
  const componentIds = new Set(value.components.map((component) => component.id));
  for (const item of value.layout) {
    if (!componentIds.has(item.i)) {
      context.addIssue({ code: "custom", path: ["layout"], message: `Unknown component ${item.i}` });
    }
  }
});

export type Dashboard = z.infer<typeof DashboardSchema>;
export type ComponentType = z.infer<typeof ComponentTypeSchema>;
export type ComponentInstance = z.infer<typeof ComponentInstanceSchema>;
export type GridItem = z.infer<typeof GridItemSchema>;
```

- [ ] **Step 5: Write failing dataset contract tests**

```ts
import { describe, expect, it } from "vitest";
import { DatasetQueryResultSchema, DatasetSchema } from "./dataset";

describe("dataset contracts", () => {
  it("parses schema and rows", () => {
    const fields = [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "revenue", label: "收入", type: "number", nullable: false },
    ];
    expect(DatasetSchema.parse({ id: "sales", name: "销售", fields, parameters: [], schemaVersion: "v1" }).id).toBe("sales");
    expect(DatasetQueryResultSchema.parse({ columns: fields, rows: [{ month: "1月", revenue: 10 }], sampledAt: "2026-07-01T00:00:00.000Z" }).rows).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Implement dataset contracts and exports**

```ts
// packages/contracts/src/dataset.ts
import { z } from "zod";

export const DatasetFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["string", "number", "date", "boolean"]),
  nullable: z.boolean(),
});

export const QueryParameterSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["string", "number", "date", "boolean"]),
  required: z.boolean(),
});

export const DatasetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fields: z.array(DatasetFieldSchema),
  parameters: z.array(QueryParameterSchema),
  schemaVersion: z.string().min(1),
});

export const DatasetQueryResultSchema = z.object({
  columns: z.array(DatasetFieldSchema),
  rows: z.array(z.record(z.string(), z.unknown())).max(10_000),
  total: z.number().int().nonnegative().optional(),
  sampledAt: z.string().datetime(),
});

export type Dataset = z.infer<typeof DatasetSchema>;
export type DatasetField = z.infer<typeof DatasetFieldSchema>;
export type DatasetQueryResult = z.infer<typeof DatasetQueryResultSchema>;

// packages/contracts/src/index.ts
export * from "./dashboard";
export * from "./dataset";
```

- [ ] **Step 7: Run contract tests and typecheck**

Run: `pnpm --filter @drag-visual/contracts test && pnpm --filter @drag-visual/contracts typecheck`

Expected: both commands PASS.

- [ ] **Step 8: Commit shared contracts**

```bash
git add packages/contracts
git commit -m "feat: define dashboard and dataset contracts"
```

## Task 3: Create the NestJS/Fastify API shell

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health.controller.ts`
- Test: `apps/api/src/health.controller.test.ts`

- [ ] **Step 1: Create the API package and install dependencies**

```json
{
  "name": "@drag-visual/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  }
}
```

Run:

```bash
pnpm --filter @drag-visual/api add @drag-visual/contracts@workspace:* @nestjs/common @nestjs/core @nestjs/platform-fastify @nestjs/swagger fastify reflect-metadata rxjs zod
pnpm --filter @drag-visual/api add -D @nestjs/testing supertest @types/supertest tsx typescript vitest
```

- [ ] **Step 2: Write a failing health controller test**

```ts
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { describe, expect, it } from "vitest";
import { AppModule } from "./app.module";

describe("health", () => {
  it("returns ok", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
```

- [ ] **Step 3: Run the health test and verify failure**

Run: `pnpm --filter @drag-visual/api test -- health.controller.test.ts`

Expected: FAIL because `AppModule` does not exist.

- [ ] **Step 4: Implement the minimal API application**

```ts
// apps/api/src/health.controller.ts
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return { status: "ok" as const };
  }
}

// apps/api/src/app.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

@Module({ controllers: [HealthController] })
export class AppModule {}

// apps/api/src/main.ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: true }));
const openApiConfig = new DocumentBuilder().setTitle("Drag Visual API").setVersion("1.0").build();
SwaggerModule.setup("openapi", app, SwaggerModule.createDocument(app, openApiConfig));
await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
```

- [ ] **Step 5: Run the API test and typecheck**

Run: `pnpm --filter @drag-visual/api test && pnpm --filter @drag-visual/api typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the API shell**

```bash
git add apps/api
git commit -m "feat: add NestJS Fastify API shell"
```

## Task 4: Persist dashboards with Prisma and optimistic revisions

**Files:**
- Create: `prisma/schema.prisma`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/dashboards/dashboard.repository.ts`
- Create: `apps/api/src/dashboards/dashboard.service.ts`
- Create: `apps/api/src/dashboards/dashboard.controller.ts`
- Create: `apps/api/src/dashboards/dashboard.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/dashboards/dashboard.service.test.ts`

- [ ] **Step 1: Add Prisma and define the dashboard table**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model DashboardRecord {
  id              String   @id @default(cuid())
  name            String
  revision        Int      @default(1)
  draftSchema     Json
  publishedSchema Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

Run: `pnpm --filter @drag-visual/api add @prisma/client && pnpm --filter @drag-visual/api add -D prisma`

- [ ] **Step 2: Write failing service tests against an in-memory repository**

```ts
import { describe, expect, it } from "vitest";
import { DashboardService, RevisionConflictError } from "./dashboard.service";
import { InMemoryDashboardRepository } from "./dashboard.repository";

describe("DashboardService", () => {
  it("creates and reads an empty dashboard", async () => {
    const service = new DashboardService(new InMemoryDashboardRepository());
    const created = await service.create("销售看板");
    expect((await service.get(created.id)).name).toBe("销售看板");
    expect(created.components).toEqual([]);
  });

  it("rejects a stale revision", async () => {
    const service = new DashboardService(new InMemoryDashboardRepository());
    const created = await service.create("销售看板");
    await service.save({ ...created, name: "新版" });
    await expect(service.save({ ...created, name: "旧版" })).rejects.toBeInstanceOf(RevisionConflictError);
  });
});
```

- [ ] **Step 3: Run the service tests and verify failure**

Run: `pnpm --filter @drag-visual/api test -- dashboard.service.test.ts`

Expected: FAIL because the dashboard service and repository do not exist.

- [ ] **Step 4: Implement repository and service boundaries**

```ts
// apps/api/src/dashboards/dashboard.repository.ts
import type { Dashboard } from "@drag-visual/contracts";

export interface DashboardRepository {
  create(dashboard: Dashboard): Promise<Dashboard>;
  find(id: string): Promise<Dashboard | null>;
  updateIfRevision(dashboard: Dashboard, expectedRevision: number): Promise<Dashboard | null>;
}

export const DASHBOARD_REPOSITORY = Symbol("DASHBOARD_REPOSITORY");

export class InMemoryDashboardRepository implements DashboardRepository {
  private readonly records = new Map<string, Dashboard>();
  async create(dashboard: Dashboard) { this.records.set(dashboard.id, dashboard); return structuredClone(dashboard); }
  async find(id: string) { const value = this.records.get(id); return value ? structuredClone(value) : null; }
  async updateIfRevision(dashboard: Dashboard, expectedRevision: number) {
    const current = this.records.get(dashboard.id);
    if (!current || current.revision !== expectedRevision) return null;
    const next = { ...dashboard, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    this.records.set(next.id, next);
    return structuredClone(next);
  }
}
```

```ts
// apps/api/src/dashboards/dashboard.service.ts
import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { DASHBOARD_REPOSITORY, type DashboardRepository } from "./dashboard.repository";

export class DashboardNotFoundError extends Error {}
export class RevisionConflictError extends Error {}

@Injectable()
export class DashboardService {
  constructor(@Inject(DASHBOARD_REPOSITORY) private readonly repository: DashboardRepository) {}

  async create(name: string): Promise<Dashboard> {
    const now = new Date().toISOString();
    return this.repository.create(DashboardSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      name,
      theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
      layout: [],
      components: [],
      datasets: [],
      revision: 1,
      updatedAt: now,
    }));
  }

  async get(id: string): Promise<Dashboard> {
    const dashboard = await this.repository.find(id);
    if (!dashboard) throw new DashboardNotFoundError(id);
    return dashboard;
  }

  async save(input: Dashboard): Promise<Dashboard> {
    const dashboard = DashboardSchema.parse(input);
    const updated = await this.repository.updateIfRevision(dashboard, dashboard.revision);
    if (!updated) throw new RevisionConflictError(dashboard.id);
    return updated;
  }
}
```

- [ ] **Step 5: Run service tests and verify pass**

Run: `pnpm --filter @drag-visual/api test -- dashboard.service.test.ts`

Expected: PASS.

- [ ] **Step 6: Add Prisma repository, HTTP controller, and exception mapping**

```ts
// apps/api/src/dashboards/prisma-dashboard.repository.ts
import { Injectable } from "@nestjs/common";
import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { PrismaService } from "../prisma/prisma.service";
import type { DashboardRepository } from "./dashboard.repository";

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(dashboard: Dashboard) {
    const row = await this.prisma.dashboardRecord.create({ data: {
      id: dashboard.id, name: dashboard.name, revision: dashboard.revision, draftSchema: dashboard,
    } });
    return DashboardSchema.parse(row.draftSchema);
  }
  async find(id: string) {
    const row = await this.prisma.dashboardRecord.findUnique({ where: { id } });
    return row ? DashboardSchema.parse(row.draftSchema) : null;
  }
  async updateIfRevision(dashboard: Dashboard, expectedRevision: number) {
    const next = DashboardSchema.parse({
      ...dashboard,
      revision: expectedRevision + 1,
      updatedAt: new Date().toISOString(),
    });
    const result = await this.prisma.dashboardRecord.updateMany({
      where: { id: dashboard.id, revision: expectedRevision },
      data: { name: next.name, revision: next.revision, draftSchema: next },
    });
    return result.count === 1 ? next : null;
  }
}
```

```ts
// apps/api/src/dashboards/dashboard.controller.ts
import { Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { DashboardSchema } from "@drag-visual/contracts";
import { DashboardNotFoundError, DashboardService, RevisionConflictError } from "./dashboard.service";

@Controller("dashboards")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Post()
  create(@Body() body: { name?: string }) { return this.service.create(body.name?.trim() || "未命名看板"); }
  @Get(":id")
  async get(@Param("id") id: string) {
    try { return await this.service.get(id); }
    catch (error) { if (error instanceof DashboardNotFoundError) throw new NotFoundException({ code: "DASHBOARD_NOT_FOUND" }); throw error; }
  }
  @Put(":id")
  async save(@Param("id") id: string, @Body() body: unknown) {
    const dashboard = DashboardSchema.parse(body);
    if (dashboard.id !== id) throw new ConflictException({ code: "DASHBOARD_ID_MISMATCH" });
    try { return await this.service.save(dashboard); }
    catch (error) { if (error instanceof RevisionConflictError) throw new ConflictException({ code: "DASHBOARD_VERSION_CONFLICT" }); throw error; }
  }
}
```

```ts
// apps/api/src/dashboards/dashboard.module.ts
import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DASHBOARD_REPOSITORY } from "./dashboard.repository";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { PrismaDashboardRepository } from "./prisma-dashboard.repository";

@Module({
  controllers: [DashboardController],
  providers: [PrismaService, DashboardService, PrismaDashboardRepository, { provide: DASHBOARD_REPOSITORY, useExisting: PrismaDashboardRepository }],
})
export class DashboardModule {}
```

Import `DashboardModule` in `AppModule`.

- [ ] **Step 7: Generate Prisma client and run the API suite**

Run: `pnpm exec prisma generate && pnpm --filter @drag-visual/api test && pnpm --filter @drag-visual/api typecheck`

Expected: PASS.

- [ ] **Step 8: Commit dashboard persistence**

```bash
git add prisma apps/api/src
git commit -m "feat: persist dashboard drafts with revisions"
```

## Task 5: Create the React route shell and dashboard vertical slice

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/features/dashboards/api.ts`
- Create: `apps/web/src/features/dashboards/DashboardHome.tsx`
- Test: `apps/web/src/features/dashboards/DashboardHome.test.tsx`

- [ ] **Step 1: Create the Vite React application package**

```json
{
  "name": "@drag-visual/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  }
}
```

Run:

```bash
pnpm --filter @drag-visual/web add @drag-visual/contracts@workspace:* @tanstack/react-query antd react react-dom react-router-dom
pnpm --filter @drag-visual/web add -D @testing-library/jest-dom @testing-library/react @types/react @types/react-dom @vitejs/plugin-react jsdom typescript vite vitest
```

- [ ] **Step 2: Write a failing dashboard home test**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardHome } from "./DashboardHome";

describe("DashboardHome", () => {
  it("creates an empty dashboard", async () => {
    const createDashboard = vi.fn().mockResolvedValue({ id: "dash-1" });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DashboardHome createDashboard={createDashboard} onCreated={() => undefined} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "新建看板" }));
    expect(await screen.findByText("正在创建…")).toBeInTheDocument();
    expect(createDashboard).toHaveBeenCalledWith("未命名看板");
  });
});
```

- [ ] **Step 3: Run the Web test and verify failure**

Run: `pnpm --filter @drag-visual/web test -- DashboardHome.test.tsx`

Expected: FAIL because `DashboardHome` does not exist.

- [ ] **Step 4: Implement the typed API client and home screen**

```ts
// apps/web/src/api/client.ts
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json() as Promise<T>;
}
```

```tsx
// apps/web/src/features/dashboards/DashboardHome.tsx
import { useMutation } from "@tanstack/react-query";
import { Button, Result, Spin } from "antd";

type Props = {
  createDashboard(name: string): Promise<{ id: string }>;
  onCreated(id: string): void;
};

export function DashboardHome({ createDashboard, onCreated }: Props) {
  const mutation = useMutation({ mutationFn: createDashboard, onSuccess: (value) => onCreated(value.id) });
  if (mutation.isPending) return <Spin tip="正在创建…"><div style={{ minHeight: 160 }} /></Spin>;
  if (mutation.isError) return <Result status="error" title="创建失败" extra={<Button onClick={() => mutation.reset()}>重试</Button>} />;
  return <Button type="primary" onClick={() => mutation.mutate("未命名看板")}>新建看板</Button>;
}
```

- [ ] **Step 5: Add editor, preview, and published route placeholders**

```tsx
import { createBrowserRouter, useNavigate } from "react-router-dom";
import { DashboardHome } from "../features/dashboards/DashboardHome";
import { createDashboard } from "../features/dashboards/api";

const Placeholder = ({ title }: { title: string }) => <main><h1>{title}</h1></main>;
const HomeRoute = () => {
  const navigate = useNavigate();
  return <DashboardHome createDashboard={createDashboard} onCreated={(id) => navigate(`/editor/${id}`)} />;
};

export const router = createBrowserRouter([
  { path: "/", element: <HomeRoute /> },
  { path: "/editor/:dashboardId", element: <Placeholder title="看板编辑器" /> },
  { path: "/preview/:dashboardId", element: <Placeholder title="看板预览" /> },
  { path: "/view/:dashboardId", element: <Placeholder title="已发布看板" /> },
]);
```


- [ ] **Step 6: Run Web tests, typecheck, and production build**

Run: `pnpm --filter @drag-visual/web test && pnpm --filter @drag-visual/web typecheck && pnpm --filter @drag-visual/web build`

Expected: all commands PASS.

- [ ] **Step 7: Commit the Web vertical slice**

```bash
git add apps/web
git commit -m "feat: add dashboard web route shell"
```

## Task 6: Verify the Phase 1 gate

**Files:**
- Create: `docs/runbooks/local-development.md`

- [ ] **Step 1: Document exact local startup commands**

```md
# Local development

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Run `pnpm install`.
3. Run `pnpm exec prisma migrate dev --name init`.
4. Run `pnpm dev`.
5. Open `http://localhost:5173`, create a dashboard, and confirm `/editor/:id` opens.
```

- [ ] **Step 2: Run the full Phase 1 verification**

Run: `pnpm typecheck && pnpm test && pnpm build`

Expected: all packages typecheck, all tests pass, and Web/API build successfully.

- [ ] **Step 3: Perform the create/read smoke test**

Run API and Web, click “新建看板”, then request `GET /dashboards/:id`.

Expected: Web navigates to `/editor/:id`; API returns a validated empty schema with revision `1`.

- [ ] **Step 4: Commit the runbook**

```bash
git add docs/runbooks/local-development.md
git commit -m "docs: add local development runbook"
```
