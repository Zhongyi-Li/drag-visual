import { describe, expect, it } from "vitest";

import { getMockScenario, resetMockScenario, setMockScenario } from "./scenarios.js";

describe("mock scenarios", () => {
  it("defaults to normal and resets to normal", () => {
    resetMockScenario();
    expect(getMockScenario()).toBe("normal");

    setMockScenario("dataset-timeout");
    resetMockScenario();

    expect(getMockScenario()).toBe("normal");
  });

  it.each(["normal", "dataset-timeout", "schema-v2", "revision-conflict", "publish-failure"])(
    "accepts the closed scenario %s",
    (scenario) => {
      setMockScenario(scenario);
      expect(getMockScenario()).toBe(scenario);
    },
  );

  it("rejects unknown scenarios with a stable code without changing state", () => {
    setMockScenario("schema-v2");

    expect(() => setMockScenario("unknown")).toThrowError(
      expect.objectContaining({ code: "MOCK_SCENARIO_INVALID" }),
    );
    expect(getMockScenario()).toBe("schema-v2");
  });
});
