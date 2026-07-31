import type { DateFilterControl, DateFilterPreset, DateRangeFilter } from "@drag-visual/contracts";

export type RuntimeDateSelection = DateRangeFilter | undefined;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const toCalendarDay = (date: Date): string => {
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const shiftDays = (value: string, offset: number): string => {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, day! + offset));
  return result.toISOString().slice(0, 10);
};

const monthStart = (value: string, offset: number): string => {
  const [year, month] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year!, month! - 1 + offset, 1));
  return result.toISOString().slice(0, 10);
};

const monthEnd = (value: string, offset: number): string => shiftDays(monthStart(value, offset + 1), -1);

export const dateFilterPresetLabel = (preset: DateFilterPreset): string => ({
  all: "全部数据",
  today: "今日",
  yesterday: "昨日",
  last7Days: "近 7 天",
  last30Days: "近 30 天",
  thisMonth: "本月",
  lastMonth: "上月",
})[preset];

export const resolveDateFilterPreset = (
  control: DateFilterControl | undefined,
  preset: DateFilterPreset,
  now: Date = new Date(),
): RuntimeDateSelection => {
  if (control === undefined || preset === "all") return undefined;
  const today = toCalendarDay(now);
  const range = (() => {
    if (preset === "today") return { start: today, end: today };
    if (preset === "yesterday") {
      const yesterday = shiftDays(today, -1);
      return { start: yesterday, end: yesterday };
    }
    if (preset === "last7Days") return { start: shiftDays(today, -6), end: today };
    if (preset === "last30Days") return { start: shiftDays(today, -29), end: today };
    if (preset === "thisMonth") return { start: monthStart(today, 0), end: today };
    return { start: monthStart(today, -1), end: monthEnd(today, -1) };
  })();
  return { kind: "dateRange", fieldKey: control.fieldKey, timezone: control.timezone, ...range };
};

export const defaultDateFilterSelection = (control: DateFilterControl | undefined): RuntimeDateSelection =>
  control === undefined ? undefined : resolveDateFilterPreset(control, control.defaultPreset);

const dayFromValue = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
};

export const filterRowsByDateRange = <Row extends Readonly<Record<string, unknown>>>(
  rows: readonly Row[],
  filter: RuntimeDateSelection,
): readonly Row[] => {
  if (filter === undefined) return rows;
  return rows.filter((row) => {
    const day = dayFromValue(row[filter.fieldKey]);
    return day !== undefined && day >= filter.start && day <= filter.end;
  });
};
