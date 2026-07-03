import { barDefinition } from "./definitions/bar.js";
import { ComponentRegistry } from "./registry.js";

export { barDefinition } from "./definitions/bar.js";
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
  new ComponentRegistry().register(barDefinition);
