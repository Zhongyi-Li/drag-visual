# Drag Visual Phase 1: Foundation and Editor Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the monorepo, versioned project schema, editor command history, and a runnable three-column editor with a grid canvas.

**Architecture:** Keep persisted contracts in `project-schema`, pure editing operations in `editor-core`, and React composition in `editor-web`. The canvas emits commands and never mutates project objects directly.

**Tech Stack:** pnpm, Turborepo, React, Vite, TypeScript, Ant Design, react-grid-layout, Zustand, Immer, Zod, Vitest, Testing Library.

---

### Task 1: Initialize repository and workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Git and create the root workspace manifest**

Run:

```bash
git init
pnpm init
```

Replace `package.json` with:

```json
{
  "name": "drag-visual",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Define workspace and task graph**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^lint"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "typecheck": { "dependsOn": ["^typecheck"] }
  }
}
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 3: Ignore generated files**

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.turbo/
.env
.env.*
!.env.example
.superpowers/
playwright-report/
test-results/
```

- [ ] **Step 4: Install and verify the workspace**

Run:

```bash
pnpm install
pnpm exec tsc --version
```

Expected: install succeeds and TypeScript prints a version.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore
git commit -m "chore: initialize drag visual workspace"
```

### Task 2: Define Project Schema v1

**Files:**
- Create: `packages/project-schema/package.json`
- Create: `packages/project-schema/src/project.ts`
- Create: `packages/project-schema/src/project.test.ts`
- Create: `packages/project-schema/src/index.ts`

- [ ] **Step 1: Create package manifest**

```json
{
  "name": "@drag-visual/project-schema",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "latest" },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

- [ ] **Step 2: Write the failing schema test**

Create `packages/project-schema/src/project.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEmptyProject, ProjectSchema } from "./project";

describe("ProjectSchema", () => {
  it("creates a valid version-one project", () => {
    const project = createEmptyProject("project-1", "Sales dashboard");
    expect(ProjectSchema.parse(project)).toEqual(project);
    expect(project.schemaVersion).toBe(1);
    expect(project.components).toEqual([]);
    expect(project.layouts.desktop).toEqual([]);
  });

  it("rejects layout items without matching components", () => {
    const project = createEmptyProject("project-1", "Invalid dashboard");
    project.layouts.desktop.push({ i: "missing", x: 0, y: 0, w: 4, h: 3 });
    expect(() => ProjectSchema.parse(project)).toThrow("layout references unknown component");
  });
});
```

- [ ] **Step 3: Run the test and verify failure**

Run:

```bash
pnpm --filter @drag-visual/project-schema test
```

Expected: FAIL because `./project` does not exist.

- [ ] **Step 4: Implement the schema**

Create `packages/project-schema/src/project.ts`:

```ts
import { z } from "zod";

export const ComponentTypeSchema = z.enum([
  "bar",
  "line",
  "pie",
  "area",
  "progress",
  "metric",
  "table",
  "text",
]);

export const GridItemSchema = z.object({
  i: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const ComponentInstanceSchema = z.object({
  id: z.string().min(1),
  type: ComponentTypeSchema,
  title: z.string().optional(),
  props: z.record(z.string(), z.unknown()),
  binding: z.object({
    dataSourceId: z.string(),
    slots: z.record(z.string(), z.unknown()),
  }).optional(),
});

const BaseProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  theme: z.object({ mode: z.enum(["light", "dark"]), primaryColor: z.string() }),
  layouts: z.object({ desktop: z.array(GridItemSchema) }),
  components: z.array(ComponentInstanceSchema),
  dataSources: z.array(z.object({ id: z.string(), name: z.string(), sourceType: z.enum(["file", "api"]) })),
  updatedAt: z.string().datetime(),
});

export const ProjectSchema = BaseProjectSchema.superRefine((project, context) => {
  const componentIds = new Set(project.components.map((component) => component.id));
  for (const item of project.layouts.desktop) {
    if (!componentIds.has(item.i)) {
      context.addIssue({ code: "custom", message: "layout references unknown component" });
    }
  }
});

export type Project = z.infer<typeof BaseProjectSchema>;
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

export function createEmptyProject(id: string, name: string): Project {
  return {
    schemaVersion: 1,
    id,
    name,
    theme: { mode: "light", primaryColor: "#1677ff" },
    layouts: { desktop: [] },
    components: [],
    dataSources: [],
    updatedAt: new Date().toISOString(),
  };
}
```

Create `packages/project-schema/src/index.ts`:

```ts
export * from "./project";
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
pnpm --filter @drag-visual/project-schema test
```

Expected: 2 tests PASS.

```bash
git add packages/project-schema
git commit -m "feat: define project schema v1"
```

### Task 3: Implement pure editor commands and history

**Files:**
- Create: `packages/editor-core/package.json`
- Create: `packages/editor-core/src/commands.ts`
- Create: `packages/editor-core/src/history.ts`
- Create: `packages/editor-core/src/history.test.ts`
- Create: `packages/editor-core/src/index.ts`

- [ ] **Step 1: Write the failing history test**

Create `packages/editor-core/package.json`:

```json
{
  "name": "@drag-visual/editor-core",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@drag-visual/project-schema": "workspace:*",
    "immer": "latest"
  },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

Then create `packages/editor-core/src/history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@drag-visual/project-schema";
import { createHistory } from "./history";
import { addComponent, moveResizeComponent } from "./commands";

describe("editor history", () => {
  it("undoes and redoes committed commands", () => {
    const history = createHistory(createEmptyProject("p1", "Dashboard"));
    history.execute(addComponent({ id: "c1", type: "bar", props: {} }, { i: "c1", x: 0, y: 0, w: 4, h: 3 }));
    history.execute(moveResizeComponent("c1", { i: "c1", x: 4, y: 0, w: 6, h: 4 }));
    expect(history.current().layouts.desktop[0]?.x).toBe(4);
    history.undo();
    expect(history.current().layouts.desktop[0]?.x).toBe(0);
    history.redo();
    expect(history.current().layouts.desktop[0]?.w).toBe(6);
  });
});
```

- [ ] **Step 2: Verify failure**

Run:

```bash
pnpm --filter @drag-visual/editor-core test
```

Expected: FAIL because command and history modules do not exist.

- [ ] **Step 3: Implement commands**

Create `packages/editor-core/src/commands.ts`:

```ts
import { produce } from "immer";
import type { Project } from "@drag-visual/project-schema";

type Component = Project["components"][number];
type GridItem = Project["layouts"]["desktop"][number];
export type EditorCommand = (project: Project) => Project;

export const addComponent = (component: Component, layout: GridItem): EditorCommand =>
  (project) => produce(project, (draft) => {
    draft.components.push(component);
    draft.layouts.desktop.push(layout);
    draft.updatedAt = new Date().toISOString();
  });

export const moveResizeComponent = (id: string, layout: GridItem): EditorCommand =>
  (project) => produce(project, (draft) => {
    const index = draft.layouts.desktop.findIndex((item) => item.i === id);
    if (index < 0) throw new Error(`Unknown component: ${id}`);
    draft.layouts.desktop[index] = layout;
    draft.updatedAt = new Date().toISOString();
  });
```

- [ ] **Step 4: Implement history**

Create `packages/editor-core/src/history.ts`:

```ts
import type { Project } from "@drag-visual/project-schema";
import type { EditorCommand } from "./commands";

export function createHistory(initial: Project) {
  let present = initial;
  let past: Project[] = [];
  let future: Project[] = [];

  return {
    current: () => present,
    execute(command: EditorCommand) {
      past = [...past, present];
      present = command(present);
      future = [];
    },
    undo() {
      const previous = past.at(-1);
      if (!previous) return;
      future = [present, ...future];
      present = previous;
      past = past.slice(0, -1);
    },
    redo() {
      const next = future[0];
      if (!next) return;
      past = [...past, present];
      present = next;
      future = future.slice(1);
    },
  };
}
```

Create `packages/editor-core/src/index.ts`:

```ts
export * from "./commands";
export * from "./history";
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
pnpm --filter @drag-visual/editor-core test
```

Expected: history test PASS.

```bash
git add packages/editor-core
git commit -m "feat: add editor commands and history"
```

### Task 4: Scaffold the editor shell and grid canvas

**Files:**
- Create: `apps/editor-web/package.json`
- Create: `apps/editor-web/index.html`
- Create: `apps/editor-web/vite.config.ts`
- Create: `apps/editor-web/src/main.tsx`
- Create: `apps/editor-web/src/App.tsx`
- Create: `apps/editor-web/src/editor-store.ts`
- Create: `apps/editor-web/src/features/canvas/GridCanvas.tsx`
- Create: `apps/editor-web/src/features/canvas/GridCanvas.test.tsx`
- Create: `apps/editor-web/src/styles.css`

- [ ] **Step 0: Create the Vite application manifest**

Create `apps/editor-web/package.json`:

```json
{
  "name": "@drag-visual/editor-web",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@drag-visual/editor-core": "workspace:*", "@drag-visual/project-schema": "workspace:*", "antd": "latest", "react": "latest", "react-dom": "latest", "react-grid-layout": "latest", "zustand": "latest" },
  "devDependencies": { "@testing-library/jest-dom": "latest", "@testing-library/react": "latest", "@vitejs/plugin-react": "latest", "jsdom": "latest", "vite": "latest", "vitest": "latest" }
}
```

Create `apps/editor-web/index.html`:

```html
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
```

Create `apps/editor-web/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({ plugins: [react()], test: { environment: "jsdom", setupFiles: ["@testing-library/jest-dom/vitest"] } });
```

- [ ] **Step 1: Write the failing canvas test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../App";

describe("GridCanvas", () => {
  it("adds a bar component from the palette", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "添加柱状图" }));
    expect(screen.getByTestId("canvas-component-bar")).toBeInTheDocument();
    expect(screen.getByText("字段")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

Run:

```bash
pnpm --filter @drag-visual/editor-web test
```

Expected: FAIL because `App` and canvas files do not exist.

- [ ] **Step 3: Implement the store**

Create `apps/editor-web/src/editor-store.ts`:

```ts
import { create } from "zustand";
import { createEmptyProject, type Project } from "@drag-visual/project-schema";
import { addComponent, createHistory } from "@drag-visual/editor-core";

const history = createHistory(createEmptyProject("local-project", "Untitled dashboard"));

interface EditorState {
  project: Project;
  selectedId?: string;
  addBar(): void;
  select(id?: string): void;
  undo(): void;
  redo(): void;
}

export const useEditorStore = create<EditorState>((set) => ({
  project: history.current(),
  addBar: () => {
    const id = crypto.randomUUID();
    const y = Math.max(0, ...history.current().layouts.desktop.map((item) => item.y + item.h));
    history.execute(addComponent({ id, type: "bar", props: {} }, { i: id, x: 0, y, w: 6, h: 4 }));
    set({ project: history.current(), selectedId: id });
  },
  select: (selectedId) => set({ selectedId }),
  undo: () => { history.undo(); set({ project: history.current() }); },
  redo: () => { history.redo(); set({ project: history.current() }); },
}));
```

- [ ] **Step 4: Implement shell and grid**

Create `apps/editor-web/src/features/canvas/GridCanvas.tsx`:

```tsx
import GridLayout from "react-grid-layout/legacy";
import { useEditorStore } from "../../editor-store";

export function GridCanvas() {
  const { project, select } = useEditorStore();
  return (
    <GridLayout layout={project.layouts.desktop} width={960} cols={12} rowHeight={40}>
      {project.components.map((component) => (
        <section key={component.id} data-testid={`canvas-component-${component.type}`} onClick={() => select(component.id)}>
          <strong>{component.type === "bar" ? "柱状图" : component.type}</strong>
        </section>
      ))}
    </GridLayout>
  );
}
```

Create `apps/editor-web/src/App.tsx`:

```tsx
import { Button, Tabs } from "antd";
import { GridCanvas } from "./features/canvas/GridCanvas";
import { useEditorStore } from "./editor-store";
import "./styles.css";

export function App() {
  const { addBar, selectedId, undo, redo } = useEditorStore();
  return (
    <main className="editor-shell">
      <header><Button onClick={undo}>撤销</Button><Button onClick={redo}>重做</Button></header>
      <aside className="palette"><Button aria-label="添加柱状图" onClick={addBar}>柱状图</Button></aside>
      <section className="canvas"><GridCanvas /></section>
      <aside className="inspector">
        {selectedId ? <Tabs items={[{ key: "fields", label: "字段", children: "尚未绑定字段" }, { key: "style", label: "样式", children: "默认样式" }]} /> : "请选择组件"}
      </aside>
    </main>
  );
}
```

Create `apps/editor-web/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
```

Create `apps/editor-web/src/styles.css`:

```css
html, body, #root { width: 100%; height: 100%; margin: 0; }
.editor-shell { display: grid; grid-template: 64px minmax(0, 1fr) / 240px minmax(0, 1fr) 320px; height: 100%; background: #f5f6f8; }
.editor-shell > header { grid-column: 1 / 4; display: flex; gap: 8px; align-items: center; padding: 0 16px; background: #fff; border-bottom: 1px solid #e5e7eb; }
.palette, .inspector { background: #fff; padding: 16px; overflow: auto; }
.palette { border-right: 1px solid #e5e7eb; }
.inspector { border-left: 1px solid #e5e7eb; }
.canvas { min-width: 0; overflow: auto; padding: 24px; }
.react-grid-item { background: #fff; border: 1px solid #d9d9d9; border-radius: 8px; overflow: hidden; }
```

- [ ] **Step 5: Verify behavior and commit**

Run:

```bash
pnpm --filter @drag-visual/editor-web test
pnpm --filter @drag-visual/editor-web typecheck
```

Expected: canvas test PASS and typecheck exits 0.

```bash
git add apps/editor-web
git commit -m "feat: add editor shell and grid canvas"
```

### Task 5: Persist the local phase-one project

**Files:**
- Create: `apps/editor-web/src/local-project.ts`
- Create: `apps/editor-web/src/local-project.test.ts`
- Modify: `apps/editor-web/src/editor-store.ts`

- [ ] **Step 1: Write the failing persistence test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject } from "@drag-visual/project-schema";
import { loadLocalProject, saveLocalProject } from "./local-project";

describe("local project", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips a valid project", () => {
    const project = createEmptyProject("p1", "Dashboard");
    saveLocalProject(project);
    expect(loadLocalProject()).toEqual(project);
  });
  it("discards invalid stored data", () => {
    localStorage.setItem("drag-visual:project", "{}");
    expect(loadLocalProject()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Verify failure**

Run `pnpm --filter @drag-visual/editor-web test`.

Expected: FAIL because local project functions do not exist.

- [ ] **Step 3: Implement guarded persistence**

```ts
import { ProjectSchema, type Project } from "@drag-visual/project-schema";

const KEY = "drag-visual:project";

export function saveLocalProject(project: Project): void {
  localStorage.setItem(KEY, JSON.stringify(ProjectSchema.parse(project)));
}

export function loadLocalProject(): Project | undefined {
  const raw = localStorage.getItem(KEY);
  if (!raw) return undefined;
  const result = ProjectSchema.safeParse(JSON.parse(raw));
  return result.success ? result.data : undefined;
}
```

Update `editor-store.ts` to initialize history from `loadLocalProject() ?? createEmptyProject(...)` and call `saveLocalProject(history.current())` after committed commands.

- [ ] **Step 4: Run phase gate**

Run:

```bash
pnpm test
pnpm typecheck
pnpm --filter @drag-visual/editor-web dev
```

Expected: tests and typechecks pass; browser can add a bar component, move/resize it, undo/redo, reload, and see the restored project.

- [ ] **Step 5: Commit**

```bash
git add apps/editor-web/src/local-project.ts apps/editor-web/src/local-project.test.ts apps/editor-web/src/editor-store.ts
git commit -m "feat: persist local editor project"
```
