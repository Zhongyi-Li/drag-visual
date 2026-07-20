# Frontend Local Dataset Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local browser-side dataset management loop for imported CSV/XLSX datasets.

**Architecture:** Keep `LocalDatasetProvider` as the in-memory and persisted store, backed by `localStorage`. Expand `FileDatasetImporter` into the management modal and reuse `DataPreview` for dataset previews.

**Tech Stack:** React, Ant Design, Vitest, Testing Library, shared `@drag-visual/contracts` dataset schemas.

---

### Task 1: Local Dataset Store

**Files:**
- Modify: `apps/web/src/features/datasets/LocalDatasetProvider.tsx`
- Test: `apps/web/src/features/datasets/LocalDatasetProvider.test.tsx`

- [ ] Write tests that prove local datasets are restored from `localStorage`, renamed, deleted, replaced, and updated at the field metadata level.
- [ ] Run the provider test and verify it fails because the management API does not exist yet.
- [ ] Add provider operations: `renameDataset`, `deleteDataset`, `replaceDataset`, and `updateField`.
- [ ] Persist valid local datasets to `localStorage` and ignore invalid stored payloads.
- [ ] Run the provider test and verify it passes.

### Task 2: Import Validation

**Files:**
- Modify: `apps/web/src/features/datasets/fileImport.ts`
- Test: `apps/web/src/features/datasets/fileImport.test.ts`

- [ ] Add parser tests for empty tables, blank headers, duplicate headers, unsupported files, and row/size limits.
- [ ] Run the parser tests and verify the new cases fail.
- [ ] Implement targeted import validation and clearer error messages.
- [ ] Run parser tests and verify they pass.

### Task 3: Management Modal

**Files:**
- Modify: `apps/web/src/features/editor/FileDatasetImporter.tsx`
- Test: `apps/web/src/features/editor/EditorShell.test.tsx`

- [ ] Add editor tests for import preview, rename, field label/type editing, replacement, deletion, and persisted datasets in the binding dropdown.
- [ ] Run the editor shell test and verify the new cases fail.
- [ ] Replace the simple importer success state with a dataset management modal using the provider operations.
- [ ] Run the editor shell test and verify it passes.

### Task 4: Verification

**Files:**
- Test commands only.

- [ ] Run targeted tests for datasets and editor shell.
- [ ] Run the web test package if targeted tests pass.
- [ ] Report any pre-existing failures separately from changes made here.
