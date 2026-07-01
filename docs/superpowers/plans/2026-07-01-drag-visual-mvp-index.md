# Drag Visual MVP Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an internal visual dashboard editor with grid-based composition, eight components, file/API data binding, persistence, and a standalone preview.

**Architecture:** Build a pnpm/Turborepo modular monolith. Two React applications share schema, editor-core, registry, renderer, data-engine, API client, and UI packages; a NestJS/Fastify API persists projects and normalizes data sources.

**Tech Stack:** pnpm, Turborepo, React, Vite, TypeScript, Ant Design, ECharts, react-grid-layout, dnd-kit, Zustand, TanStack Query, Zod, NestJS, Fastify, Prisma, PostgreSQL, Vitest, Testing Library, Playwright.

---

## Execution order

1. [Phase 1: Foundation and Editor Core](./2026-07-01-drag-visual-phase-1-foundation-editor.md)
2. [Phase 2: Data Sources and Field Binding](./2026-07-01-drag-visual-phase-2-data-binding.md)
3. [Phase 3: Component Registry and Inspector](./2026-07-01-drag-visual-phase-3-components-inspector.md)
4. [Phase 4: Persistence and Preview](./2026-07-01-drag-visual-phase-4-persistence-preview.md)
5. [Phase 5: Reliability and Internal Release](./2026-07-01-drag-visual-phase-5-reliability-release.md)

Each phase ends in runnable, testable software. Execute phases in order because later plans consume contracts created by earlier plans.

## Locked file map

```text
apps/
  editor-web/       editor shell, canvas, inspector, data workspace
  preview-web/      read-only project renderer
  api-server/       projects, files, business-query gateway
packages/
  project-schema/   persisted project and dataset contracts, migrations
  editor-core/      commands, history, selection-independent editing
  component-registry/ component definitions and field/style schemas
  chart-renderer/   ECharts and non-chart renderers
  data-engine/      field inference, binding validation, transforms
  api-client/       generated/typed API boundary
  ui/               shared theme and presentational components
```

## Phase gates

- Phase 1: add, move, resize, undo, redo, and locally restore a chart shell.
- Phase 2: a CSV/XLSX dataset and a business-query dataset can each bind to a bar chart.
- Phase 3: all eight components register without editor-core conditionals.
- Phase 4: saved editor output renders identically in the preview application.
- Phase 5: core E2E passes, 10k-row baseline is met, and P0/P1 defects are zero.

## Specification coverage

| Confirmed requirement | Implemented by |
| --- | --- |
| Three-column editor and grid canvas | Phase 1, Tasks 3–5 |
| Undo/redo and refresh recovery | Phase 1, Tasks 3 and 5 |
| CSV/XLS/XLSX import | Phase 2, Task 2 |
| Approved business API query | Phase 2, Task 3 |
| Field inference, preview, drag binding | Phase 2, Tasks 1 and 4 |
| Eight registered components | Phase 3, Tasks 2–4 |
| Schema-driven field/style inspector | Phase 3, Task 4 |
| Project save/load and revision conflict | Phase 4, Tasks 1 and 3 |
| Schema migrations | Phase 4, Task 2 |
| Standalone preview | Phase 4, Task 4 |
| Local error isolation and stable API errors | Phase 5, Tasks 1 and 2 |
| 10k-row performance baseline | Phase 5, Task 3 |
| Critical workflow E2E and internal gate | Phase 5, Tasks 4 and 5 |
