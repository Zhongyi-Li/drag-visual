# Drag Visual Phase 3: Component Registry and Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register all eight MVP components and generate field/style controls without adding component-type conditionals to the editor shell.

**Architecture:** Component definitions own defaults, data slots, property schemas, binding validation, and render adapters. The palette, inspector, canvas, and preview resolve definitions through the registry.

**Tech Stack:** React, TypeScript, Zod, ECharts, echarts-for-react, Ant Design, Vitest, Testing Library.

---

### Task 1: Define and enforce the component registry contract

**Files:**
- Create: `packages/component-registry/package.json`
- Create: `packages/component-registry/src/types.ts`
- Create: `packages/component-registry/src/registry.ts`
- Create: `packages/component-registry/src/registry.test.ts`
- Create: `packages/component-registry/src/index.ts`

- [ ] **Step 1: Write the failing registry test**

Create `packages/component-registry/package.json`:

```json
{
  "name": "@drag-visual/component-registry",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@drag-visual/project-schema": "workspace:*", "@drag-visual/chart-renderer": "workspace:*", "react": "latest", "zod": "latest" },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

```ts
import { describe, expect, it } from "vitest";
import { componentRegistry } from "./registry";

describe("component registry", () => {
  it("contains exactly the eight MVP component types", () => {
    expect([...componentRegistry.keys()]).toEqual([
      "bar", "line", "pie", "area", "progress", "metric", "table", "text",
    ]);
  });

  it("provides unique defaults and positive layouts", () => {
    for (const [type, definition] of componentRegistry) {
      expect(definition.type).toBe(type);
      expect(definition.defaultLayout.w).toBeGreaterThan(0);
      expect(definition.defaultLayout.h).toBeGreaterThan(0);
      expect(definition.styleSchema.safeParse(definition.defaultProps).success).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Verify failure**

Run `pnpm --filter @drag-visual/component-registry test`.

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement registry types**

```ts
import type { ReactNode } from "react";
import type { ZodType } from "zod";
import type { ComponentType, Dataset, DatasetField, FieldBinding } from "@drag-visual/project-schema";

export interface DataSlotDefinition {
  key: string;
  label: string;
  multiple: boolean;
  accepts: DatasetField["type"][];
  defaultAggregate: FieldBinding["aggregate"];
}

export interface ComponentDefinition<Props extends Record<string, unknown> = Record<string, unknown>> {
  type: ComponentType;
  title: string;
  category: "chart" | "indicator" | "content";
  defaultLayout: { w: number; h: number };
  defaultProps: Props;
  styleSchema: ZodType<Props>;
  dataSlots: DataSlotDefinition[];
  render(input: { props: Props; binding?: Record<string, FieldBinding | FieldBinding[]>; dataset?: Dataset }): ReactNode;
}
```

- [ ] **Step 4: Implement strict registration**

```ts
import type { ComponentDefinition } from "./types";
import type { ComponentType } from "@drag-visual/project-schema";

export function createRegistry(definitions: ComponentDefinition[]) {
  const registry = new Map<ComponentType, ComponentDefinition>();
  for (const definition of definitions) {
    if (registry.has(definition.type)) throw new Error(`Duplicate component type: ${definition.type}`);
    registry.set(definition.type, definition);
  }
  return registry;
}
```

Create `packages/component-registry/src/index.ts`:

```ts
export * from "./types";
export * from "./registry";
```

Do not export `componentRegistry` until Task 3 creates it.

- [ ] **Step 5: Commit the contract with the intentionally failing inventory test disabled only by test filter**

Run `pnpm --filter @drag-visual/component-registry test -- -t "unique defaults"`.

Expected: the helper contract test PASS; the eight-component inventory remains red until Task 3.

```bash
git add packages/component-registry
git commit -m "feat: define component registry contract"
```

### Task 2: Implement shared render primitives

**Files:**
- Create: `packages/chart-renderer/package.json`
- Create: `packages/chart-renderer/src/echarts/Chart.tsx`
- Create: `packages/chart-renderer/src/echarts/to-series.ts`
- Create: `packages/chart-renderer/src/echarts/to-series.test.ts`
- Create: `packages/chart-renderer/src/content/Metric.tsx`
- Create: `packages/chart-renderer/src/content/Progress.tsx`
- Create: `packages/chart-renderer/src/content/Table.tsx`
- Create: `packages/chart-renderer/src/content/Text.tsx`
- Create: `packages/chart-renderer/src/index.ts`

- [ ] **Step 1: Write the failing series conversion test**

Create `packages/chart-renderer/package.json`:

```json
{
  "name": "@drag-visual/chart-renderer",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "echarts": "latest", "echarts-for-react": "latest", "react": "latest" },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

```ts
import { expect, it } from "vitest";
import { toCategorySeries } from "./to-series";

it("converts dimension and measure bindings into ECharts data", () => {
  const rows = [{ region: "East", amount: 10 }, { region: "West", amount: 20 }];
  expect(toCategorySeries(rows, "region", "amount")).toEqual({ categories: ["East", "West"], values: [10, 20] });
});
```

- [ ] **Step 2: Implement conversion and chart wrapper**

```ts
export function toCategorySeries(rows: Record<string, unknown>[], dimension: string, measure: string) {
  return {
    categories: rows.map((row) => String(row[dimension] ?? "")),
    values: rows.map((row) => Number(row[measure] ?? 0)),
  };
}
```

```tsx
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

export function Chart({ option }: { option: EChartsOption }) {
  return <ReactECharts option={option} notMerge lazyUpdate style={{ width: "100%", height: "100%" }} />;
}
```

- [ ] **Step 3: Implement non-chart primitives**

```tsx
export const Metric = ({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) => <div><span>{label}</span><strong>{value}{suffix}</strong></div>;
export const Progress = ({ label, percent, color }: { label: string; percent: number; color: string }) => <div><span>{label}</span><progress max={100} value={percent} style={{ accentColor: color }} /></div>;
export const Table = ({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) => <table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table>;
export const Text = ({ content }: { content: string }) => <p>{content}</p>;
```

- [ ] **Step 4: Run tests and commit**

Run `pnpm --filter @drag-visual/chart-renderer test`.

Expected: conversion test PASS.

```bash
git add packages/chart-renderer
git commit -m "feat: add shared component render primitives"
```

### Task 3: Register all eight components

**Files:**
- Create: `packages/component-registry/src/definitions/chart-definitions.tsx`
- Create: `packages/component-registry/src/definitions/content-definitions.tsx`
- Modify: `packages/component-registry/src/registry.ts`
- Modify: `packages/component-registry/src/registry.test.ts`

- [ ] **Step 1: Implement reusable chart definition factory**

```tsx
const chartStyleSchema = z.object({
  title: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  showLegend: z.boolean(),
});

function categoryChart(type: "bar" | "line" | "area", title: string): ComponentDefinition {
  return {
    type,
    title,
    category: "chart",
    defaultLayout: { w: 6, h: 4 },
    defaultProps: { title, color: "#1677ff", showLegend: true },
    styleSchema: chartStyleSchema,
    dataSlots: [
      { key: "dimension", label: "维度", multiple: false, accepts: ["string", "date", "number"], defaultAggregate: "none" },
      { key: "measure", label: "指标", multiple: false, accepts: ["number"], defaultAggregate: "sum" },
    ],
    render: ({ props, binding, dataset }) => {
      const dimension = binding?.dimension as FieldBinding | undefined;
      const measure = binding?.measure as FieldBinding | undefined;
      if (!dimension || !measure || !dataset) return <EmptyBinding />;
      const data = toCategorySeries(dataset.previewRows, dimension.fieldKey, measure.fieldKey);
      return <Chart option={{ title: { text: String(props.title) }, color: [String(props.color)], xAxis: { type: "category", data: data.categories }, yAxis: { type: "value" }, series: [{ type: type === "area" ? "line" : type, areaStyle: type === "area" ? {} : undefined, data: data.values }] }} />;
    },
  };
}

const EmptyBinding = () => <div role="status">请在右侧绑定数据字段</div>;

export const chartDefinitions = [
  categoryChart("bar", "柱状图"),
  categoryChart("line", "折线图"),
  categoryChart("area", "面积图"),
  pieDefinition,
];
```

Implement `pieDefinition` with the same `dimension` and `measure` slots and ECharts series `{ type: "pie", data: categories.map((name, index) => ({ name, value: values[index] })) }`.

- [ ] **Step 2: Implement progress, metric, table, and text definitions**

Use these exact slot contracts:

```ts
progress: [{ key: "value", label: "进度值", multiple: false, accepts: ["number"], defaultAggregate: "avg" }]
metric: [{ key: "value", label: "指标", multiple: false, accepts: ["number"], defaultAggregate: "sum" }]
table: [{ key: "columns", label: "列", multiple: true, accepts: ["string", "number", "date", "boolean"], defaultAggregate: "none" }]
text: []
```

Use Zod style schemas:

```ts
progress: z.object({ title: z.string(), color: z.string(), min: z.number(), max: z.number() })
metric: z.object({ label: z.string(), suffix: z.string(), color: z.string() })
table: z.object({ pageSize: z.number().int().min(5).max(100), striped: z.boolean() })
text: z.object({ content: z.string().max(5000), fontSize: z.number().min(12).max(72), color: z.string() })
```

- [ ] **Step 3: Construct and verify registry**

```ts
export const componentRegistry = createRegistry([
  ...chartDefinitions,
  progressDefinition,
  metricDefinition,
  tableDefinition,
  textDefinition,
]);

export function getComponentDefinition(type: ComponentType) {
  const definition = componentRegistry.get(type);
  if (!definition) throw new Error(`Unknown component type: ${type}`);
  return definition;
}
```

Run `pnpm --filter @drag-visual/component-registry test`.

Expected: inventory and defaults tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/component-registry
git commit -m "feat: register eight dashboard components"
```

### Task 4: Generate palette and inspector from definitions

**Files:**
- Create: `apps/editor-web/src/features/palette/ComponentPalette.tsx`
- Create: `apps/editor-web/src/features/inspector/FieldInspector.tsx`
- Create: `apps/editor-web/src/features/inspector/StyleInspector.tsx`
- Create: `apps/editor-web/src/features/inspector/Inspector.test.tsx`
- Modify: `apps/editor-web/src/App.tsx`
- Modify: `apps/editor-web/src/features/canvas/GridCanvas.tsx`

- [ ] **Step 1: Write the failing generated-inspector test**

```tsx
it("renders controls from the selected component definition", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "添加面积图" }));
  expect(screen.getByRole("tab", { name: "字段" })).toBeVisible();
  expect(screen.getByText("维度")).toBeVisible();
  expect(screen.getByText("指标")).toBeVisible();
  await userEvent.click(screen.getByRole("tab", { name: "样式" }));
  expect(screen.getByLabelText("标题")).toHaveValue("面积图");
  expect(screen.getByLabelText("颜色")).toHaveValue("#1677ff");
});
```

- [ ] **Step 2: Implement palette without type switches**

```tsx
export function ComponentPalette() {
  const addComponent = useEditorStore((state) => state.addComponent);
  return <>{[...componentRegistry.values()].map((definition) => (
    <Button key={definition.type} aria-label={`添加${definition.title}`} onClick={() => addComponent(definition.type, definition.defaultProps, definition.defaultLayout)}>
      {definition.title}
    </Button>
  ))}</>;
}
```

- [ ] **Step 3: Implement field and style inspectors**

Implement `FieldInspector`:

```tsx
export function FieldInspector({ definition, binding, onChange }: Props) {
  return <>{definition.dataSlots.map((slot) => (
    <FieldDropZone key={slot.key} id={slot.key} label={slot.label} accepts={slot.accepts} multiple={slot.multiple}
      value={binding?.[slot.key]} onDrop={(field) => onChange(slot.key, { fieldKey: field.fieldKey, aggregate: slot.defaultAggregate })} />
  ))}</>;
}
```

Implement the field-to-control mapping in `StyleInspector`:

```tsx
function StyleControl({ name, value, onChange }: { name: string; value: unknown; onChange(value: unknown): void }) {
  if (name.toLowerCase().includes("color")) return <ColorPicker aria-label={name} value={String(value)} onChange={(_, hex) => onChange(hex)} />;
  if (typeof value === "boolean") return <Switch aria-label={name} checked={value} onChange={onChange} />;
  if (typeof value === "number") return <InputNumber aria-label={name} value={value} onChange={(next) => onChange(next ?? value)} />;
  return <Input aria-label={name} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
}
```

Use one update path:

```tsx
const updateProp = (key: string, value: unknown) => {
  const candidate = { ...component.props, [key]: value };
  const parsed = definition.styleSchema.safeParse(candidate);
  if (parsed.success) updateComponentProps(component.id, parsed.data);
};
```

- [ ] **Step 4: Resolve canvas rendering through registry**

```tsx
const definition = getComponentDefinition(component.type);
return <ComponentFrame title={component.title ?? definition.title}>
  {definition.render({ props: component.props, binding: component.binding?.slots, dataset })}
</ComponentFrame>;
```

- [ ] **Step 5: Run phase gate and commit**

Run:

```bash
pnpm --filter @drag-visual/component-registry test
pnpm --filter @drag-visual/chart-renderer test
pnpm --filter @drag-visual/editor-web test
pnpm typecheck
```

Expected: all tests PASS; all eight components appear in the palette and render through the registry.

```bash
git add apps/editor-web packages/component-registry packages/chart-renderer
git commit -m "feat: generate palette and inspector from registry"
```
