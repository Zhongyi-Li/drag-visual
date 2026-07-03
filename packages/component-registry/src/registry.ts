import type { ComponentType } from "@drag-visual/contracts";

import type { ComponentDefinition } from "./types.js";

export type ComponentRegistryErrorCode =
  | "DEFINITION_NOT_FOUND"
  | "DUPLICATE_DEFINITION";

export class ComponentRegistryError extends Error {
  readonly code: ComponentRegistryErrorCode;

  constructor(code: ComponentRegistryErrorCode, message: string) {
    super(message);
    this.name = "ComponentRegistryError";
    this.code = code;
    Object.freeze(this);
  }
}

const protectDefinition = (definition: ComponentDefinition): ComponentDefinition => {
  const dataSlots = Object.freeze(definition.dataSlots.map((slot) => Object.freeze({
    ...slot,
    acceptedTypes: Object.freeze([...slot.acceptedTypes]),
  })));
  return Object.freeze({
    ...definition,
    defaultLayout: Object.freeze({ ...definition.defaultLayout }),
    dataSlots,
  });
};

export class ComponentRegistry {
  readonly #definitions = new Map<ComponentType, ComponentDefinition>();

  register(definition: ComponentDefinition): this {
    if (this.#definitions.has(definition.type)) {
      throw new ComponentRegistryError(
        "DUPLICATE_DEFINITION",
        `Component definition is already registered: ${definition.type}`,
      );
    }
    this.#definitions.set(definition.type, protectDefinition(definition));
    return this;
  }

  get(type: ComponentType): ComponentDefinition {
    const definition = this.#definitions.get(type);
    if (definition === undefined) {
      throw new ComponentRegistryError(
        "DEFINITION_NOT_FOUND",
        `Component definition is not registered: ${type}`,
      );
    }
    return definition;
  }

  list(): readonly ComponentDefinition[] {
    return Object.freeze([...this.#definitions.values()]);
  }
}
