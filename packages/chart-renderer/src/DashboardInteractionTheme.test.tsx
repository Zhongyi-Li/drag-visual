// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ConfigProvider, theme } from "antd";
import { expect, it } from "vitest";
import { DashboardInteractionTheme } from "./DashboardInteractionTheme.js";
const Probe = ({ label }: { label: string }) => { const { token } = theme.useToken(); return <span data-testid={label}>{token.colorPrimary}/{token.colorLink}</span>; };
it("updates dashboard interaction colors without changing surrounding application controls", () => {
  const view = (primaryColor: string) => <ConfigProvider theme={{ token: { colorPrimary: "#1677ff", colorLink: "#1677ff" } }}><Probe label="editor" /><DashboardInteractionTheme theme={{ primaryColor, backgroundColor: "#fff" }}><Probe label="dashboard" /></DashboardInteractionTheme></ConfigProvider>;
  const { rerender } = render(view("#9254de"));
  expect(screen.getByTestId("dashboard").textContent).toBe("#9254de/#9254de");
  expect(screen.getByTestId("editor").textContent).toBe("#1677ff/#1677ff");
  rerender(view("#36c99a"));
  expect(screen.getByTestId("dashboard").textContent).toBe("#36c99a/#36c99a");
  expect(screen.getByTestId("editor").textContent).toBe("#1677ff/#1677ff");
});

it("uses dark surfaces and readable text only inside a dark dashboard", () => {
  const Surface = ({ label }: { label: string }) => {
    const { token } = theme.useToken();
    return <span data-testid={label}>{token.colorBgContainer}/{token.colorText}</span>;
  };
  const view = (mode: "light" | "dark") => <ConfigProvider><Surface label="outside" /><DashboardInteractionTheme theme={{ primaryColor: "#38bdf8", backgroundColor: "#08152f", mode }}><Surface label="inside" /></DashboardInteractionTheme></ConfigProvider>;
  const { rerender } = render(view("dark"));
  expect(screen.getByTestId("inside").textContent).toBe("#102344/#dbe7f5");
  expect(screen.getByTestId("outside").textContent).not.toContain("#102344");
  rerender(view("light"));
  expect(screen.getByTestId("inside").textContent).not.toContain("#102344");
});
