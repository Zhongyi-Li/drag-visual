// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { DataCenter } from "./DataCenter.js";

describe("DataCenter", () => {
  it("lists datasets and previews the selected schema and rows", async () => {
    render(<MemoryRouter><AppProviders><DataCenter /></AppProviders></MemoryRouter>);

    expect((await screen.findAllByText("销售数据")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "销售数据" })[0]!);

    expect((await screen.findAllByText("收入")).length).toBeGreaterThan(0);
    expect(await screen.findByText("120000")).toBeInTheDocument();
    expect(screen.getByText("可用于图表")).toBeInTheDocument();
  });
});
