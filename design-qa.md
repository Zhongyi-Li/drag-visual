# Design QA — 计算指标配置

## Comparison target

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-2fcd0c73-afea-4296-b908-4db6c0c0cb3b.png`
- Intended implementation surface: existing dashboard editor → right-side “字段” tab → metric slot → “新建计算指标”.
- Intended viewport: desktop, narrow inspector panel / bottom configuration drawer.

## Evidence

- The local app is reachable at `http://localhost:5173/`.
- The in-app browser resolves to the ZHBi login screen before the editor route. No authenticated editor session was available, and no credentials were entered or submitted.
- As a result, no implementation screenshot of the selected component state could be captured. Source and implementation could not be placed in the same visual comparison input.

## Primary interaction coverage outside browser QA

- A calculated metric stores a name, format, safe divide-by-zero setting, and a tokenized four-operator formula.
- The drawer now follows the selected reference hierarchy: metric settings, formula editor with an operator row, divide-by-zero handling, searchable structured metric list, then preview and save.
- Percentage-format metrics are normalized to percentage points for chart axes and values (for example `0.286` becomes `28.6`).
- Saving the drawer appends the metric to the current component binding and binds it to the target metric slot.
- Calculated metrics add their source fields to the aggregation request and are evaluated only after aggregation.
- Browser-stored imports receive the same group-first calculation path.

## Required fidelity surfaces

- Fonts and typography: blocked — authenticated UI could not be rendered.
- Spacing and layout rhythm: blocked — authenticated UI could not be rendered.
- Colors and visual tokens: blocked — authenticated UI could not be rendered.
- Image quality and asset fidelity: no custom raster asset is required; blocked for full visual comparison.
- Copy and content: source copy has been implemented in the configuration drawer; blocked for rendered verification.

## Findings

- [P1] Authenticated visual comparison unavailable.
  - Location: dashboard editor configuration surface.
  - Evidence: the in-app browser only showed the ZHBi login screen.
  - Impact: the selected mock cannot be compared to the real rendered drawer, so typography, spacing, and final interaction polish cannot be signed off visually.
  - Fix: sign in to ZHBi in the in-app browser, then reopen a chart’s metric field configuration and capture the “新建计算指标” drawer.

## Implementation checklist

1. Sign in and open a chart with a numeric metric slot.
2. Choose “新建计算指标”, create `销售毛利 ÷ 销售额`, and save.
3. Search a metric, add it from the structured list, then remove a formula token and verify the save state updates.
4. Verify the resulting metric renders after clicking the chart’s data refresh action.
5. Capture the drawer at the selected target size and compare it against the source visual.

final result: blocked
