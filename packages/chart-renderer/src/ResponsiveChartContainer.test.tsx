// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { expect, it } from "vitest";

import { ResponsiveChartContainer } from "./ResponsiveChartContainer.js";

it("passes the available flex space through without applying visual scaling", () => {
  const { container } = render(
    <ResponsiveChartContainer>
      <div>图表内容</div>
    </ResponsiveChartContainer>,
  );
  const responsiveRoot = container.firstElementChild as HTMLElement;
  const content = responsiveRoot.firstElementChild as HTMLElement;

  expect(responsiveRoot.style.flex).toBe("1 1 auto");
  expect(content.style.display).toBe("flex");
  expect(content.style.width).toBe("100%");
  expect(content.style.transform).toBe("");
});
