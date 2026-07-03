import { describe, expect, it } from "vitest";

import {
  ComponentRegistry,
  ComponentRegistryError,
  barDefinition,
  createDefaultRegistry,
} from "./index.js";

describe("component registry", () => {
  it("exposes the Chinese bar definition and validates its props", () => {
    expect(barDefinition.type).toBe("bar");
    expect(barDefinition.title).toBe("柱图");
    expect(barDefinition.category).toBe("柱/条图");
    expect(barDefinition.defaultLayout).toEqual({ w: 6, h: 5 });
    expect(barDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", acceptedTypes: ["string", "date"], required: false }),
      expect.objectContaining({ key: "measure", acceptedTypes: ["number"], required: true }),
    ]);
    expect(barDefinition.propsSchema.parse({ color: "#1677ff", showLegend: true })).toEqual({
      color: "#1677ff",
      showLegend: true,
    });
    expect(barDefinition.propsSchema.safeParse({ color: "blue", showLegend: true }).success).toBe(false);
  });

  it("requires exactly one measure binding", () => {
    const binding = (measure: unknown) => ({
      datasetId: "sales",
      slots: { measure },
    });
    expect(barDefinition.validateBinding?.(undefined).valid).toBe(false);
    expect(barDefinition.validateBinding?.(binding([]) as never).valid).toBe(false);
    expect(barDefinition.validateBinding?.(binding([
      { fieldKey: "revenue" },
      { fieldKey: "profit" },
    ]) as never).valid).toBe(false);
    expect(barDefinition.validateBinding?.(binding({ fieldKey: "revenue" }) as never).valid).toBe(true);
    expect(barDefinition.validateBinding?.(binding([{ fieldKey: "revenue" }]) as never).valid).toBe(true);
  });

  it("creates fresh deterministic defaults without aliases", () => {
    const first = barDefinition.createDefaults();
    const second = barDefinition.createDefaults();
    expect(first).toEqual({ color: "#1677ff", showLegend: true });
    expect(first).not.toBe(second);
  });

  it("reports stable missing and duplicate registration errors", () => {
    const registry = new ComponentRegistry();
    expect(() => registry.get("bar")).toThrowError(
      expect.objectContaining({ code: "DEFINITION_NOT_FOUND" }),
    );
    registry.register(barDefinition);
    expect(() => registry.register(barDefinition)).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_DEFINITION" }),
    );
  });

  it("returns immutable registry errors", () => {
    const registry = new ComponentRegistry();
    let captured: unknown;
    try {
      registry.get("bar");
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(ComponentRegistryError);
    expect(Object.isFrozen(captured)).toBe(true);
    const registryError = captured as ComponentRegistryError;
    expect(() => {
      (registryError as { code: string }).code = "DUPLICATE_DEFINITION";
    }).toThrow();
    expect(() => {
      (registryError as { message: string }).message = "changed";
    }).toThrow();
    expect(registryError.code).toBe("DEFINITION_NOT_FOUND");
    expect(registryError.message).toBe("Component definition is not registered: bar");
  });

  it("does not expose mutable registered definitions", () => {
    const definition = createDefaultRegistry().get("bar");
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.dataSlots)).toBe(true);
    expect(() => {
      (definition.dataSlots as unknown as { key: string }[])[0]!.key = "changed";
    }).toThrow();
    expect(createDefaultRegistry().get("bar").dataSlots[0]!.key).toBe("dimension");
  });
});
