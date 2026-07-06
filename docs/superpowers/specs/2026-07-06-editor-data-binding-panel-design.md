# Editor Data Binding Panel Design

## Goal

Add the first real component configuration surface to the editor: when a chart-like component is selected, the right inspector lets the user choose a dataset and bind dataset fields to the component's declared data slots.

## Scope

This slice implements component data binding only. It does not implement dashboard-level query controls, published-page filter widgets, custom chart filtering, or style/theme editing. Text components continue to render without data binding.

## User Experience

When no component is selected, the inspector keeps the existing empty state.

When a text component is selected, the inspector explains that text components do not need a dataset.

When a non-text component is selected, the inspector shows:

- a dataset selector populated from `listDatasets`;
- loading and error states for the dataset list or selected dataset schema;
- one field selector per `ComponentDefinition.dataSlots` entry;
- required-slot validation messages from the existing registry/data-engine contract;
- a clear-binding action when the component already has a binding.

Field choices are filtered by each slot's accepted field types. Single slots use one field value. Multi slots allow multiple field values. Updating a slot dispatches the existing `component.binding.update` command.

## Data Model

The panel writes to the existing `ComponentInstance.binding` shape:

```ts
{
  datasetId: string;
  slots: Record<string, { fieldKey: string } | { fieldKey: string }[]>;
}
```

The dashboard's `datasets` array must also contain the selected dataset with its `schemaVersion` and default parameter values. Required parameters use deterministic defaults by type: number `0`, string `""`, date `"2026-01-01"`, and boolean `false`. Optional parameters are omitted.

When a component changes to a different dataset, slot bindings are reset so fields from the previous dataset cannot leak into the new dataset binding.

## Architecture

`InspectorPanel` remains the composition boundary for the right panel, but the binding-specific logic moves into focused helpers/components so the panel does not become a large form file.

The editor command layer already supports component binding updates. This slice adds a dashboard dataset registration command so binding updates can keep `dashboard.datasets` valid under `DashboardSchema`.

## Testing

Tests cover:

- selecting a dataset adds it to `dashboard.datasets` and creates a component binding;
- required slot selectors are rendered from registry `dataSlots`;
- slot selectors filter fields by accepted type and dispatch binding updates;
- switching datasets clears previous slot selections;
- clearing a binding removes the component binding;
- selected-schema load failures show a user-visible retry/error state.

Focused tests run under the existing web Vitest setup with MSW handlers.

