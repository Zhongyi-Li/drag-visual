# Drag Visual Phase 4: Persistence and Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist projects with optimistic concurrency, auto-save safely, migrate old schemas, and render saved projects in a standalone preview application.

**Architecture:** PostgreSQL stores validated project JSON plus an integer revision. The API rejects stale writes. Editor and preview applications share project-schema, component-registry, and chart-renderer packages.

**Tech Stack:** NestJS, Fastify, Prisma, PostgreSQL, React, TanStack Query, Zod, Vitest, Supertest, Playwright.

---

### Task 1: Persist validated projects with optimistic concurrency

**Files:**
- Create: `apps/api-server/prisma/schema.prisma`
- Create: `apps/api-server/src/project/project.service.ts`
- Create: `apps/api-server/src/project/project.service.spec.ts`
- Create: `apps/api-server/src/project/project.controller.ts`
- Create: `apps/api-server/src/project/project.module.ts`

- [ ] **Step 1: Define the database model**

```prisma
model Project {
  id        String   @id @default(uuid())
  name      String
  document  Json
  revision  Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([updatedAt])
}
```

Run:

```bash
pnpm --filter @drag-visual/api-server prisma migrate dev --name create_project
```

Expected: migration succeeds and the `Project` table exists.

- [ ] **Step 2: Write failing service tests**

```ts
it("creates a project after schema validation", async () => {
  prisma.project.create.mockResolvedValue({ id: "p1", name: project.name, document: project, revision: 1 });
  await expect(service.create(project)).resolves.toMatchObject({ id: "p1", revision: 1 });
  expect(prisma.project.create).toHaveBeenCalledWith({ data: { name: project.name, document: project } });
});

it("rejects a stale revision", async () => {
  prisma.project.updateMany.mockResolvedValue({ count: 0 });
  await expect(service.update("p1", 2, project)).rejects.toMatchObject({ status: 409, message: "PROJECT_VERSION_CONFLICT" });
});
```

- [ ] **Step 3: Implement create, read, and compare-and-swap update**

```ts
async create(input: unknown) {
  const document = ProjectSchema.parse(input);
  return this.prisma.project.create({ data: { name: document.name, document } });
}

async findOne(id: string) {
  const record = await this.prisma.project.findUniqueOrThrow({ where: { id } });
  return { ...record, document: migrateProject(record.document) };
}

async update(id: string, revision: number, input: unknown) {
  const document = ProjectSchema.parse(input);
  const result = await this.prisma.project.updateMany({
    where: { id, revision },
    data: { name: document.name, document, revision: { increment: 1 } },
  });
  if (result.count !== 1) throw new ConflictException("PROJECT_VERSION_CONFLICT");
  return this.findOne(id);
}
```

- [ ] **Step 4: Expose project endpoints**

```ts
@Post() create(@Body() body: unknown) { return this.service.create(body); }
@Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
@Put(":id") update(@Param("id") id: string, @Headers("if-match") revision: string, @Body() body: unknown) {
  const parsed = Number(revision);
  if (!Number.isInteger(parsed)) throw new BadRequestException("PROJECT_REVISION_REQUIRED");
  return this.service.update(id, parsed, body);
}
```

- [ ] **Step 5: Run tests and commit**

Run `pnpm --filter @drag-visual/api-server test -- project`.

Expected: create, read, validation, update, and conflict tests PASS.

```bash
git add apps/api-server/prisma apps/api-server/src/project
git commit -m "feat: persist projects with optimistic revisions"
```

### Task 2: Add explicit schema migration

**Files:**
- Create: `packages/project-schema/src/migrations.ts`
- Create: `packages/project-schema/src/migrations.test.ts`
- Modify: `packages/project-schema/src/index.ts`

- [ ] **Step 1: Write the failing migration test**

```ts
it("migrates an unversioned prototype document to version one", () => {
  const migrated = migrateProject({ id: "legacy", name: "Legacy", widgets: [], layout: [] });
  expect(migrated.schemaVersion).toBe(1);
  expect(migrated.components).toEqual([]);
  expect(migrated.layouts.desktop).toEqual([]);
});

it("rejects unknown future versions", () => {
  expect(() => migrateProject({ schemaVersion: 99 })).toThrow("UNSUPPORTED_PROJECT_SCHEMA_VERSION");
});
```

- [ ] **Step 2: Implement migration dispatcher**

```ts
export function migrateProject(input: unknown): Project {
  const version = typeof input === "object" && input !== null && "schemaVersion" in input
    ? Number((input as { schemaVersion: unknown }).schemaVersion)
    : 0;
  if (version === 1) return ProjectSchema.parse(input);
  if (version === 0) {
    const legacy = z.object({ id: z.string(), name: z.string(), widgets: z.array(ComponentInstanceSchema), layout: z.array(GridItemSchema) }).parse(input);
    return ProjectSchema.parse({
      schemaVersion: 1,
      id: legacy.id,
      name: legacy.name,
      theme: { mode: "light", primaryColor: "#1677ff" },
      components: legacy.widgets,
      layouts: { desktop: legacy.layout },
      dataSources: [],
      updatedAt: new Date().toISOString(),
    });
  }
  throw new Error("UNSUPPORTED_PROJECT_SCHEMA_VERSION");
}
```

- [ ] **Step 3: Run and commit**

Run `pnpm --filter @drag-visual/project-schema test`.

Expected: migration tests PASS.

```bash
git add packages/project-schema
git commit -m "feat: migrate persisted project schemas"
```

### Task 3: Implement debounced auto-save and conflict UI

**Files:**
- Create: `apps/editor-web/src/features/persistence/useAutoSave.ts`
- Create: `apps/editor-web/src/features/persistence/useAutoSave.test.tsx`
- Create: `packages/api-client/src/projects.ts`
- Create: `packages/api-client/src/errors.ts`
- Create: `packages/api-client/package.json`
- Modify: `apps/editor-web/src/App.tsx`

- [ ] **Step 1: Write failing auto-save tests**

```tsx
it("saves the latest project once after 800ms of inactivity", async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockResolvedValue({ revision: 2 });
  const { rerender } = renderHook(({ project }) => useAutoSave(project, 1, save), { initialProps: { project: projectA } });
  rerender({ project: projectB });
  await vi.advanceTimersByTimeAsync(799);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledWith(projectB, 1);
});

it("surfaces a revision conflict without discarding local state", async () => {
  const save = vi.fn().mockRejectedValue(new ApiError(409, "PROJECT_VERSION_CONFLICT"));
  const { result } = renderHook(() => useAutoSave(projectA, 1, save));
  await waitFor(() => expect(result.current.status).toBe("conflict"));
  expect(result.current.localProject).toEqual(projectA);
});
```

- [ ] **Step 2: Implement typed project API**

Create `packages/api-client/package.json`:

```json
{
  "name": "@drag-visual/api-client",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/projects.ts", "./errors": "./src/errors.ts" },
  "dependencies": { "@drag-visual/project-schema": "workspace:*", "zod": "latest" },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

Create `packages/api-client/src/errors.ts`:

```ts
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
  static async fromResponse(response: Response) {
    const body = await response.json() as { code?: string };
    return new ApiError(response.status, body.code ?? "UNKNOWN_API_ERROR");
  }
}
```

At the top of `projects.ts`, define the response contract:

```ts
const ProjectRecordSchema = z.object({ id: z.string(), revision: z.number().int().positive(), document: ProjectSchema });
```

```ts
export async function updateProject(id: string, project: Project, revision: number) {
  const response = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", "if-match": String(revision) },
    body: JSON.stringify(project),
  });
  if (!response.ok) throw await ApiError.fromResponse(response);
  return ProjectRecordSchema.parse(await response.json());
}
```

- [ ] **Step 3: Implement auto-save hook**

```ts
export function useAutoSave(project: Project, revision: number, save = updateProject) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setStatus("saving");
      try { await save(project, revision); setStatus("saved"); }
      catch (error) { setStatus(error instanceof ApiError && error.code === "PROJECT_VERSION_CONFLICT" ? "conflict" : "error"); }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [project, revision, save]);
  return { status, localProject: project };
}
```

Render a save status in the toolbar. On conflict show buttons `重新加载远端版本` and `复制为新项目`; neither action runs automatically.

- [ ] **Step 4: Run tests and commit**

Run `pnpm --filter @drag-visual/editor-web test -- useAutoSave`.

Expected: debounce, success, failure, and conflict tests PASS.

```bash
git add apps/editor-web/src/features/persistence packages/api-client
git commit -m "feat: add safe project auto-save"
```

### Task 4: Build the standalone preview application

**Files:**
- Create: `apps/preview-web/package.json`
- Create: `apps/preview-web/src/main.tsx`
- Create: `apps/preview-web/src/App.tsx`
- Create: `apps/preview-web/src/ProjectPreview.tsx`
- Create: `apps/preview-web/src/ProjectPreview.test.tsx`
- Create: `apps/preview-web/src/styles.css`

- [ ] **Step 1: Write the failing preview test**

Create `apps/preview-web/package.json`:

```json
{
  "name": "@drag-visual/preview-web",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@drag-visual/api-client": "workspace:*", "@drag-visual/component-registry": "workspace:*", "@drag-visual/project-schema": "workspace:*", "@tanstack/react-query": "latest", "antd": "latest", "react": "latest", "react-dom": "latest" },
  "devDependencies": { "@testing-library/react": "latest", "@vitejs/plugin-react": "latest", "jsdom": "latest", "vite": "latest", "vitest": "latest" }
}
```

```tsx
it("renders saved components through the shared registry", async () => {
  server.use(http.get("/api/projects/p1", () => HttpResponse.json({ id: "p1", revision: 3, document: projectFixture })));
  render(<App projectId="p1" />);
  expect(await screen.findByText("Sales dashboard")).toBeVisible();
  expect(screen.getByTestId("preview-component-bar")).toBeVisible();
  expect(screen.queryByText("字段")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement read-only preview**

```tsx
export function ProjectPreview({ project }: { project: Project }) {
  const datasets = useQueries({ queries: project.dataSources.map((source) => ({ queryKey: ["dataset", source.id], queryFn: () => getDataset(source.id) })) });
  const datasetById = new Map(project.dataSources.map((source, index) => [source.id, datasets[index]?.data]));
  return <div className="preview-grid">
    {project.components.map((component) => {
      const definition = getComponentDefinition(component.type);
      const layout = project.layouts.desktop.find((item) => item.i === component.id);
      const style = layout ? { gridColumn: `${layout.x + 1} / span ${layout.w}`, gridRow: `${layout.y + 1} / span ${layout.h}` } : undefined;
      return <section key={component.id} data-testid={`preview-component-${component.type}`} style={style}>
        {definition.render({ props: component.props, binding: component.binding?.slots, dataset: component.binding ? datasetById.get(component.binding.dataSourceId) : undefined })}
      </section>;
    })}
  </div>;
}
```

Implement the route application:

```tsx
export function App({ projectId }: { projectId: string }) {
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    select: (record) => migrateProject(record.document),
  });
  if (projectQuery.isLoading) return <Spin fullscreen />;
  if (projectQuery.isError || !projectQuery.data) return <Result status="error" title="项目加载失败" />;
  return <ConfigProvider theme={{ token: { colorPrimary: projectQuery.data.theme.primaryColor } }}><ProjectPreview project={projectQuery.data} /></ConfigProvider>;
}
```

The preview bundle must not import `editor-store`, `react-grid-layout`, resize handles, or inspector modules; add an ESLint `no-restricted-imports` rule for those paths.

- [ ] **Step 3: Add editor-to-preview navigation**

Add a toolbar link with `target="_blank"`, `rel="noreferrer"`, and URL `/preview/${project.id}`. Disable it while the project has never been saved.

- [ ] **Step 4: Run phase gate and commit**

Run:

```bash
pnpm --filter @drag-visual/api-server test
pnpm --filter @drag-visual/editor-web test
pnpm --filter @drag-visual/preview-web test
pnpm typecheck
```

Expected: all tests PASS; saved project revision loads in preview and matches editor render output.

```bash
git add apps/preview-web apps/editor-web packages/api-client
git commit -m "feat: add standalone dashboard preview"
```
