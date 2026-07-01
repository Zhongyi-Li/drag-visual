# Drag Visual Phase 2: Data Sources and Field Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import CSV/XLSX files, query the approved business API, normalize both into one dataset contract, and bind fields to a bar chart.

**Architecture:** The API server owns file parsing and business-query access. The browser consumes `DatasetSchema`, previews rows, and stores only data-source references and field bindings in the project.

**Tech Stack:** NestJS, Fastify, Zod, SheetJS, Papa Parse, TanStack Query, dnd-kit, Vitest, Supertest.

---

### Task 0: Scaffold the API server and data-engine package

**Files:**
- Create: `apps/api-server/package.json`
- Create: `apps/api-server/src/main.ts`
- Create: `apps/api-server/src/app.module.ts`
- Create: `packages/data-engine/package.json`
- Create: `packages/data-engine/src/index.ts`

- [ ] **Step 1: Create the API server manifest**

```json
{
  "name": "@drag-visual/api-server",
  "private": true,
  "scripts": { "dev": "nest start --watch", "build": "nest build", "test": "jest", "typecheck": "tsc --noEmit" },
  "dependencies": { "@drag-visual/project-schema": "workspace:*", "@nestjs/common": "latest", "@nestjs/core": "latest", "@nestjs/platform-fastify": "latest", "axios": "latest", "papaparse": "latest", "reflect-metadata": "latest", "rxjs": "latest", "xlsx": "latest", "zod": "latest" },
  "devDependencies": { "@nestjs/cli": "latest", "@nestjs/testing": "latest", "@types/jest": "latest", "jest": "latest", "ts-jest": "latest", "typescript": "latest" }
}
```

- [ ] **Step 2: Bootstrap NestJS with Fastify**

```ts
// apps/api-server/src/main.ts
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
}
void bootstrap();
```

```ts
// apps/api-server/src/app.module.ts
import { Module } from "@nestjs/common";
@Module({ imports: [] })
export class AppModule {}
```

- [ ] **Step 3: Create the pure data-engine package**

```json
{
  "name": "@drag-visual/data-engine",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@drag-visual/project-schema": "workspace:*" },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

Create `packages/data-engine/src/index.ts` initially:

```ts
export {};
```

After Task 4 creates binding validation, replace it with:

```ts
export * from "./validate-binding";
```

- [ ] **Step 4: Verify and commit**

Run `pnpm install && pnpm --filter @drag-visual/api-server build`.

Expected: API server compiles successfully.

```bash
git add apps/api-server packages/data-engine pnpm-lock.yaml
git commit -m "chore: scaffold API and data engine"
```

### Task 1: Define dataset and binding contracts

**Files:**
- Create: `packages/project-schema/src/dataset.ts`
- Create: `packages/project-schema/src/dataset.test.ts`
- Modify: `packages/project-schema/src/index.ts`
- Modify: `packages/project-schema/src/project.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import { DatasetSchema, FieldBindingSchema } from "./dataset";

describe("dataset contracts", () => {
  it("accepts normalized fields and preview rows", () => {
    expect(DatasetSchema.parse({
      id: "d1",
      name: "Sales",
      sourceType: "file",
      fields: [{ key: "amount", label: "Amount", type: "number", nullable: false }],
      previewRows: [{ amount: 42 }],
      rowCount: 1,
      refreshedAt: "2026-07-01T00:00:00.000Z",
    }).fields[0]?.type).toBe("number");
  });

  it("rejects an empty field key", () => {
    expect(() => FieldBindingSchema.parse({ fieldKey: "", aggregate: "sum" })).toThrow();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run `pnpm --filter @drag-visual/project-schema test`.

Expected: FAIL because `dataset.ts` does not exist.

- [ ] **Step 3: Implement the contracts**

```ts
import { z } from "zod";

export const DatasetFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["string", "number", "date", "boolean"]),
  nullable: z.boolean(),
});

export const DatasetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceType: z.enum(["file", "api"]),
  fields: z.array(DatasetFieldSchema).min(1),
  previewRows: z.array(z.record(z.string(), z.unknown())).max(100),
  rowCount: z.number().int().nonnegative().optional(),
  refreshedAt: z.string().datetime(),
});

export const FieldBindingSchema = z.object({
  fieldKey: z.string().min(1),
  aggregate: z.enum(["none", "sum", "avg", "min", "max", "count"]).default("none"),
});

export type Dataset = z.infer<typeof DatasetSchema>;
export type DatasetField = z.infer<typeof DatasetFieldSchema>;
export type FieldBinding = z.infer<typeof FieldBindingSchema>;
```

Export the module from `index.ts`. Replace the untyped slot record in `project.ts` with `z.record(z.string(), z.union([FieldBindingSchema, z.array(FieldBindingSchema)]))`.

- [ ] **Step 4: Run tests and commit**

Run `pnpm --filter @drag-visual/project-schema test`.

Expected: all schema tests PASS.

```bash
git add packages/project-schema
git commit -m "feat: define dataset and field binding contracts"
```

### Task 2: Normalize CSV and XLSX uploads

**Files:**
- Create: `apps/api-server/src/data-source/infer-fields.ts`
- Create: `apps/api-server/src/data-source/infer-fields.spec.ts`
- Create: `apps/api-server/src/data-source/file-parser.service.ts`
- Create: `apps/api-server/src/data-source/file-parser.service.spec.ts`
- Create: `apps/api-server/src/data-source/data-source.controller.ts`

- [ ] **Step 1: Write the failing field inference test**

```ts
import { inferFields } from "./infer-fields";

describe("inferFields", () => {
  it("infers number, date, boolean, string and nullability", () => {
    const fields = inferFields([
      { amount: "10.5", day: "2026-06-01", active: "true", region: "East" },
      { amount: "20", day: "2026-06-02", active: "false", region: null },
    ]);
    expect(fields).toEqual([
      { key: "amount", label: "amount", type: "number", nullable: false },
      { key: "day", label: "day", type: "date", nullable: false },
      { key: "active", label: "active", type: "boolean", nullable: false },
      { key: "region", label: "region", type: "string", nullable: true },
    ]);
  });
});
```

- [ ] **Step 2: Verify failure**

Run `pnpm --filter @drag-visual/api-server test -- infer-fields`.

Expected: FAIL because `inferFields` is missing.

- [ ] **Step 3: Implement deterministic inference**

```ts
import type { DatasetField } from "@drag-visual/project-schema";

const isBlank = (value: unknown) => value === null || value === undefined || value === "";
const isNumber = (value: unknown) => !isBlank(value) && Number.isFinite(Number(value));
const isBoolean = (value: unknown) => value === true || value === false || value === "true" || value === "false";
const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));

export function inferFields(rows: Record<string, unknown>[]): DatasetField[] {
  const keys = Object.keys(rows[0] ?? {});
  return keys.map((key) => {
    const values = rows.map((row) => row[key]);
    const present = values.filter((value) => !isBlank(value));
    const type = present.every(isBoolean) ? "boolean"
      : present.every(isNumber) ? "number"
      : present.every(isDate) ? "date"
      : "string";
    return { key, label: key, type, nullable: present.length !== values.length };
  });
}
```

- [ ] **Step 4: Write the failing file parser tests**

```ts
it("returns at most 100 preview rows for CSV", async () => {
  const csv = Buffer.from("region,amount\nEast,10\nWest,20");
  const dataset = await service.parse({ originalname: "sales.csv", mimetype: "text/csv", buffer: csv, size: csv.length });
  expect(dataset.sourceType).toBe("file");
  expect(dataset.fields.map((field) => field.type)).toEqual(["string", "number"]);
  expect(dataset.previewRows).toHaveLength(2);
});

it("rejects files larger than the configured limit", async () => {
  await expect(service.parse({ originalname: "large.csv", mimetype: "text/csv", buffer: Buffer.alloc(11), size: 11 }, 10))
    .rejects.toThrow("FILE_TOO_LARGE");
});
```

- [ ] **Step 5: Implement parser and endpoint**

Implement `FileParserService.parse(file, maxBytes = 10 * 1024 * 1024)` so it:

```ts
if (file.size > maxBytes) throw new BadRequestException("FILE_TOO_LARGE");
const rows = file.originalname.endsWith(".csv")
  ? Papa.parse<Record<string, unknown>>(file.buffer.toString("utf8"), { header: true, skipEmptyLines: true }).data
  : XLSX.utils.sheet_to_json<Record<string, unknown>>(XLSX.read(file.buffer).Sheets[XLSX.read(file.buffer).SheetNames[0]!]!, { defval: null });
if (rows.length === 0) throw new BadRequestException("EMPTY_DATASET");
return DatasetSchema.parse({
  id: randomUUID(),
  name: file.originalname,
  sourceType: "file",
  fields: inferFields(rows.slice(0, 1000)),
  previewRows: rows.slice(0, 100),
  rowCount: rows.length,
  refreshedAt: new Date().toISOString(),
});
```

Expose it as `POST /data-sources/files` using `FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } })`.

- [ ] **Step 6: Run tests and commit**

Run `pnpm --filter @drag-visual/api-server test -- data-source`.

Expected: inference and parser tests PASS.

```bash
git add apps/api-server/src/data-source
git commit -m "feat: import and normalize tabular files"
```

### Task 3: Add the approved business-query gateway

**Files:**
- Create: `apps/api-server/src/query-gateway/query-catalog.ts`
- Create: `apps/api-server/src/query-gateway/query-gateway.service.ts`
- Create: `apps/api-server/src/query-gateway/query-gateway.service.spec.ts`
- Create: `apps/api-server/src/query-gateway/query-gateway.controller.ts`

- [ ] **Step 1: Write the failing allowlist test**

```ts
it("rejects unknown query identifiers before making an HTTP request", async () => {
  await expect(service.execute({ queryId: "unknown", params: {} }, { authorization: "Bearer user" }))
    .rejects.toThrow("QUERY_NOT_ALLOWED");
  expect(http.post).not.toHaveBeenCalled();
});

it("normalizes an approved sales query", async () => {
  http.post.mockResolvedValue({ data: { rows: [{ region: "East", amount: 10 }] } });
  const result = await service.execute({ queryId: "sales-summary", params: { year: 2026 } }, { authorization: "Bearer user" });
  expect(result.sourceType).toBe("api");
  expect(result.fields.find((field) => field.key === "amount")?.type).toBe("number");
});
```

- [ ] **Step 2: Implement catalog and gateway**

Create a closed catalog:

```ts
export const queryCatalog = {
  "sales-summary": {
    path: "/reports/sales-summary",
    params: z.object({ year: z.number().int().min(2000).max(2100) }),
    rows: (body: unknown) => z.object({ rows: z.array(z.record(z.string(), z.unknown())) }).parse(body).rows,
  },
} as const;
```

Implement `execute` to find `queryId`, parse params, call the configured business API with a 10-second timeout and the incoming authorization header, then return `DatasetSchema.parse(...)` using `inferFields(rows)` and `rows.slice(0, 100)`.

- [ ] **Step 3: Map failures to stable errors**

```ts
catch (error) {
  if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
    throw new GatewayTimeoutException("BUSINESS_QUERY_TIMEOUT");
  }
  if (axios.isAxiosError(error) && error.response?.status === 403) {
    throw new ForbiddenException("BUSINESS_QUERY_FORBIDDEN");
  }
  throw error;
}
```

Expose `POST /data-sources/business-query` with DTO `{ queryId: string; params: Record<string, unknown> }`.

- [ ] **Step 4: Run tests and commit**

Run `pnpm --filter @drag-visual/api-server test -- query-gateway`.

Expected: allowlist, normalization, timeout, and forbidden tests PASS.

```bash
git add apps/api-server/src/query-gateway
git commit -m "feat: add approved business query gateway"
```

### Task 4: Build the data workspace and bar-chart binding

**Files:**
- Create: `packages/data-engine/src/validate-binding.ts`
- Create: `packages/data-engine/src/validate-binding.test.ts`
- Create: `apps/editor-web/src/features/data/DataWorkspace.tsx`
- Create: `apps/editor-web/src/features/data/data-api.ts`
- Create: `apps/editor-web/src/features/data/FieldList.tsx`
- Create: `apps/editor-web/src/features/inspector/FieldDropZone.tsx`
- Create: `apps/editor-web/src/features/inspector/BarFieldEditor.tsx`
- Modify: `apps/editor-web/src/editor-store.ts`

- [ ] **Step 1: Write the failing binding validation test**

```ts
import { expect, it } from "vitest";
import { validateBarBinding } from "./validate-binding";

const fields = [
  { key: "region", label: "Region", type: "string", nullable: false },
  { key: "amount", label: "Amount", type: "number", nullable: false },
] as const;

it("requires a dimension and numeric measure", () => {
  expect(validateBarBinding({ dimension: { fieldKey: "region", aggregate: "none" }, measure: { fieldKey: "amount", aggregate: "sum" } }, fields)).toEqual({ ok: true });
  expect(validateBarBinding({ dimension: { fieldKey: "region", aggregate: "none" }, measure: { fieldKey: "region", aggregate: "sum" } }, fields)).toEqual({ ok: false, message: "指标必须是数值字段" });
});
```

- [ ] **Step 2: Implement binding validation**

```ts
import type { DatasetField, FieldBinding } from "@drag-visual/project-schema";

interface BarBinding { dimension: FieldBinding; measure: FieldBinding }

export function validateBarBinding(binding: BarBinding, fields: readonly DatasetField[]) {
  const dimension = fields.find((field) => field.key === binding.dimension.fieldKey);
  const measure = fields.find((field) => field.key === binding.measure.fieldKey);
  if (!dimension || !measure) return { ok: false as const, message: "字段不存在" };
  if (measure.type !== "number") return { ok: false as const, message: "指标必须是数值字段" };
  return { ok: true as const };
}
```

- [ ] **Step 3: Implement data workspace**

Implement `DataWorkspace` with these mutation boundaries:

Create `data-api.ts`:

```ts
export async function uploadFile(file: File): Promise<Dataset> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/data-sources/files", { method: "POST", body });
  if (!response.ok) throw new Error(`FILE_UPLOAD_FAILED:${response.status}`);
  return DatasetSchema.parse(await response.json());
}

export async function executeBusinessQuery(input: { queryId: string; params: Record<string, unknown> }): Promise<Dataset> {
  const response = await fetch("/api/data-sources/business-query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`BUSINESS_QUERY_FAILED:${response.status}`);
  return DatasetSchema.parse(await response.json());
}
```

```tsx
const queryClient = useQueryClient();
const registerDataSource = useEditorStore((state) => state.registerDataSource);
const upload = useMutation({
  mutationFn: uploadFile,
  onSuccess: (dataset) => {
    queryClient.setQueryData(["dataset", dataset.id], dataset);
    registerDataSource({ id: dataset.id, name: dataset.name, sourceType: dataset.sourceType });
  },
});
const businessQuery = useMutation({
  mutationFn: executeBusinessQuery,
  onSuccess: (dataset) => {
    queryClient.setQueryData(["dataset", dataset.id], dataset);
    registerDataSource({ id: dataset.id, name: dataset.name, sourceType: dataset.sourceType });
  },
});
```

Implement `FieldList` with an explicit dnd-kit payload:

```tsx
function FieldItem({ datasetId, field }: { datasetId: string; field: DatasetField }) {
  const draggable = useDraggable({ id: `${datasetId}:${field.key}`, data: { datasetId, fieldKey: field.key, fieldType: field.type } });
  return <button ref={draggable.setNodeRef} {...draggable.listeners} {...draggable.attributes}>{field.label}</button>;
}
```

Use this drop contract in `BarFieldEditor`:

Create `FieldDropZone.tsx`:

```tsx
export function FieldDropZone({ id, label, accepts, value, onDrop }: Props) {
  const droppable = useDroppable({ id, data: { accepts } });
  return <div ref={droppable.setNodeRef} data-drop-zone={id} aria-label={label} className={droppable.isOver ? "drop-zone active" : "drop-zone"}>
    <span>{label}</span><strong>{value?.fieldKey ?? "拖入字段"}</strong>
  </div>;
}
```

At the shared `DndContext` boundary, call `onDrop(active.data.current)` only when `over.data.current.accepts` includes `active.data.current.fieldType`; otherwise show `该槽位不接受此字段类型`.

```tsx
<FieldDropZone
  id="dimension"
  accepts={["string", "date", "number"]}
  value={binding?.dimension}
  onDrop={(field) => updateBinding("dimension", { fieldKey: field.fieldKey, aggregate: "none" })}
/>
<FieldDropZone
  id="measure"
  accepts={["number"]}
  value={binding?.measure}
  onDrop={(field) => updateBinding("measure", { fieldKey: field.fieldKey, aggregate: "sum" })}
/>
```

- [ ] **Step 4: Add an integration test**

```tsx
it("binds imported fields to a selected bar chart", async () => {
  server.use(http.post("/data-sources/files", () => HttpResponse.json(datasetFixture)));
  render(<App />);
  await userEvent.upload(screen.getByLabelText("导入文件"), new File(["region,amount\nEast,10"], "sales.csv"));
  await userEvent.click(screen.getByRole("button", { name: "添加柱状图" }));
  await dragField("Region", "维度");
  await dragField("Amount", "指标");
  expect(screen.getByTestId("canvas-component-bar")).toHaveAttribute("data-binding-valid", "true");
});
```

- [ ] **Step 5: Run the phase gate and commit**

Run:

```bash
pnpm --filter @drag-visual/data-engine test
pnpm --filter @drag-visual/editor-web test
pnpm --filter @drag-visual/api-server test
```

Expected: all tests PASS; a file dataset and approved API dataset can each bind a bar chart.

```bash
git add packages/data-engine apps/editor-web/src/features/data apps/editor-web/src/features/inspector apps/editor-web/src/editor-store.ts
git commit -m "feat: bind normalized data fields to charts"
```
