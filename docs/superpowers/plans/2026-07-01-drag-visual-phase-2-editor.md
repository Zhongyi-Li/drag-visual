# Phase 2: Editor Core and Grid Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a three-column editor where placeholder components can be added, selected, moved, resized, copied, deleted, undone, redone, saved, and restored.

**Architecture:** Keep all editing operations as pure commands in `editor-core`; Zustand adapts the reducer to React. The grid canvas emits one command at drag/resize completion, while the shared component registry supplies defaults without canvas-level type checks.

**Tech Stack:** TypeScript, React, Ant Design, react-grid-layout, dnd-kit, Zustand, Immer, TanStack Query, Vitest, Testing Library.

---

## Task 1: Implement pure editor commands and history

**Files:**
- Create: `packages/editor-core/package.json`
- Create: `packages/editor-core/tsconfig.json`
- Create: `packages/editor-core/vitest.config.ts`
- Create: `packages/editor-core/src/commands.ts`
- Create: `packages/editor-core/src/reducer.ts`
- Create: `packages/editor-core/src/history.ts`
- Create: `packages/editor-core/src/index.ts`
- Test: `packages/editor-core/src/reducer.test.ts`
- Test: `packages/editor-core/src/history.test.ts`

- [ ] **Step 1: Write failing reducer tests**

```ts
import { describe, expect, it } from "vitest";
import { applyCommand } from "./reducer";
import type { Dashboard } from "@drag-visual/contracts";

const empty: Dashboard = {
  schemaVersion: 1,
  id: "dash-1",
  name: "看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("applyCommand", () => {
  it("adds and removes a component with matching layout", () => {
    const added = applyCommand(empty, {
      type: "component.add",
      component: { id: "cmp-1", type: "bar", props: {} },
      layout: { i: "cmp-1", x: 0, y: 0, w: 4, h: 4 },
    });
    expect(added.components.map((item) => item.id)).toEqual(["cmp-1"]);
    expect(applyCommand(added, { type: "component.remove", componentId: "cmp-1" }).layout).toEqual([]);
  });

  it("moves and resizes a component", () => {
    const seeded = applyCommand(empty, {
      type: "component.add",
      component: { id: "cmp-1", type: "bar", props: {} },
      layout: { i: "cmp-1", x: 0, y: 0, w: 4, h: 4 },
    });
    const changed = applyCommand(seeded, { type: "layout.change", item: { i: "cmp-1", x: 2, y: 1, w: 6, h: 5 } });
    expect(changed.layout[0]).toMatchObject({ x: 2, y: 1, w: 6, h: 5 });
  });
});
```

- [ ] **Step 2: Run reducer tests and verify failure**

Run: `pnpm --filter @drag-visual/editor-core test -- reducer.test.ts`

Expected: FAIL because the reducer does not exist.

- [ ] **Step 3: Define commands and the reducer**

```ts
// packages/editor-core/src/commands.ts
import type { ComponentInstance, Dashboard, GridItem } from "@drag-visual/contracts";

export type EditorCommand =
  | { type: "component.add"; component: ComponentInstance; layout: GridItem }
  | { type: "component.remove"; componentId: string }
  | { type: "component.duplicate"; sourceId: string; component: ComponentInstance; layout: GridItem }
  | { type: "layout.change"; item: GridItem }
  | { type: "component.props.update"; componentId: string; props: Record<string, unknown> }
  | { type: "component.binding.update"; componentId: string; binding: ComponentInstance["binding"] }
  | { type: "dashboard.theme.update"; theme: Dashboard["theme"] };
```

```ts
// packages/editor-core/src/reducer.ts
import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import type { EditorCommand } from "./commands";

export function applyCommand(state: Dashboard, command: EditorCommand): Dashboard {
  let next: Dashboard;
  switch (command.type) {
    case "component.add":
      next = { ...state, components: [...state.components, command.component], layout: [...state.layout, command.layout] };
      break;
    case "component.remove":
      next = { ...state, components: state.components.filter((item) => item.id !== command.componentId), layout: state.layout.filter((item) => item.i !== command.componentId) };
      break;
    case "component.duplicate":
      next = { ...state, components: [...state.components, command.component], layout: [...state.layout, command.layout] };
      break;
    case "layout.change":
      next = { ...state, layout: state.layout.map((item) => item.i === command.item.i ? command.item : item) };
      break;
    case "component.props.update":
      next = { ...state, components: state.components.map((item) => item.id === command.componentId ? { ...item, props: command.props } : item) };
      break;
    case "component.binding.update":
      next = { ...state, components: state.components.map((item) => item.id === command.componentId ? { ...item, binding: command.binding } : item) };
      break;
    case "dashboard.theme.update":
      next = { ...state, theme: command.theme };
      break;
  }
  return DashboardSchema.parse(next);
}
```

- [ ] **Step 4: Write failing history tests**

```ts
import { describe, expect, it } from "vitest";
import { createHistory, execute, redo, undo } from "./history";

describe("history", () => {
  it("undoes and redoes one logical command", () => {
    const history = createHistory({ value: 0 });
    const changed = execute(history, { value: 1 });
    expect(undo(changed).present.value).toBe(0);
    expect(redo(undo(changed)).present.value).toBe(1);
  });
});
```

- [ ] **Step 5: Implement bounded history**

```ts
export interface History<T> { past: T[]; present: T; future: T[] }

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export function execute<T>(history: History<T>, next: T, limit = 100): History<T> {
  return { past: [...history.past, history.present].slice(-limit), present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}
```

- [ ] **Step 6: Run package tests and typecheck**

Run: `pnpm --filter @drag-visual/editor-core test && pnpm --filter @drag-visual/editor-core typecheck`

Expected: PASS.

- [ ] **Step 7: Commit editor core**

```bash
git add packages/editor-core
git commit -m "feat: add pure editor commands and history"
```

## Task 2: Add the component registry contract and placeholder definition

**Files:**
- Create: `packages/component-registry/package.json`
- Create: `packages/component-registry/src/types.ts`
- Create: `packages/component-registry/src/registry.ts`
- Create: `packages/component-registry/src/definitions/bar.ts`
- Create: `packages/component-registry/src/index.ts`
- Test: `packages/component-registry/src/registry.test.ts`

- [ ] **Step 1: Write a failing registry test**

```ts
import { describe, expect, it } from "vitest";
import { componentRegistry } from "./registry";

describe("componentRegistry", () => {
  it("returns the bar definition without editor conditionals", () => {
    expect(componentRegistry.get("bar")).toMatchObject({ title: "柱状图", defaultLayout: { w: 6, h: 5 } });
  });
});
```

- [ ] **Step 2: Implement the definition interface and registry**

```ts
// packages/component-registry/src/types.ts
import type { ComponentType, Dataset, GridItem } from "@drag-visual/contracts";
import type { ZodType } from "zod";

export type SlotDefinition = {
  key: string;
  label: string;
  accepts: Array<"string" | "number" | "date" | "boolean">;
  multiple: boolean;
  required: boolean;
};

export interface ComponentDefinition<Props = Record<string, unknown>> {
  type: ComponentType;
  title: string;
  defaultLayout: Pick<GridItem, "w" | "h">;
  defaultProps: Props;
  propsSchema: ZodType<Props>;
  dataSlots: SlotDefinition[];
  validateBinding(binding: unknown, dataset: Dataset): { valid: boolean; messages: string[] };
}
```

```ts
// packages/component-registry/src/registry.ts
import type { ComponentType } from "@drag-visual/contracts";
import type { ComponentDefinition } from "./types";
import { barDefinition } from "./definitions/bar";

const definitions = new Map<ComponentType, ComponentDefinition>([["bar", barDefinition]]);

export const componentRegistry = {
  get(type: ComponentType) {
    const definition = definitions.get(type);
    if (!definition) throw new Error(`COMPONENT_DEFINITION_NOT_FOUND:${type}`);
    return definition;
  },
  list: () => [...definitions.values()],
};
```

- [ ] **Step 3: Implement the bar placeholder definition**

```ts
import { z } from "zod";
import type { ComponentDefinition } from "../types";

const BarPropsSchema = z.object({ title: z.string(), color: z.string() });

export const barDefinition: ComponentDefinition<z.infer<typeof BarPropsSchema>> = {
  type: "bar",
  title: "柱状图",
  defaultLayout: { w: 6, h: 5 },
  defaultProps: { title: "柱状图", color: "#1677ff" },
  propsSchema: BarPropsSchema,
  dataSlots: [],
  validateBinding: () => ({ valid: true, messages: [] }),
};
```

- [ ] **Step 4: Run registry tests and commit**

Run: `pnpm --filter @drag-visual/component-registry test && pnpm --filter @drag-visual/component-registry typecheck`

Expected: PASS.

```bash
git add packages/component-registry
git commit -m "feat: add component registry contract"
```

## Task 3: Adapt editor history to a Zustand store

**Files:**
- Create: `apps/web/src/features/editor/store/editorStore.ts`
- Create: `apps/web/src/features/editor/store/editorStore.test.ts`

- [ ] **Step 1: Write failing store tests**

```ts
import { describe, expect, it } from "vitest";
import { createEditorStore } from "./editorStore";

describe("editorStore", () => {
  it("tracks selection separately from persisted schema", () => {
    const store = createEditorStore();
    store.getState().loadDashboard({
      schemaVersion: 1, id: "d1", name: "看板",
      theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
      layout: [], components: [], datasets: [], revision: 1,
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    store.getState().select("cmp-1");
    expect(store.getState().selectedId).toBe("cmp-1");
    expect("selectedId" in store.getState().history.present).toBe(false);
  });
});
```

- [ ] **Step 2: Implement the store factory**

```ts
import type { Dashboard } from "@drag-visual/contracts";
import { applyCommand, createHistory, execute, redo, undo, type EditorCommand, type History } from "@drag-visual/editor-core";
import { createStore } from "zustand/vanilla";

type EditorState = {
  history: History<Dashboard> | null;
  selectedId: string | null;
  dirty: boolean;
  loadDashboard(dashboard: Dashboard): void;
  dispatch(command: EditorCommand): void;
  select(id: string | null): void;
  undo(): void;
  redo(): void;
  markSaved(dashboard: Dashboard): void;
};

export function createEditorStore() {
  return createStore<EditorState>((set, get) => ({
    history: null,
    selectedId: null,
    dirty: false,
    loadDashboard: (dashboard) => set({ history: createHistory(dashboard), selectedId: null, dirty: false }),
    dispatch: (command) => set((state) => {
      if (!state.history) return state;
      return { history: execute(state.history, applyCommand(state.history.present, command)), dirty: true };
    }),
    select: (selectedId) => set({ selectedId }),
    undo: () => set((state) => state.history ? ({ history: undo(state.history), dirty: true }) : state),
    redo: () => set((state) => state.history ? ({ history: redo(state.history), dirty: true }) : state),
    markSaved: (dashboard) => set((state) => ({ history: state.history ? { ...state.history, present: dashboard } : createHistory(dashboard), dirty: false })),
  }));
}
```

- [ ] **Step 3: Run store tests and commit**

Run: `pnpm --filter @drag-visual/web test -- editorStore.test.ts`

Expected: PASS.

```bash
git add apps/web/src/features/editor/store
git commit -m "feat: connect editor history to Zustand"
```

## Task 4: Build the three-column editor and component palette

**Files:**
- Create: `apps/web/src/features/editor/EditorPage.tsx`
- Create: `apps/web/src/features/editor/EditorShell.tsx`
- Create: `apps/web/src/features/editor/ComponentPalette.tsx`
- Create: `apps/web/src/features/editor/InspectorPlaceholder.tsx`
- Create: `apps/web/src/features/editor/editor.css`
- Modify: `apps/web/src/app/router.tsx`
- Test: `apps/web/src/features/editor/EditorShell.test.tsx`

- [ ] **Step 1: Write a failing shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditorShell } from "./EditorShell";

describe("EditorShell", () => {
  it("renders palette, canvas, and inspector landmarks", () => {
    render(<EditorShell palette={<div>组件</div>} canvas={<div>画布</div>} inspector={<div>属性</div>} />);
    expect(screen.getByRole("complementary", { name: "组件面板" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "看板画布" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "属性面板" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement the editor shell**

```tsx
type Props = { palette: React.ReactNode; canvas: React.ReactNode; inspector: React.ReactNode };

export function EditorShell({ palette, canvas, inspector }: Props) {
  return (
    <div className="editor-shell">
      <aside aria-label="组件面板" className="editor-shell__palette">{palette}</aside>
      <main aria-label="看板画布" className="editor-shell__canvas">{canvas}</main>
      <aside aria-label="属性面板" className="editor-shell__inspector">{inspector}</aside>
    </div>
  );
}
```

Use CSS grid columns `240px minmax(720px, 1fr) 320px`, a fixed top toolbar, and independent scroll containers. At widths below 1200px, keep the center minimum width and allow horizontal page scrolling; mobile editing is out of scope.

- [ ] **Step 3: Implement palette click-to-add before drag-to-add**

Render `componentRegistry.list()`. On click, generate `crypto.randomUUID()`, create component defaults and the next open grid position, then dispatch `component.add` and select the new ID. This accessible click path remains available after dnd-kit is added.

- [ ] **Step 4: Run shell tests and commit**

Run: `pnpm --filter @drag-visual/web test -- EditorShell.test.tsx`

Expected: PASS.

```bash
git add apps/web/src/features/editor apps/web/src/app/router.tsx
git commit -m "feat: add three-column editor shell"
```

## Task 5: Implement the responsive grid canvas

**Files:**
- Create: `apps/web/src/features/editor/GridCanvas.tsx`
- Create: `apps/web/src/features/editor/ComponentFrame.tsx`
- Create: `apps/web/src/features/editor/GridCanvas.test.tsx`

- [ ] **Step 1: Write failing component-frame behavior tests**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentFrame } from "./ComponentFrame";

describe("ComponentFrame", () => {
  it("selects and exposes copy/delete actions", () => {
    const onSelect = vi.fn();
    const onCopy = vi.fn();
    const onDelete = vi.fn();
    render(<ComponentFrame title="柱状图" selected={false} onSelect={onSelect} onCopy={onCopy} onDelete={onDelete}><div>内容</div></ComponentFrame>);
    fireEvent.click(screen.getByRole("group", { name: "柱状图" }));
    fireEvent.click(screen.getByRole("button", { name: "复制柱状图" }));
    fireEvent.click(screen.getByRole("button", { name: "删除柱状图" }));
    expect(onSelect).toHaveBeenCalled();
    expect(onCopy).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `ComponentFrame`**

Use an Ant Design `Button` pair with copy and delete icons, stop pointer propagation on toolbar actions, and add a visible selected border. The frame body renders the registry title and a neutral placeholder until Phase 3 adds chart renderers.

- [ ] **Step 3: Implement controlled react-grid-layout usage**

```tsx
import { GridLayout, useContainerWidth, type LayoutItem } from "react-grid-layout";

export function GridCanvas({ layout, onLayoutCommit, children }: {
  layout: LayoutItem[];
  onLayoutCommit(item: LayoutItem): void;
  children: React.ReactNode;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  return (
    <div ref={containerRef} style={{ minHeight: "100%" }}>
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: 12, rowHeight: 44, margin: [12, 12], padding: [12, 12] }}
          dragConfig={{ enabled: true, handle: ".component-frame__drag-handle" }}
          resizeConfig={{ enabled: true, handles: ["se"] }}
          onDragStop={(_layout, _oldItem, item) => onLayoutCommit(item)}
          onResizeStop={(_layout, _oldItem, item) => onLayoutCommit(item)}
        >
          {children}
        </GridLayout>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire grid events to one `layout.change` command**

Do not dispatch during `onDrag` or `onResize`. Convert the final item to the shared `GridItem` contract in `onDragStop`/`onResizeStop`, then dispatch once.

- [ ] **Step 5: Run canvas tests and commit**

Run: `pnpm --filter @drag-visual/web test -- GridCanvas.test.tsx && pnpm --filter @drag-visual/web typecheck`

Expected: PASS.

```bash
git add apps/web/src/features/editor
git commit -m "feat: add draggable resizable grid canvas"
```

## Task 6: Add palette drag-and-drop and toolbar actions

**Files:**
- Modify: `apps/web/src/features/editor/ComponentPalette.tsx`
- Modify: `apps/web/src/features/editor/EditorPage.tsx`
- Create: `apps/web/src/features/editor/EditorToolbar.tsx`
- Test: `apps/web/src/features/editor/EditorPage.test.tsx`

- [ ] **Step 1: Add dnd-kit dependencies**

Run: `pnpm --filter @drag-visual/web add @dnd-kit/core`

- [ ] **Step 2: Write a failing toolbar test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "./EditorToolbar";

it("calls undo, redo, save, preview, and publish actions", () => {
  const actions = { onUndo: vi.fn(), onRedo: vi.fn(), onSave: vi.fn(), onPreview: vi.fn(), onPublish: vi.fn() };
  render(<EditorToolbar dirty canUndo canRedo {...actions} />);
  for (const label of ["撤销", "重做", "保存", "预览", "发布"]) fireEvent.click(screen.getByRole("button", { name: label }));
  expect(Object.values(actions).every((action) => action.mock.calls.length === 1)).toBe(true);
});
```

- [ ] **Step 3: Implement palette drag data and canvas drop handling**

Use `useDraggable({ id: definition.type, data: { kind: "component-definition", type: definition.type } })`. Wrap the editor in `DndContext`; on drag end, only add when the pointer is inside the canvas droppable rect. Convert pointer coordinates to the nearest 12-column grid cell and clamp the default layout inside the grid.

- [ ] **Step 4: Implement toolbar keyboard shortcuts**

Bind `Meta/Ctrl+Z` to undo, `Meta/Ctrl+Shift+Z` to redo, `Meta/Ctrl+S` to save, `Delete/Backspace` to delete the selected component only when focus is not in an input, textarea, or contenteditable element.

- [ ] **Step 5: Run editor tests and commit**

Run: `pnpm --filter @drag-visual/web test -- EditorPage.test.tsx && pnpm --filter @drag-visual/web typecheck`

Expected: PASS.

```bash
git add apps/web/src/features/editor
git commit -m "feat: add palette drag and editor toolbar"
```

## Task 7: Save and restore editor drafts manually

**Files:**
- Create: `apps/web/src/features/editor/dashboardQueries.ts`
- Modify: `apps/web/src/features/editor/EditorPage.tsx`
- Test: `apps/web/src/features/editor/EditorPage.integration.test.tsx`

- [ ] **Step 1: Write a failing save/restore integration test**

Mock `GET /dashboards/dash-1` with one component and `PUT /dashboards/dash-1` with revision `2`. Assert the editor loads the component, marks dirty after a move command, sends the current schema on save, and clears the dirty indicator after the response.

- [ ] **Step 2: Implement query hooks**

```ts
import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { requestJson } from "../../api/client";

export const useDashboard = (id: string) => useQuery({
  queryKey: ["dashboard", id],
  queryFn: async () => DashboardSchema.parse(await requestJson(`/dashboards/${id}`)),
});

export const useSaveDashboard = (id: string) => useMutation({
  mutationFn: async (dashboard: Dashboard) => DashboardSchema.parse(await requestJson(`/dashboards/${id}`, {
    method: "PUT",
    body: JSON.stringify(dashboard),
  })),
});
```

- [ ] **Step 3: Load once and preserve unsaved local state**

On successful first query, call `loadDashboard`. Do not call it again after background refetch while `dirty` is true. On save success, call `markSaved(response)` so the returned revision becomes the new base.

- [ ] **Step 4: Run the Phase 2 test suite**

Run: `pnpm --filter @drag-visual/editor-core test && pnpm --filter @drag-visual/component-registry test && pnpm --filter @drag-visual/web test && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit manual persistence**

```bash
git add apps/web/src/features/editor
git commit -m "feat: save and restore editor drafts"
```

## Task 8: Verify the Phase 2 gate

**Files:**
- Modify: `docs/runbooks/local-development.md`

- [ ] **Step 1: Add the Phase 2 smoke scenario**

Document: create a dashboard, add a bar placeholder, move and resize it, duplicate it, delete the copy, undo, redo, save, reload, and confirm the original layout returns.

- [ ] **Step 2: Run all quality gates**

Run: `pnpm typecheck && pnpm test && pnpm build`

Expected: PASS.

- [ ] **Step 3: Commit the verified runbook**

```bash
git add docs/runbooks/local-development.md
git commit -m "docs: add editor smoke test"
```

