# Drag Visual MVP Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an internal single-organization BI dashboard MVP that queries a unified business API, supports drag-and-drop chart composition and field binding, saves drafts, and publishes stable read-only snapshots.

**Architecture:** Use a pnpm Workspace modular monolith with one React/Vite application, one NestJS/Fastify API, PostgreSQL, and shared TypeScript packages. Editor, preview, and published routes share the same dashboard schema, component registry, and renderer.

**Tech Stack:** React, Vite, TypeScript, Ant Design, Apache ECharts, react-grid-layout, dnd-kit, Zustand, Immer, TanStack Query, React Hook Form, Zod, NestJS, Fastify, Prisma, PostgreSQL, Vitest, Testing Library, Playwright.

---

## Execution order

1. [Phase 1: Workspace, Contracts, and API Foundation](./2026-07-01-drag-visual-phase-1-foundation.md)
2. [Phase 2: Editor Core and Grid Canvas](./2026-07-01-drag-visual-phase-2-editor.md)
3. [Phase 3: Dataset Binding, Charts, and Inspector](./2026-07-01-drag-visual-phase-3-data-components.md)
4. [Phase 4: Persistence, Publishing, and Release](./2026-07-01-drag-visual-phase-4-release.md)

Execute phases in order. Every phase ends with runnable software and a focused acceptance command.

## Locked file map

```text
apps/
  web/                    React editor, preview, and published routes
  api/                    NestJS dashboard, publishing, and dataset gateway
packages/
  contracts/              Zod schemas and shared API/domain types
  editor-core/            Pure commands, reducer, and history logic
  data-engine/            Binding validation and tabular transforms
  component-registry/     Component definitions and slot metadata
  chart-renderer/         ECharts/non-chart renderers and option builders
  ui/                     Shared theme and presentational primitives
prisma/
  schema.prisma           Dashboard persistence schema
e2e/
  dashboard-flow.spec.ts  Critical Playwright workflow
```

Dependency direction:

```text
apps -> feature packages -> contracts
chart-renderer -> component-registry + data-engine + contracts
editor-core -> contracts
contracts -> no application, UI, network, or database package
```

## Phase gates

- Phase 1: API health passes; an empty dashboard can be created and read through the Web app.
- Phase 2: a placeholder component can be added, moved, resized, undone, redone, saved, and restored.
- Phase 3: all six components bind to a normalized dataset without editor-level component conditionals.
- Phase 4: a saved draft publishes atomically, the shared renderer displays it, and the critical E2E passes.

## Specification coverage

| Confirmed requirement | Plan coverage |
| --- | --- |
| Single React app and NestJS API | Phase 1 |
| Dashboard Schema and schema versioning | Phases 1 and 4 |
| Three-column editor and grid canvas | Phase 2 |
| Add, move, resize, copy, delete, undo, redo | Phase 2 |
| Unified business API only | Phase 3 |
| Dataset schema, query parameters, preview | Phase 3 |
| Six components and schema-driven inspector | Phase 3 |
| Manual save, autosave, and revision conflict | Phases 2 and 4 |
| Preview, publish, and republish | Phase 4 |
| Error isolation and schema drift handling | Phase 4 |
| 10k-row rendering baseline | Phase 4 |
| Internal identity integration seam | Phase 4 |
| Critical E2E and release checklist | Phase 4 |

