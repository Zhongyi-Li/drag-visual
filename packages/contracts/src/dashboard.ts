import { z } from "zod";

import { safeJsonRecord, safeRecord } from "./safe-record.js";

const nonEmptyString = z.string().min(1);
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const ComponentType = z.enum([
  "bar",
  "line",
  "pie",
  "kpi",
  "table",
  "text",
]);

export type ComponentType = z.infer<typeof ComponentType>;

export const GridItem = z.object({
  i: nonEmptyString,
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
}).strict();

export type GridItem = z.infer<typeof GridItem>;

export const FieldBinding = z.object({
  fieldKey: nonEmptyString,
}).strict();

export type FieldBinding = z.infer<typeof FieldBinding>;

export const DataBinding = z.object({
  datasetId: nonEmptyString,
  slots: safeRecord(z.union([FieldBinding, z.array(FieldBinding)])),
  sort: z
    .object({
      fieldKey: nonEmptyString,
      direction: z.enum(["asc", "desc"]),
    })
    .strict()
    .optional(),
  limit: z.number().int().positive().max(10_000).optional(),
}).strict();

export type DataBinding = z.infer<typeof DataBinding>;

export const ComponentInstance = z.object({
  id: nonEmptyString,
  type: ComponentType,
  title: z.string().optional(),
  props: safeJsonRecord,
  binding: DataBinding.optional(),
}).strict();

export type ComponentInstance = z.infer<typeof ComponentInstance>;

export const DashboardSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    name: z.string().min(1).max(100),
    theme: z
      .object({
        primaryColor: hexColor,
        backgroundColor: hexColor,
      })
      .strict(),
    layout: z.array(GridItem).max(100),
    components: z.array(ComponentInstance).max(100),
    datasets: z.array(
      z.object({
        datasetId: nonEmptyString,
        schemaVersion: nonEmptyString,
        parameters: safeJsonRecord,
      }).strict(),
    ).max(20),
    revision: z.number().int().positive(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((dashboard, context) => {
    const datasetIds = new Set<string>();
    dashboard.datasets.forEach((dataset, index) => {
      if (datasetIds.has(dataset.datasetId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate dataset ID: ${dataset.datasetId}`,
          path: ["datasets", index, "datasetId"],
        });
      }
      datasetIds.add(dataset.datasetId);
    });

    const componentIds = new Set<string>();
    dashboard.components.forEach((component, index) => {
      if (componentIds.has(component.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate component ID: ${component.id}`,
          path: ["components", index, "id"],
        });
      }
      componentIds.add(component.id);

      if (component.binding && !datasetIds.has(component.binding.datasetId)) {
        context.addIssue({
          code: "custom",
          message: `Component binding references undeclared dataset: ${component.binding.datasetId}`,
          path: ["components", index, "binding", "datasetId"],
        });
      }
    });

    const layoutIds = new Set<string>();
    dashboard.layout.forEach((item, index) => {
      if (layoutIds.has(item.i)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate layout ID: ${item.i}`,
          path: ["layout", index, "i"],
        });
      }
      layoutIds.add(item.i);

      if (!componentIds.has(item.i)) {
        context.addIssue({
          code: "custom",
          message: `Layout item references missing component: ${item.i}`,
          path: ["layout", index, "i"],
        });
      }
    });

    dashboard.components.forEach((component, index) => {
      if (!layoutIds.has(component.id)) {
        context.addIssue({
          code: "custom",
          message: `Component has no matching layout item: ${component.id}`,
          path: ["components", index, "id"],
        });
      }
    });
  });

/** @deprecated Prefer DashboardSchema for runtime validation. */
export const Dashboard = DashboardSchema;

export type Dashboard = z.infer<typeof DashboardSchema>;
