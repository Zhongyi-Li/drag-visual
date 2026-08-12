import type { ComponentInstance } from "@drag-visual/contracts";

interface Props {
  readonly component: ComponentInstance;
}

const displayEntries = (component: ComponentInstance) => {
  const annotations = component.displayAnnotations;
  if (annotations === undefined) return [];
  return annotations.annotations.length > 0
    ? annotations.annotations.filter((entry) => entry.text.trim().length > 0)
    : annotations.unitText.trim().length > 0
      ? [{ position: "topRight" as const, text: annotations.unitText }]
      : [];
};

/** Left-top supporting copy belongs to the chart heading, above the legend. */
export const chartTopLeftHint = (component: ComponentInstance): string | undefined => displayEntries(component).find((entry) => entry.position === "topLeft")?.text;

export const ChartDisplayHints = ({ component }: Props) => {
  const entries = displayEntries(component).filter((entry) => entry.position !== "topLeft");
  if (entries.length === 0) return null;
  const positionStyle = {
    // topLeft entries are filtered out above and rendered in the heading.
    topLeft: { top: 4, left: 4 },
    topRight: { top: 4, right: 4 },
    bottomRight: { bottom: 4, right: 4 },
    bottomLeft: { bottom: 4, left: 4 },
  } as const;
  return <div aria-label="图表辅助说明" style={{ position: "absolute", zIndex: 2, inset: 0, pointerEvents: "none" }}>
    {entries.map((entry) => <span key={entry.position} data-position={entry.position} style={{ position: "absolute", ...positionStyle[entry.position], maxWidth: "52%", overflow: "hidden", color: "#64748b", fontSize: 12, fontWeight: 500, lineHeight: 1.5, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.text}</span>)}
  </div>;
};
