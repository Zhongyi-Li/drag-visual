# Metric Dashboard Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing KPI component with target and comparison bindings, then deliver an XLSX dataset that supports a complete metric dashboard composition.

**Architecture:** Keep KPI as the existing `kpi` component type. Add optional numeric slots to the component registry, add a focused KPI model builder in `packages/chart-renderer/src/options.ts`, and render the resulting primary, comparison, and target progress values inside `DashboardComponentRenderer`.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, existing component registry/contracts, `@oai/artifact-tool` for XLSX authoring.

---

### Task 1: KPI Registry Slots

**Files:**
- Modify: `packages/component-registry/src/definitions/kpi.ts`
- Test: `packages/component-registry/src/registry.test.ts`

- [ ] Write a failing registry test that expects `kpi` to expose required `measure` plus optional numeric `target` and `comparison` slots.
- [ ] Run `pnpm --filter @drag-visual/component-registry test -- registry.test.ts` and confirm the test fails on missing slots.
- [ ] Update `kpiDefinition.dataSlots` to add `target` and `comparison`.
- [ ] Re-run the same test and confirm it passes.

### Task 2: KPI Model Calculations

**Files:**
- Modify: `packages/chart-renderer/src/options.ts`
- Test: `packages/chart-renderer/src/options.test.ts`

- [ ] Write failing tests for a new `buildKpiModel(component, rows)` helper covering primary aggregation, comparison delta/rate, target progress, missing optional slots, and zero comparison.
- [ ] Run `pnpm --filter @drag-visual/chart-renderer test -- options.test.ts` and confirm the tests fail because `buildKpiModel` is not exported.
- [ ] Implement `buildKpiModel` using the existing `fieldKeys`, `numericValue`, and `buildKpiValue` helpers.
- [ ] Re-run the same test and confirm it passes.

### Task 3: KPI Renderer UI

**Files:**
- Modify: `packages/chart-renderer/src/DashboardComponentRenderer.tsx`
- Test: `packages/chart-renderer/src/DashboardComponentRenderer.test.tsx`

- [ ] Write a failing renderer test that binds `measure`, `target`, and `comparison`, then asserts the KPI displays the primary value, change text, and target progress text.
- [ ] Run `pnpm --filter @drag-visual/chart-renderer test -- DashboardComponentRenderer.test.tsx` and confirm the test fails on missing target/comparison UI.
- [ ] Replace inline KPI aggregation with `buildKpiModel` and add compact styles for comparison and target rows.
- [ ] Re-run the renderer test and confirm it passes.

### Task 4: XLSX Metric Dashboard Sample

**Files:**
- Create: `outputs/metric-dashboard-xlsx/build-metric-dashboard.mjs`
- Create: `outputs/metric-dashboard-xlsx/metric_dashboard_sample.xlsx`

- [ ] Load workspace spreadsheet dependencies with `load_workspace_dependencies`.
- [ ] Read spreadsheet skill `style_guidelines.md`, `API_QUICK_START.md`, and `charts.md`.
- [ ] Create a workbook with `Data`, `Metric Mapping`, and `Dashboard Guide` sheets.
- [ ] Include typed business dates, region, category, channel, revenue, revenue target, prior revenue, orders, order target, prior orders, conversion rate, conversion target, prior conversion rate, average order value, AOV target, and prior AOV.
- [ ] Inspect key ranges, scan formula errors, render a preview, and export the `.xlsx` to `outputs/metric-dashboard-xlsx/metric_dashboard_sample.xlsx`.

### Task 5: Final Verification

**Files:**
- Verify changed source and generated workbook.

- [ ] Run focused component registry tests.
- [ ] Run focused chart renderer tests.
- [ ] Run workbook inspection and visual render verification.
- [ ] Report the changed files and provide the final XLSX link.
