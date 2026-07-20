# Frontend Canvas Layout Strategy

Date: 2026-07-08

## Context

The BI editor canvas uses a 12-column grid and currently renders chart widgets through React Grid Layout (RGL). The product behavior we need is closer to a dashboard editor than a simple sortable list:

- Widgets can be dragged and resized.
- Resizing a widget should persistently push overlapping widgets down.
- Dragging a widget should show temporary displacement only.
- If the dragged widget returns to its original place, displaced widgets should also return.
- During drag, nearby widgets should move by the minimum necessary distance instead of jumping far down the canvas.

The key architectural decision is to separate the visual shadow layout during drag from the persisted dashboard layout.

## Short-Term Plan: Keep RGL, Own Shadow Layout

RGL remains responsible for pointer handling, resize handles, grid coordinate math, and rendering the grid items. The app owns the dashboard-specific collision behavior.

### Current direction

- Use RGL for drag and resize mechanics.
- During drag, allow the active widget to overlap other widgets at the RGL layer.
- Build a deterministic shadow layout from:
  - the original persisted layout,
  - the active dragged widget candidate,
  - the same collision resolver used by our canvas helpers.
- Do not persist passive widget displacement on drag stop.
- On drag stop, persist only the active widget if its final intended position is valid.
- During resize, keep persistent collision resolution so lower widgets are pushed down and saved.

### Why this is safer

RGL's default collision push is generic. It tries to avoid overlap, but it does not know our product rule that passive drag displacement is temporary and should be minimal. Letting RGL push widgets first and then trying to repair the result creates unstable edge cases.

Owning shadow layout gives us deterministic rules:

1. Start from the persisted layout.
2. Replace only the active widget with its current candidate position.
3. Resolve collisions by pushing passive widgets down just enough to clear blockers.
4. Render that as the temporary layout.
5. On drag stop, discard passive movement.

### Follow-up work

- Add Playwright coverage for the real drag path in browser coordinates.
- Add visual QA cases for:
  - dragging a right-side table across a full-width chart,
  - dragging back to the original slot,
  - dragging into an occupied slot,
  - resizing a top chart into lower charts.
- Consider extracting the shadow layout engine into its own module if more placement rules appear.

## Mid-Term Option: Evaluate GridStack

GridStack is a dashboard-oriented layout engine with built-in support for widgets, collision handling, resizing, compacting, and fit checks. It is a stronger candidate if the canvas grows into a full BI layout system.

### Potential benefits

- Built for dashboard/widget editors rather than generic React layout.
- Mature grid engine with widget APIs.
- Supports collision-aware movement, resizing, compacting, and fit checks.
- Can reduce the amount of custom layout logic we maintain.

### Migration risks

- Requires replacing the current RGL integration.
- React integration needs a proof of concept before committing.
- Existing tests around editor drag, resize, store updates, and component frames need adaptation.
- We must verify whether GridStack's default movement matches our desired temporary-vs-persisted behavior.

### Evaluation checklist

- Can GridStack support 12-column dashboard layout with our row height and margins?
- Can it render React component frames without fighting React state?
- Can drag movement be preview-only while resize displacement is persisted?
- Can we block invalid drops and keep previous layout stable?
- Does it support small widget minimum sizes and all-side resize handles cleanly?
- How hard is it to keep editor selection, duplicate, delete, and inspector behavior unchanged?

## Recommendation

Use the short-term RGL shadow layout approach now. It solves the immediate UX issue with the least disruption and keeps our current editor architecture intact.

Evaluate GridStack after the BI component set stabilizes or when more advanced layout behavior is needed, such as multi-breakpoint responsive layouts, nested grids, collision policies, or stronger dashboard packing controls.

## References

- React Grid Layout: https://github.com/react-grid-layout/react-grid-layout
- GridStack: https://github.com/gridstack/gridstack.js
- GridStack API: https://gridstackjs.com/doc/html/classes/GridStack.html
