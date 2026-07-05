import { barDefinition } from "./definitions/bar.js";
import { kpiDefinition } from "./definitions/kpi.js";
import { lineDefinition } from "./definitions/line.js";
import { pieDefinition } from "./definitions/pie.js";
import { tableDefinition } from "./definitions/table.js";
import { textDefinition } from "./definitions/text.js";
import { ComponentRegistry } from "./registry.js";

export { barDefinition } from "./definitions/bar.js";
export { kpiDefinition } from "./definitions/kpi.js";
export { lineDefinition } from "./definitions/line.js";
export { pieDefinition } from "./definitions/pie.js";
export { tableDefinition } from "./definitions/table.js";
export { textDefinition } from "./definitions/text.js";
export {
  ComponentRegistry,
  ComponentRegistryError,
  type ComponentRegistryErrorCode,
} from "./registry.js";
export type {
  BindingValidationResult,
  ComponentDataSlot,
  ComponentDefinition,
  DefaultComponentLayout,
  FieldDataType,
} from "./types.js";

export const createDefaultRegistry = (): ComponentRegistry =>
  new ComponentRegistry()
    .register(barDefinition)
    .register(lineDefinition)
    .register(pieDefinition)
    .register(kpiDefinition)
    .register(tableDefinition)
    .register(textDefinition);
