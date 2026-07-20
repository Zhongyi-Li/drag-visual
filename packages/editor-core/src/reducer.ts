import {
  DashboardSchema,
  type ComponentInstance,
  type Dashboard,
  type DataBinding,
  type GridItem,
} from "@drag-visual/contracts";

import {
  EditorCommandError,
  type EditorCommand,
} from "./commands.js";

const fail = (
  code: ConstructorParameters<typeof EditorCommandError>[0],
  message: string,
): never => {
  throw new EditorCommandError(code, message);
};

export const validateDashboardSnapshot = (candidate: unknown): Dashboard => {
  try {
    return DashboardSchema.parse(candidate);
  } catch (cause) {
    throw new EditorCommandError(
      "INVALID_DASHBOARD",
      "Command would produce an invalid dashboard",
      cause,
    );
  }
};

const hasComponent = (dashboard: Dashboard, componentId: string): boolean =>
  dashboard.components.some((component) => component.id === componentId);

const replaceComponent = (
  dashboard: Dashboard,
  componentId: string,
  update: (component: ComponentInstance) => ComponentInstance,
): ComponentInstance[] => {
  if (!hasComponent(dashboard, componentId)) {
    return fail(
      "MISSING_COMPONENT",
      `Component does not exist: ${componentId}`,
    );
  }
  return dashboard.components.map((component) =>
    component.id === componentId ? update(component) : component,
  );
};

const withoutBinding = (component: ComponentInstance): ComponentInstance => {
  const { binding: _binding, ...rest } = component;
  return rest;
};

const withBinding = (
  component: ComponentInstance,
  binding: DataBinding | undefined,
): ComponentInstance =>
  binding === undefined
    ? withoutBinding(component)
    : { ...component, binding };

const addComponent = (
  dashboard: Dashboard,
  component: ComponentInstance,
  layout: GridItem,
): Dashboard => {
  if (component.id !== layout.i) {
    return fail(
      "ID_MISMATCH",
      `Component ID ${component.id} does not match layout ID ${layout.i}`,
    );
  }
  if (
    hasComponent(dashboard, component.id) ||
    dashboard.layout.some((item) => item.i === layout.i)
  ) {
    return fail("DUPLICATE_ID", `Dashboard ID already exists: ${component.id}`);
  }
  return validateDashboardSnapshot({
    ...dashboard,
    components: [...dashboard.components, component],
    layout: [...dashboard.layout, layout],
  });
};

const duplicateComponent = (
  dashboard: Dashboard,
  sourceId: string,
  newComponentId: string,
  layout: GridItem,
): Dashboard => {
  const source = dashboard.components.find(
    (component) => component.id === sourceId,
  );
  if (!source) {
    return fail("MISSING_COMPONENT", `Component does not exist: ${sourceId}`);
  }
  if (newComponentId !== layout.i) {
    return fail(
      "ID_MISMATCH",
      `Component ID ${newComponentId} does not match layout ID ${layout.i}`,
    );
  }
  if (
    hasComponent(dashboard, newComponentId) ||
    dashboard.layout.some((item) => item.i === newComponentId)
  ) {
    return fail("DUPLICATE_ID", `Dashboard ID already exists: ${newComponentId}`);
  }
  return validateDashboardSnapshot({
    ...dashboard,
    components: [...dashboard.components, { ...source, id: newComponentId }],
    layout: [...dashboard.layout, layout],
  });
};

const changeLayout = (
  dashboard: Dashboard,
  updates: readonly GridItem[],
): Dashboard => {
  if (updates.length === 0) {
    return fail("EMPTY_LAYOUT_UPDATE", "Layout change requires at least one update");
  }
  const updatesById = new Map<string, GridItem>();
  for (const update of updates) {
    if (updatesById.has(update.i)) {
      return fail(
        "DUPLICATE_UPDATE_ID",
        `Layout update ID occurs more than once: ${update.i}`,
      );
    }
    if (!hasComponent(dashboard, update.i)) {
      return fail("MISSING_COMPONENT", `Component does not exist: ${update.i}`);
    }
    updatesById.set(update.i, update);
  }
  return validateDashboardSnapshot({
    ...dashboard,
    layout: dashboard.layout.map((item) => updatesById.get(item.i) ?? item),
  });
};

const assertNever = (command: never): never =>
  fail(
    "INVALID_COMMAND",
    `Unknown editor command: ${String((command as { type?: unknown }).type)}`,
  );

const applyKnownCommand = (
  dashboard: Dashboard,
  command: EditorCommand,
): Dashboard => {
  switch (command.type) {
    case "component.add":
      return addComponent(dashboard, command.component, command.layout);
    case "component.remove": {
      if (!hasComponent(dashboard, command.componentId)) {
        return fail(
          "MISSING_COMPONENT",
          `Component does not exist: ${command.componentId}`,
        );
      }
      return validateDashboardSnapshot({
        ...dashboard,
        components: dashboard.components.filter(
          (component) => component.id !== command.componentId,
        ),
        layout: dashboard.layout.filter((item) => item.i !== command.componentId),
      });
    }
    case "component.duplicate":
      return duplicateComponent(
        dashboard,
        command.sourceId,
        command.newComponentId,
        command.layout,
      );
    case "layout.change":
      return changeLayout(dashboard, command.updates);
    case "component.props.update":
      return validateDashboardSnapshot({
        ...dashboard,
        components: replaceComponent(
          dashboard,
          command.componentId,
          (component) => ({ ...component, props: command.nextProps }),
        ),
      });
    case "component.title.update":
      return validateDashboardSnapshot({
        ...dashboard,
        components: replaceComponent(
          dashboard,
          command.componentId,
          (component) => ({ ...component, title: command.nextTitle }),
        ),
      });
    case "component.binding.update":
      return validateDashboardSnapshot({
        ...dashboard,
        components: replaceComponent(
          dashboard,
          command.componentId,
          (component) => withBinding(component, command.nextBinding),
        ),
      });
    case "dashboard.theme.update":
      return validateDashboardSnapshot({
        ...dashboard,
        theme: command.nextTheme,
      });
    case "dashboard.dataset.upsert": {
      const nextDataset = command.dataset;
      const exists = dashboard.datasets.some(
        (dataset) => dataset.datasetId === nextDataset.datasetId,
      );
      return validateDashboardSnapshot({
        ...dashboard,
        datasets: exists
          ? dashboard.datasets.map((dataset) =>
              dataset.datasetId === nextDataset.datasetId ? nextDataset : dataset,
            )
          : [...dashboard.datasets, nextDataset],
      });
    }
    default:
      return assertNever(command);
  }
};

export const applyCommand = (
  dashboard: Dashboard,
  command: EditorCommand,
): Dashboard => {
  try {
    return applyKnownCommand(dashboard, command);
  } catch (cause) {
    if (cause instanceof EditorCommandError) throw cause;
    throw new EditorCommandError(
      "INVALID_COMMAND",
      "Editor command is malformed",
      cause,
    );
  }
};
