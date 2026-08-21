import { DashboardSchema } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { buildDatasetAggregation } from "./datasetAggregation.js";

const baseDashboard = {
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "chart-1", x: 0, y: 0, w: 6, h: 5 }],
  datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
};

describe("buildDatasetAggregation", () => {
  it("sends dimensions and per-metric aggregation to a remote query", () => {
    const component = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "bar",
        props: { aggregation: "sum", color: "#1677ff", showLegend: true },
        binding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "month" },
            measure: [
              { fieldKey: "revenue", aggregation: "avg" },
              { fieldKey: "orders" },
            ],
          },
        },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(component)).toEqual({
      groupBy: ["month"],
      measures: [
        { fieldKey: "revenue", aggregation: "avg" },
        { fieldKey: "orders", aggregation: "sum" },
      ],
    });
  });

  it("keeps raw-value charts and unsupported first-value defaults on the existing path", () => {
    const line = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "line",
        props: { color: "#1677ff", showLegend: true, smooth: false, area: false },
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }] } },
      }],
    }).components[0]!;
    const kpi = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "kpi",
        props: { aggregation: "first", prefix: "", suffix: "", decimals: 0 },
        binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }] } },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(line)).toBeUndefined();
    expect(buildDatasetAggregation(kpi)).toBeUndefined();
  });

  it("aggregates table numeric columns by the remaining columns when configured", () => {
    const table = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "table",
        props: { aggregateRows: true, aggregation: "sum", pageSize: 20, striped: false },
        binding: {
          datasetId: "sales",
          slots: {
            columns: [
              { fieldKey: "productName" },
              { fieldKey: "supplyPrice", aggregation: "sum" },
              { fieldKey: "saleCostPrice", aggregation: "sum" },
            ],
          },
        },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(table)).toEqual({
      groupBy: ["productName"],
      measures: [
        { fieldKey: "supplyPrice", aggregation: "sum" },
        { fieldKey: "saleCostPrice", aggregation: "sum" },
      ],
    });
  });

  it("uses an individually selected aggregation for trend analysis", () => {
    const trend = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "trend",
        props: { aggregation: "sum", showSummary: true, timeGranularity: "month" },
        binding: {
          datasetId: "sales",
          slots: {
            timeDimension: { fieldKey: "businessDate" },
            measure: { fieldKey: "revenue", aggregation: "avg" },
          },
        },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(trend)).toEqual({
      groupBy: ["businessDate"],
      measures: [{ fieldKey: "revenue", aggregation: "avg" }],
    });
  });

  it("builds an aggregation request for percentage bar metrics", () => {
    const percentageBar = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "percentBar",
        props: { aggregation: "sum", color: "#1677ff", showLegend: true, smooth: true, area: true },
        binding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "warehouse" },
            measures: [
              { fieldKey: "productAmount", aggregation: "avg" },
              { fieldKey: "supplyPrice", aggregation: "count" },
            ],
          },
        },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(percentageBar)).toEqual({
      groupBy: ["warehouse"],
      measures: [
        { fieldKey: "productAmount", aggregation: "avg" },
        { fieldKey: "supplyPrice", aggregation: "count" },
      ],
    });
  });

  it("builds a single-metric aggregation request for concentric ring bars", () => {
    const ringBar = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "ringBar",
        props: { aggregation: "avg", color: "#1677ff", showLegend: true },
        binding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "productName" },
            measure: { fieldKey: "price", aggregation: "avg" },
            tooltipMeasures: [
              { fieldKey: "saleCostPrice", aggregation: "sum" },
              { fieldKey: "costPrice", aggregation: "max" },
            ],
          },
        },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(ringBar)).toEqual({
      groupBy: ["productName"],
      measures: [
        { fieldKey: "price", aggregation: "avg" },
        { fieldKey: "saleCostPrice", aggregation: "sum" },
        { fieldKey: "costPrice", aggregation: "max" },
      ],
    });
  });

  it("aggregates the column and line metrics of a bar-line chart independently", () => {
    const barLine = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "barLine",
        props: { aggregation: "sum", barColor: "#2f62dc", lineColor: "#ff7417", showLegend: true, smooth: false },
        binding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "month" },
            barMeasure: { fieldKey: "revenue", aggregation: "sum" },
            lineMeasure: { fieldKey: "orders", aggregation: "avg" },
          },
        },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(barLine)).toEqual({
      groupBy: ["month"],
      measures: [
        { fieldKey: "revenue", aggregation: "sum" },
        { fieldKey: "orders", aggregation: "avg" },
      ],
    });
  });

  it("deduplicates a metric reused by the column and line of a bar-line chart", () => {
    const barLine = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "barLine",
        props: { aggregation: "sum", barColor: "#2f62dc", lineColor: "#ff7417", showLegend: true, smooth: false },
        binding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "psCProEname" },
            barMeasure: { fieldKey: "saleGrossProfit" },
            lineMeasure: { fieldKey: "saleGrossProfit" },
          },
        },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(barLine)).toEqual({
      groupBy: ["psCProEname"],
      measures: [{ fieldKey: "saleGrossProfit", aggregation: "sum" }],
    });
  });

  it("requests the source fields of a bound calculated metric rather than its synthetic key", () => {
    const chart = DashboardSchema.parse({
      ...baseDashboard,
      components: [{
        id: "chart-1",
        type: "bar",
        props: { aggregation: "sum", color: "#1677ff", showLegend: true },
        binding: {
          datasetId: "sales",
          slots: { dimension: { fieldKey: "psCProEname" }, measure: { fieldKey: "calculated-margin" } },
          calculatedMetrics: [{
            id: "calculated-margin",
            name: "毛利率",
            format: "percent",
            decimals: 2,
            divideByZero: "dash",
            tokens: [
              { kind: "metric", reference: { fieldKey: "saleGrossProfit", aggregation: "sum" } },
              { kind: "operator", value: "/" },
              { kind: "metric", reference: { fieldKey: "salesAmount", aggregation: "sum" } },
            ],
          }],
        },
      }],
    }).components[0]!;

    expect(buildDatasetAggregation(chart)).toEqual({
      groupBy: ["psCProEname"],
      measures: [
        { fieldKey: "saleGrossProfit", aggregation: "sum" },
        { fieldKey: "salesAmount", aggregation: "sum" },
      ],
    });
  });
});
