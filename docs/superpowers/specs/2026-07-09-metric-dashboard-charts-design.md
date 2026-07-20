# Metric Dashboard Charts Design

## Goal

Build a usable metric dashboard path for the existing BI editor: a dashboard can combine KPI cards with trend, breakdown, ranking, and table components, and KPI cards can show a target and period comparison alongside the primary value.

## Confirmed Scope

- Use the existing component registry, editor data binding panel, and `packages/chart-renderer` rendering surface.
- Keep the visual language aligned with the current `DataSurface` renderer styles: compact, operational, and scan-friendly.
- Extend the existing `kpi` component instead of creating a new component type.
- Generate an XLSX sample under `outputs/` that can be imported as the source dataset for this metric dashboard.

## KPI Behavior

The KPI component keeps its existing required `measure` slot. It adds two optional numeric slots:

- `target`: the goal value for target progress.
- `comparison`: the previous-period or benchmark value used for delta and rate.

When data is present, the renderer aggregates all configured numeric slots with the KPI aggregation prop. The primary KPI displays prefix, formatted value, and suffix as before. If `comparison` is configured, the card displays a signed delta and percentage change versus comparison. If `target` is configured, the card displays target value and completion progress.

If optional slots are not configured or aggregate to missing values, the KPI still renders the primary value without warnings or layout breakage.

## Dashboard Composition

The sample dataset should support a useful metric dashboard composition:

- KPI cards: revenue, orders, conversion rate, average order value.
- Trend chart: monthly revenue or orders.
- Bar/ranking chart: region or category performance.
- Pie chart: channel contribution.
- Table/crosstab: detailed business rows for drill-down.

The XLSX should include typed dates, numeric metrics, target columns, and comparison columns so it can exercise the KPI enhancement and existing chart types.

## Testing

- Registry tests cover new KPI data slots and backward-compatible default props.
- Renderer option tests cover KPI target/comparison model calculations, including missing optional values and zero comparison handling.
- Renderer component tests cover visible KPI target/comparison output.
- Workbook generation is verified by inspecting key ranges and rendering at least one sheet preview.
