export type MockScenario =
  | "normal"
  | "dataset-timeout"
  | "schema-v2"
  | "revision-conflict"
  | "publish-failure";

const scenarios = new Set<MockScenario>([
  "normal",
  "dataset-timeout",
  "schema-v2",
  "revision-conflict",
  "publish-failure",
]);

export class MockScenarioError extends Error {
  readonly code = "MOCK_SCENARIO_INVALID";

  constructor() {
    super("Mock scenario is invalid");
    this.name = "MockScenarioError";
  }
}

let scenario: MockScenario = "normal";

export const getMockScenario = (): MockScenario => scenario;

export const setMockScenario = (value: string): void => {
  if (!scenarios.has(value as MockScenario)) throw new MockScenarioError();
  scenario = value as MockScenario;
};

export const resetMockScenario = (): void => {
  scenario = "normal";
};
