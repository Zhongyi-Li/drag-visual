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
const SCENARIO_STORAGE_KEY = "drag-visual:mock-scenario";

export class MockScenarioError extends Error {
  readonly code = "MOCK_SCENARIO_INVALID";

  constructor() {
    super("Mock scenario is invalid");
    this.name = "MockScenarioError";
  }
}

let scenario: MockScenario = "normal";

const getStoredScenario = (): MockScenario | null => {
  try {
    const stored = globalThis.localStorage?.getItem(SCENARIO_STORAGE_KEY);
    return scenarios.has(stored as MockScenario) ? stored as MockScenario : null;
  } catch {
    return null;
  }
};

const persistScenario = (value: MockScenario): void => {
  try {
    globalThis.localStorage?.setItem(SCENARIO_STORAGE_KEY, value);
  } catch {
    // In-memory state is enough when storage is unavailable.
  }
};

const clearStoredScenario = (): void => {
  try {
    globalThis.localStorage?.removeItem(SCENARIO_STORAGE_KEY);
  } catch {
    // In-memory state is enough when storage is unavailable.
  }
};

export const getMockScenario = (): MockScenario => getStoredScenario() ?? scenario;

export const setMockScenario = (value: string): void => {
  if (!scenarios.has(value as MockScenario)) throw new MockScenarioError();
  scenario = value as MockScenario;
  persistScenario(scenario);
};

export const resetMockScenario = (): void => {
  scenario = "normal";
  clearStoredScenario();
};
