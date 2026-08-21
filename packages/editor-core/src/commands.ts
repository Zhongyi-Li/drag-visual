import type {
  ComponentInstance,
  ComponentDisplayAnnotations,
  ComponentInteraction,
  Dashboard,
  DataBinding,
  GridItem,
} from "@drag-visual/contracts";

export interface ComponentAddCommand {
  readonly type: "component.add";
  readonly component: ComponentInstance;
  readonly layout: GridItem;
  /** Optional simultaneous layout updates for existing components. */
  readonly layoutUpdates?: readonly GridItem[];
}

export interface ComponentRemoveCommand {
  readonly type: "component.remove";
  readonly componentId: string;
}

export interface ComponentDuplicateCommand {
  readonly type: "component.duplicate";
  readonly sourceId: string;
  readonly newComponentId: string;
  readonly layout: GridItem;
}

export interface LayoutChangeCommand {
  readonly type: "layout.change";
  readonly updates: readonly [GridItem, ...GridItem[]];
}

/** Replaces the complete props record; patch merging is intentionally unsupported. */
export interface ComponentPropsUpdateCommand {
  readonly type: "component.props.update";
  readonly componentId: string;
  readonly nextProps: ComponentInstance["props"];
}

export interface ComponentTitleUpdateCommand {
  readonly type: "component.title.update";
  readonly componentId: string;
  readonly nextTitle: string;
}

export interface ComponentSubtitleUpdateCommand {
  readonly type: "component.subtitle.update";
  readonly componentId: string;
  readonly nextSubtitle: string;
}

export interface ComponentDisplayAnnotationsUpdateCommand {
  readonly type: "component.display-annotations.update";
  readonly componentId: string;
  readonly nextDisplayAnnotations: ComponentDisplayAnnotations | undefined;
}

export interface ComponentInteractionUpdateCommand {
  readonly type: "component.interaction.update";
  readonly componentId: string;
  readonly nextInteraction: ComponentInteraction | undefined;
}

export interface ComponentBindingUpdateCommand {
  readonly type: "component.binding.update";
  readonly componentId: string;
  readonly nextBinding: DataBinding | undefined;
}

/** Replaces the complete dashboard theme. */
export interface DashboardThemeUpdateCommand {
  readonly type: "dashboard.theme.update";
  readonly nextTheme: Dashboard["theme"];
}

export interface DashboardNameUpdateCommand {
  readonly type: "dashboard.name.update";
  readonly nextName: string;
}

export interface DashboardDatasetUpsertCommand {
  readonly type: "dashboard.dataset.upsert";
  readonly dataset: Dashboard["datasets"][number];
}

export type EditorCommand =
  | ComponentAddCommand
  | ComponentRemoveCommand
  | ComponentDuplicateCommand
  | LayoutChangeCommand
  | ComponentPropsUpdateCommand
  | ComponentTitleUpdateCommand
  | ComponentSubtitleUpdateCommand
  | ComponentDisplayAnnotationsUpdateCommand
  | ComponentInteractionUpdateCommand
  | ComponentBindingUpdateCommand
  | DashboardThemeUpdateCommand
  | DashboardNameUpdateCommand
  | DashboardDatasetUpsertCommand;

export type EditorCommandErrorCode =
  | "INVALID_COMMAND"
  | "MISSING_COMPONENT"
  | "DUPLICATE_ID"
  | "ID_MISMATCH"
  | "DUPLICATE_UPDATE_ID"
  | "EMPTY_LAYOUT_UPDATE"
  | "INVALID_DASHBOARD";

export class EditorCommandError extends Error {
  readonly code: EditorCommandErrorCode;

  constructor(
    code: EditorCommandErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "EditorCommandError";
    this.code = code;
  }
}
