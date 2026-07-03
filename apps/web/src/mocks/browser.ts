import { setupWorker } from "msw/browser";

import { handlers } from "./handlers.js";
import { MOCK_SERVICE_WORKER_URL } from "./worker-config.js";

export const worker = setupWorker(...handlers);

export const startMockWorker = () => worker.start({
  serviceWorker: { url: MOCK_SERVICE_WORKER_URL },
});
