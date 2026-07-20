# Frontend Local Dataset Management Design

## Goal

Complete the front-end-only dataset management loop so an editor user can import a file, preview the parsed data, rename datasets, delete or replace local datasets, edit field display names and inferred types, and keep imported datasets after a page refresh.

## Scope

This phase covers local datasets stored in the browser. It does not add server-side upload or dashboard save integration for raw file data. Excel import continues to read the first worksheet; multi-sheet selection remains a follow-up because it needs a file parsing choice before dataset creation.

## Architecture

`LocalDatasetProvider` remains the single source of truth for local imported datasets. It will expose management operations for add, rename, delete, replace, and field updates, and persist records to `localStorage` after validating them with the shared contracts.

`FileDatasetImporter` becomes the local dataset management surface. The modal will show imported datasets, preview the active dataset, allow file replacement, and expose focused controls for dataset name and field metadata. `DataPreview` continues to render parsed rows and validation messages.

## Error Handling

File import errors should use actionable Chinese messages for unsupported format, missing header, empty data rows, duplicate headers, invalid Excel structure, and files that exceed local limits. Persisted data that fails contract validation will be ignored rather than crashing the editor.

## Testing

Tests should cover provider persistence and management operations, parser validation for duplicate or empty headers, and the editor modal flow for previewing, renaming, deleting, replacing, and editing fields.
