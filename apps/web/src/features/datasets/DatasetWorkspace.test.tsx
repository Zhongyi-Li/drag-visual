// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { salesQueryResultFixture } from "../../mocks/fixtures.js";
import { server } from "../../mocks/server.js";
import { DatasetWorkspace } from "./DatasetWorkspace.js";

describe("DatasetWorkspace", () => {
  it("loads a selected schema, submits parameters, and previews the response", async () => {
    let requestBody: unknown;
    server.use(http.post("http://localhost/datasets/sales/query", async ({ request }) => {
      requestBody = await request.json();
      return HttpResponse.json(salesQueryResultFixture);
    }));
    render(<AppProviders><DatasetWorkspace /></AppProviders>);

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));
    fireEvent.click(await screen.findByText("销售数据"));

    expect(await screen.findByText("收入")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "年份" }), { target: { value: "2026" } });
    const dateInput = screen.getByRole("textbox", { name: "开始日期" });
    fireEvent.change(dateInput, { target: { value: "2026-01-01" } });
    fireEvent.keyDown(dateInput, { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /查.*询/ }));

    expect(await screen.findByText("120000")).toBeInTheDocument();
    expect(requestBody).toEqual({ parameters: { year: 2026, fromDate: "2026-01-01" } });
  });
});
