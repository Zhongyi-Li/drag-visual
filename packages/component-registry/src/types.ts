import type { ComponentInstance, ComponentType, DataBinding } from "@drag-visual/contracts";
import type { z } from "zod";

export type FieldDataType = "string" | "number" | "date" | "boolean";

export interface ComponentDataSlot {
  readonly key: string;
  readonly title: string;
  readonly acceptedTypes: readonly FieldDataType[];
  readonly required: boolean;
  readonly multiple: boolean;
}

export interface DefaultComponentLayout {
  readonly w: number;
  readonly h: number;
}

export interface BindingValidationResult {
  readonly valid: boolean;
  readonly messages: readonly string[];
}

export interface ComponentDefinition<Props extends ComponentInstance["props"] = ComponentInstance["props"]> {
  readonly type: ComponentType;
  readonly title: string;
  readonly category: string;
  readonly defaultLayout: DefaultComponentLayout;
  readonly createDefaults: () => Props;
  readonly dataSlots: readonly ComponentDataSlot[];
  readonly propsSchema: z.ZodType<Props>;
  readonly validateBinding?: (binding: DataBinding | undefined) => BindingValidationResult;
}
