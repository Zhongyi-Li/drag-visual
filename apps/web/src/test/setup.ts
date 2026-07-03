import { afterAll, afterEach, beforeAll } from "vitest";

import { resetMockStore } from "../mocks/handlers.js";
import { server } from "../mocks/server.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetMockStore();
});
afterAll(() => server.close());
