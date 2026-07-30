import type { CSSProperties, ReactNode } from "react";

interface ResponsiveChartContainerProps {
  readonly children: ReactNode;
}

/**
 * Gives every renderer the same flex sizing contract in the editor and viewer.
 * Each chart keeps its native typography and adapts to the actual container;
 * chart-specific layouts, rather than a global scale threshold, decide how
 * their content compacts when space is tight.
 */
export const ResponsiveChartContainer = ({ children }: ResponsiveChartContainerProps) => {
  const contentStyle: CSSProperties = {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    width: "100%",
  };

  return (
    <div
      style={{ flex: "1 1 auto", height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden", width: "100%" }}
    >
      <div style={contentStyle}>{children}</div>
    </div>
  );
};
