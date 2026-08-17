import type { AnalysisGroupDateFilterControl, DatasetFilter } from "@drag-visual/contracts";

import { defaultDateFilterSelection } from "../datasets/dateFilter.js";

export interface RuntimeAnalysisGroupDateSelection {
  readonly start: string;
  readonly end: string;
}

const asDateFilterControl = (control: AnalysisGroupDateFilterControl) => ({
  fieldKey: "__analysis_group_date__",
  defaultPreset: control.defaultPreset,
  ...(control.defaultRange === null ? {} : { defaultRange: control.defaultRange }),
  allowCustom: control.allowCustom,
  timezone: control.timezone,
});

export const defaultAnalysisGroupDateSelection = (control: AnalysisGroupDateFilterControl | undefined): RuntimeAnalysisGroupDateSelection | undefined => {
  if (control === undefined) return undefined;
  const selection = defaultDateFilterSelection(asDateFilterControl(control));
  return selection === undefined ? undefined : { start: selection.start, end: selection.end };
};

/** Maps one group-level range onto the individual date fields configured for child charts. */
export const analysisGroupDateFiltersForChildren = (
  control: AnalysisGroupDateFilterControl | undefined,
  selection: RuntimeAnalysisGroupDateSelection | undefined,
): Readonly<Record<string, DatasetFilter>> => {
  if (control === undefined || selection === undefined) return {};
  return Object.fromEntries(control.targets.map((target) => [target.componentId, {
    kind: "dateRange" as const,
    fieldKey: target.fieldKey,
    start: selection.start,
    end: selection.end,
    timezone: control.timezone,
  }]));
};
