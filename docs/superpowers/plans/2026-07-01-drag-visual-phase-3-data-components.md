# Phase 3: Dataset Binding, Charts, and Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the editor to the unified business API, normalize dataset metadata and rows, bind fields through component slots, render six component types, and edit data/style configuration from the inspector.

**Architecture:** The API owns upstream authentication, timeouts, size limits, and response normalization. `data-engine` validates field bindings and applies only sorting/Top-N transforms; component definitions own slot requirements and renderer adapters.

**Tech Stack:** NestJS HTTP client, Zod, TanStack Query, React Hook Form, Ant Design, Apache ECharts, Vitest, Testing Library.

---

## Task 1: Build binding validation and tabular transforms

**Files:**
- Create: `packages/data-engine/package.json`
- Create: `packages/data-engine/src/validateBinding.ts`
- Create: `packages/data-engine/src/applyTransforms.ts`
- Create: `packages/data-engine/src/index.ts`
- Test: `packages/data-engine/src/validateBinding.test.ts`
- Test: `packages/data-engine/src/applyTransforms.test.ts`

- [ ] **Step 1: Write failing binding validation tests**

```ts
import { describe, expect, it } from "vitest";
import { validateBinding } from "./validateBinding";

const dataset = {
  id: "sales", name: "销售", schemaVersion: "v1", parameters: [],
  fields: [
    { key: "month", label: "月份", type: "string" as const, nullable: false },
    { key: "revenue", label: "收入", type: "number" as const, nullable: false },
  ],
};

it("accepts compatible dimension and measure fields", () => {
  expect(validateBinding(
    { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: { fieldKey: "revenue" } } },
    dataset,
    [
      { key: "dimension", label: "维度", accepts: ["string", "date"], required: true, multiple: false },
      { key: "measure", label: "指标", accepts: ["number"], required: true, multiple: false },
    ],
  )).toEqual({ valid: true, messages: [] });
});

it("reports missing and incompatible fields", () => {
  const result = validateBinding(
    { datasetId: "sales", slots: { measure: { fieldKey: "month" } } }, dataset,
    [
      { key: "dimension", label: "维度", accepts: ["string"], required: true, multiple: false },
      { key: "measure", label: "指标", accepts: ["number"], required: true, multiple: false },
    ],
  );
  expect(result.valid).toBe(false);
  expect(result.messages).toEqual(["维度为必填项", "月份不能绑定到指标"]);
});
```

- [ ] **Step 2: Implement binding validation**

```ts
import type { DataBinding, Dataset } from "@drag-visual/contracts";

type Slot = { key: string; label: string; accepts: Dataset["fields"][number]["type"][]; required: boolean; multiple: boolean };

export function validateBinding(binding: DataBinding, dataset: Dataset, slots: Slot[]) {
  const messages: string[] = [];
  const fields = new Map(dataset.fields.map((field) => [field.key, field]));
  for (const slot of slots) {
    const raw = binding.slots[slot.key];
    const values = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
    if (slot.required && values.length === 0) messages.push(`${slot.label}为必填项`);
    if (!slot.multiple && values.length > 1) messages.push(`${slot.label}只能绑定一个字段`);
    for (const value of values) {
      const field = fields.get(value.fieldKey);
      if (!field) messages.push(`字段 ${value.fieldKey} 已不存在`);
      else if (!slot.accepts.includes(field.type)) messages.push(`${field.label}不能绑定到${slot.label}`);
    }
  }
  return { valid: messages.length === 0, messages };
}
```

- [ ] **Step 3: Write failing sorting and Top-N tests**

```ts
import { expect, it } from "vitest";
import { applyTransforms } from "./applyTransforms";

it("sorts numeric values and limits rows", () => {
  const rows = [{ name: "A", value: 2 }, { name: "B", value: 9 }, { name: "C", value: 4 }];
  expect(applyTransforms(rows, { fieldKey: "value", direction: "desc" }, 2)).toEqual([
    { name: "B", value: 9 }, { name: "C", value: 4 },
  ]);
});
```

- [ ] **Step 4: Implement non-mutating transforms**

```ts
export function applyTransforms(
  rows: Record<string, unknown>[],
  sort?: { fieldKey: string; direction: "asc" | "desc" },
  limit?: number,
) {
  const next = [...rows];
  if (sort) next.sort((a, b) => {
    const left = a[sort.fieldKey];
    const right = b[sort.fieldKey];
    const order = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left ?? "").localeCompare(String(right ?? ""), "zh-CN");
    return sort.direction === "asc" ? order : -order;
  });
  return typeof limit === "number" ? next.slice(0, limit) : next;
}
```

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter @drag-visual/data-engine test && pnpm --filter @drag-visual/data-engine typecheck`

Expected: PASS.

```bash
git add packages/data-engine
git commit -m "feat: validate bindings and apply tabular transforms"
```

## Task 2: Implement the server-side Dataset Gateway

**Files:**
- Create: `apps/api/src/datasets/business-api.client.ts`
- Create: `apps/api/src/datasets/dataset.service.ts`
- Create: `apps/api/src/datasets/dataset.controller.ts`
- Create: `apps/api/src/datasets/dataset.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/datasets/dataset.service.test.ts`

- [ ] **Step 1: Write failing normalization and limit tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { DatasetService, DatasetUpstreamError } from "./dataset.service";

describe("DatasetService", () => {
  it("validates normalized upstream rows", async () => {
    const client = { query: vi.fn().mockResolvedValue({
      columns: [{ key: "value", label: "值", type: "number", nullable: false }],
      rows: [{ value: 10 }], sampledAt: "2026-07-01T00:00:00.000Z",
    }) };
    expect((await new DatasetService(client).query("sales", {})).rows).toEqual([{ value: 10 }]);
  });

  it("maps malformed upstream responses to a stable error", async () => {
    const client = { query: vi.fn().mockResolvedValue({ columns: [], rows: "bad" }) };
    await expect(new DatasetService(client).query("sales", {})).rejects.toBeInstanceOf(DatasetUpstreamError);
  });
});
```

- [ ] **Step 2: Implement a timeout-aware upstream client**

```ts
export class BusinessApiClient {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 10_000) {}

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { "content-type": "application/json", ...init?.headers },
    });
    if (!response.ok) throw new Error(`UPSTREAM_HTTP_${response.status}`);
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error("UPSTREAM_RESPONSE_TOO_LARGE");
    return JSON.parse(text) as unknown;
  }

  list() { return this.request("/datasets"); }
  schema(id: string) { return this.request(`/datasets/${encodeURIComponent(id)}/schema`); }
  query(id: string, parameters: Record<string, unknown>) {
    return this.request(`/datasets/${encodeURIComponent(id)}/query`, { method: "POST", body: JSON.stringify({ parameters, limit: 10_000 }) });
  }
}
```

- [ ] **Step 3: Implement service validation and stable errors**

```ts
import { DatasetQueryResultSchema, DatasetSchema } from "@drag-visual/contracts";

export class DatasetUpstreamError extends Error {
  constructor(readonly code: "DATASET_TIMEOUT" | "DATASET_INVALID_RESPONSE" | "DATASET_UPSTREAM_ERROR") { super(code); }
}

export class DatasetService {
  constructor(private readonly client: Pick<BusinessApiClient, "list" | "schema" | "query">) {}
  async list() { return (await Promise.all((await this.client.list() as Array<{ id: string }>).map((item) => this.schema(item.id)))); }
  async schema(id: string) { return DatasetSchema.parse(await this.client.schema(id)); }
  async query(id: string, parameters: Record<string, unknown>) {
    try { return DatasetQueryResultSchema.parse(await this.client.query(id, parameters)); }
    catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") throw new DatasetUpstreamError("DATASET_TIMEOUT");
      if (error instanceof Error && error.name === "ZodError") throw new DatasetUpstreamError("DATASET_INVALID_RESPONSE");
      throw new DatasetUpstreamError("DATASET_UPSTREAM_ERROR");
    }
  }
}
```

- [ ] **Step 4: Add controllers and HTTP error mapping**

Expose `GET /datasets`, `GET /datasets/:id/schema`, and `POST /datasets/:id/query`. Return 504 for `DATASET_TIMEOUT`, 502 for invalid/upstream responses, and bodies shaped as `{ code, message }`. Reject query bodies over the Fastify body limit and pass only the `parameters` object upstream.

- [ ] **Step 5: Run API tests and commit**

Run: `pnpm --filter @drag-visual/api test -- dataset.service.test.ts && pnpm --filter @drag-visual/api typecheck`

Expected: PASS.

```bash
git add apps/api/src/datasets apps/api/src/app.module.ts
git commit -m "feat: add unified dataset gateway"
```

## Task 3: Add dataset selection, parameters, fields, and preview

**Files:**
- Create: `apps/web/src/features/datasets/datasetQueries.ts`
- Create: `apps/web/src/features/datasets/DatasetWorkspace.tsx`
- Create: `apps/web/src/features/datasets/ParameterForm.tsx`
- Create: `apps/web/src/features/datasets/DataPreview.tsx`
- Modify: `apps/web/src/features/editor/EditorPage.tsx`
- Test: `apps/web/src/features/datasets/DatasetWorkspace.test.tsx`

- [ ] **Step 1: Write a failing dataset workspace test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DatasetWorkspace } from "./DatasetWorkspace";

it("selects a dataset and queries preview rows", async () => {
  const onQuery = vi.fn().mockResolvedValue({ rows: [{ month: "1月", revenue: 10 }] });
  render(<DatasetWorkspace datasets={[{ id: "sales", name: "销售", schemaVersion: "v1", fields: [], parameters: [] }]} onQuery={onQuery} />);
  fireEvent.mouseDown(screen.getByLabelText("数据集"));
  fireEvent.click(await screen.findByText("销售"));
  fireEvent.click(screen.getByRole("button", { name: "查询数据" }));
  expect(onQuery).toHaveBeenCalledWith("sales", {});
  expect(await screen.findByText("1月")).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement validated query hooks**

Use `DatasetSchema.array().parse` for the list, `DatasetSchema.parse` for metadata, and `DatasetQueryResultSchema.parse` for query results. Set query retries to `0` for 4xx responses and `1` for timeout/5xx responses.

- [ ] **Step 3: Implement parameter form generation**

Map `string` to `Input`, `number` to `InputNumber`, `date` to `DatePicker`, and `boolean` to `Switch`. Apply `required` validation from `QueryParameter`; submit ISO date strings. Do not allow arbitrary parameter keys.

- [ ] **Step 4: Implement a 100-row preview table**

Build Ant Design columns from `result.columns`; render `result.rows.slice(0, 100)`. Show total/sample time and an explicit “仅展示前 100 行” label when more rows exist.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter @drag-visual/web test -- DatasetWorkspace.test.tsx && pnpm --filter @drag-visual/web typecheck`

Expected: PASS.

```bash
git add apps/web/src/features/datasets apps/web/src/features/editor/EditorPage.tsx
git commit -m "feat: add dataset workspace and preview"
```

## Task 4: Implement the chart renderer and bar-chart vertical slice

**Files:**
- Create: `packages/chart-renderer/package.json`
- Create: `packages/chart-renderer/src/options/bar.ts`
- Create: `packages/chart-renderer/src/EChart.tsx`
- Create: `packages/chart-renderer/src/DashboardComponentRenderer.tsx`
- Create: `packages/chart-renderer/src/index.ts`
- Modify: `packages/component-registry/src/definitions/bar.ts`
- Test: `packages/chart-renderer/src/options/bar.test.ts`

- [ ] **Step 1: Write a failing bar option test**

```ts
import { expect, it } from "vitest";
import { buildBarOption } from "./bar";

it("maps dimension and measure with ECharts dataset encode", () => {
  const option = buildBarOption({
    rows: [{ month: "1月", revenue: 10 }],
    dimension: "month", measure: "revenue",
    props: { title: "月收入", color: "#1677ff", showLegend: false },
  });
  expect(option.dataset).toEqual({ source: [{ month: "1月", revenue: 10 }] });
  expect(option.series).toEqual([{ type: "bar", encode: { x: "month", y: "revenue" }, itemStyle: { color: "#1677ff" } }]);
});
```

- [ ] **Step 2: Implement the pure option builder**

```ts
import type { EChartsOption } from "echarts";

export function buildBarOption(input: {
  rows: Record<string, unknown>[];
  dimension: string;
  measure: string;
  props: { title: string; color: string; showLegend: boolean };
}): EChartsOption {
  return {
    title: { text: input.props.title },
    tooltip: { trigger: "axis" },
    legend: { show: input.props.showLegend },
    dataset: { source: input.rows },
    xAxis: { type: "category" },
    yAxis: { type: "value" },
    series: [{ type: "bar", encode: { x: input.dimension, y: input.measure }, itemStyle: { color: input.props.color } }],
  };
}
```

- [ ] **Step 3: Implement lifecycle-safe ECharts rendering**

Create one instance in `useEffect`, update with `setOption(option, { notMerge: true })`, observe container size with `ResizeObserver`, call `resize`, and call `dispose` on unmount. Lazy-import ECharts chart modules so the published route does not bundle unused chart types.

- [ ] **Step 4: Upgrade the bar definition slots and props**

Define required `dimension` accepting string/date, required `measure` accepting number, and optional multiple `series` accepting string. Validate with `data-engine`. Add `title`, `color`, `showLegend`, and `numberFormat` to the Zod props schema.

- [ ] **Step 5: Run renderer tests and commit**

Run: `pnpm --filter @drag-visual/chart-renderer test && pnpm --filter @drag-visual/chart-renderer typecheck`

Expected: PASS.

```bash
git add packages/chart-renderer packages/component-registry
git commit -m "feat: render bound bar charts"
```

## Task 5: Add line, pie, KPI, table, and text components

**Files:**
- Create: `packages/component-registry/src/definitions/line.ts`
- Create: `packages/component-registry/src/definitions/pie.ts`
- Create: `packages/component-registry/src/definitions/kpi.ts`
- Create: `packages/component-registry/src/definitions/table.ts`
- Create: `packages/component-registry/src/definitions/text.ts`
- Modify: `packages/component-registry/src/registry.ts`
- Create: `packages/chart-renderer/src/options/line.ts`
- Create: `packages/chart-renderer/src/options/pie.ts`
- Create: `packages/chart-renderer/src/renderers/KpiRenderer.tsx`
- Create: `packages/chart-renderer/src/renderers/TableRenderer.tsx`
- Create: `packages/chart-renderer/src/renderers/TextRenderer.tsx`
- Test: `packages/chart-renderer/src/componentOptions.test.ts`

- [ ] **Step 1: Write a registry coverage test**

```ts
import { expect, it } from "vitest";
import { componentRegistry } from "./registry";

it("registers exactly the six MVP components", () => {
  expect(componentRegistry.list().map((item) => item.type).sort()).toEqual(["bar", "kpi", "line", "pie", "table", "text"]);
});
```

- [ ] **Step 2: Define slot contracts**

- Line: required string/date `dimension`, required one-or-more number `measures`; `area` is a boolean style prop.
- Pie: required string/date `dimension`, required number `measure`.
- KPI: required number `measure`; optional aggregation enum `first|sum|avg|max|min`, default `first`.
- Table: required one-or-more fields of any type.
- Text: no data binding; props are `content`, `fontSize`, `fontWeight`, `textAlign`, and `color`.

- [ ] **Step 3: Implement pure option/view-model builders**

Line uses ECharts `dataset` and one series per measure. Pie maps `{ name: dimension, value: measure }`. KPI calculates the configured aggregation over numeric values. Table builds columns from selected field keys and preserves row order. Text renders sanitized plain text only; HTML is not accepted.

- [ ] **Step 4: Add renderer dispatch inside the renderer package**

`DashboardComponentRenderer` switches on the discriminated `component.type` inside `chart-renderer`, not in the editor. It renders actionable empty states for missing bindings and returns the appropriate renderer after binding validation.

- [ ] **Step 5: Run component tests and commit**

Run: `pnpm --filter @drag-visual/component-registry test && pnpm --filter @drag-visual/chart-renderer test && pnpm typecheck`

Expected: PASS.

```bash
git add packages/component-registry packages/chart-renderer
git commit -m "feat: add six MVP dashboard components"
```

## Task 6: Build the schema-driven data and style inspector

**Files:**
- Create: `apps/web/src/features/inspector/Inspector.tsx`
- Create: `apps/web/src/features/inspector/DataBindingPanel.tsx`
- Create: `apps/web/src/features/inspector/StylePanel.tsx`
- Create: `apps/web/src/features/inspector/DashboardStylePanel.tsx`
- Create: `apps/web/src/features/inspector/FieldPicker.tsx`
- Modify: `apps/web/src/features/editor/EditorPage.tsx`
- Test: `apps/web/src/features/inspector/Inspector.test.tsx`

- [ ] **Step 1: Write a failing inspector test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Inspector } from "./Inspector";

it("binds a compatible field and updates style props", () => {
  const onBindingChange = vi.fn();
  const onPropsChange = vi.fn();
  render(<Inspector component={{ id: "c1", type: "bar", props: { title: "柱状图", color: "#1677ff", showLegend: false } }} dataset={{ id: "sales", name: "销售", schemaVersion: "v1", parameters: [], fields: [{ key: "revenue", label: "收入", type: "number", nullable: false }] }} onBindingChange={onBindingChange} onPropsChange={onPropsChange} />);
  fireEvent.mouseDown(screen.getByLabelText("指标"));
  fireEvent.click(screen.getByText("收入"));
  expect(onBindingChange).toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "收入趋势" } });
  expect(onPropsChange).toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement field pickers from `dataSlots`**

For each slot, filter dataset fields by `accepts`, use single/multiple Ant Design `Select`, show required state, and preserve stable field keys. When the dataset changes, retain compatible bindings and mark incompatible ones; never silently choose replacements.

- [ ] **Step 3: Implement controlled style forms**

Use React Hook Form with Zod validation. Render common controls for string, boolean, color, enum, and number metadata attached to component definitions. Dispatch one `component.props.update` command on blur/change completion, not on every color-picker movement.

- [ ] **Step 4: Connect validation messages to component frames**

Show the first binding error in the component empty state and all errors in the inspector. Clicking “去配置” selects the component and opens the data tab.

- [ ] **Step 5: Add dashboard-level theme controls**

```tsx
import { ColorPicker, Form } from "antd";

export function DashboardStylePanel({ theme, onChange }: {
  theme: { primaryColor: string; backgroundColor: string };
  onChange(theme: { primaryColor: string; backgroundColor: string }): void;
}) {
  return (
    <Form layout="vertical">
      <Form.Item label="主题色"><ColorPicker value={theme.primaryColor} onChangeComplete={(_, hex) => onChange({ ...theme, primaryColor: hex })} /></Form.Item>
      <Form.Item label="画布背景"><ColorPicker value={theme.backgroundColor} onChangeComplete={(_, hex) => onChange({ ...theme, backgroundColor: hex })} /></Form.Item>
    </Form>
  );
}
```

Show this panel when no component is selected. Dispatch `dashboard.theme.update`; apply the background immediately to the canvas and shared viewer.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter @drag-visual/web test -- Inspector.test.tsx && pnpm typecheck`

Expected: PASS.

```bash
git add apps/web/src/features/inspector apps/web/src/features/editor
git commit -m "feat: add schema-driven component inspector"
```

## Task 7: Verify the Phase 3 gate

**Files:**
- Modify: `docs/runbooks/local-development.md`

- [ ] **Step 1: Add a deterministic business API fixture**

Document or run the data colleague's contract mock with one `sales` dataset containing `month`, `region`, `revenue`, and `orders`, plus date parameters and 1,000 deterministic rows.

- [ ] **Step 2: Execute the six-component smoke scenario**

Select `sales`; query preview; add all six components; bind compatible fields; set line to area mode; change colors/titles; save; reload.

Expected: every component renders; invalid fields are rejected; configuration survives reload.

- [ ] **Step 3: Run all quality gates**

Run: `pnpm typecheck && pnpm test && pnpm build`

Expected: PASS.

- [ ] **Step 4: Commit the Phase 3 runbook**

```bash
git add docs/runbooks/local-development.md
git commit -m "docs: add dataset and component smoke test"
```
