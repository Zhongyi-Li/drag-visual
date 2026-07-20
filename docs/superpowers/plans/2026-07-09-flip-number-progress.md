# Flip Number And Progress Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class flip-number and progress-bar chart components plus an upload-ready XLSX sample.

**Architecture:** Add two component definitions in the registry, route palette items to the new component types, and render them in `chart-renderer` with small model builders. The XLSX builder creates a data-first workbook whose first worksheet starts at `A1`, then normalizes OOXML for stricter BI parsers.

**Tech Stack:** TypeScript, React, Vitest, Vite, `@oai/artifact-tool`, OOXML post-processing via `unzip`/`zip`.

---

### Task 1: Component Registry

**Files:**
- Create: `packages/component-registry/src/definitions/flipNumber.ts`
- Create: `packages/component-registry/src/definitions/progressBar.ts`
- Modify: `packages/component-registry/src/index.ts`
- Test: `packages/component-registry/src/registry.test.ts`

- [ ] Add failing tests that `flipNumber` and `progressBar` are registered with the expected slots and defaults.
- [ ] Implement definitions with `measure` for flip number, and `value` plus `target` for progress bar.
- [ ] Export/register both definitions.
- [ ] Run registry tests and confirm pass.

### Task 2: Contracts And Palette

**Files:**
- Modify: `packages/contracts/src/dashboard.ts`
- Modify: `packages/contracts/src/dashboard.test.ts`
- Modify: `apps/web/src/features/editor/ComponentPalette.tsx`
- Test: `apps/web/src/features/editor/EditorShell.test.tsx`

- [ ] Add failing contract and palette tests for `flipNumber` and `progressBar`.
- [ ] Extend `ComponentTypeSchema`.
- [ ] Point palette items “翻牌器” and “进度条” to the new component types.
- [ ] Run focused Web tests and confirm pass.

### Task 3: Renderer

**Files:**
- Modify: `packages/chart-renderer/src/options.ts`
- Modify: `packages/chart-renderer/src/DashboardComponentRenderer.tsx`
- Test: `packages/chart-renderer/src/options.test.ts`
- Test: `packages/chart-renderer/src/DashboardComponentRenderer.test.tsx`

- [ ] Add failing tests for flip-number aggregation/formatting and progress completion.
- [ ] Add `buildFlipNumberModel` and `buildProgressBarModel`.
- [ ] Render flip number as a large number card and progress bar as completion label plus track.
- [ ] Run chart-renderer tests and confirm pass.

### Task 4: XLSX Sample

**Files:**
- Create: `outputs/flip-number-progress-xlsx/build-flip-number-progress.mjs`
- Output: `outputs/flip-number-progress-xlsx/flip_number_progress_upload_ready.xlsx`

- [ ] Create workbook with first sheet `Data` starting at `A1` and non-empty headers.
- [ ] Add mapping and guide sheets for recommended bindings.
- [ ] Normalize OOXML for upload compatibility.
- [ ] Inspect first sheet, scan formula errors, render preview, and run a simplified parser assertion.

### Task 5: Final Verification

- [ ] Build `packages/component-registry`, `packages/contracts`, and `packages/chart-renderer`.
- [ ] Run focused and related tests.
- [ ] Run `apps/web` type check and production build.
- [ ] Report changed behavior and link the final XLSX only.
