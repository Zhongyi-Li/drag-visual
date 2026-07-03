import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "./app/AppProviders.js";
import { bootstrapApplication } from "./app/bootstrap.js";
import { router } from "./app/router.js";

const renderApplication = (): void => {
  const root = document.getElementById("root");
  if (root === null) throw new Error("Application root is missing");

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </React.StrictMode>,
  );
};

void bootstrapApplication({
  useMocks: import.meta.env.VITE_USE_MOCKS,
  loadMockWorker: () => import("./mocks/browser.js"),
  render: renderApplication,
}).catch((error: unknown) => {
  console.error("Failed to start the application", error);
});
