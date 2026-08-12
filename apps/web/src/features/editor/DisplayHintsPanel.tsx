import { ComponentDisplayAnnotations } from "@drag-visual/contracts";
import { Input, Popover, Typography } from "antd";
import { useEffect, useState } from "react";
import { useStore } from "zustand";

import type { EditorStore } from "./store/editorStore.js";

type AnnotationPosition = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";
type AnnotationEntry = { readonly position: AnnotationPosition; readonly text: string };

interface Props {
  readonly component: {
    readonly id: string;
    readonly subtitle?: string | undefined;
    readonly displayAnnotations?: {
      readonly annotations: readonly AnnotationEntry[];
      readonly unitText: string;
      readonly series?: { readonly mode: "auto" | "custom" | "hidden"; readonly text: string } | undefined;
      readonly unit?: { readonly mode: "auto" | "custom" | "hidden"; readonly text: string } | undefined;
    } | undefined;
  };
  readonly store: EditorStore;
}

const defaultAnnotations = (): ComponentDisplayAnnotations => ({ annotations: [], unitText: "" });

const positions: readonly { readonly value: AnnotationPosition; readonly label: string }[] = [
  { value: "topLeft", label: "左上" },
  { value: "topRight", label: "右上" },
  { value: "bottomRight", label: "右下" },
  { value: "bottomLeft", label: "左下" },
];

const positionLabel = (position: AnnotationPosition) => positions.find((item) => item.value === position)?.label ?? "说明";

const PositionIcon = ({ position }: { readonly position: AnnotationPosition }) => <span className={`display-hints-panel__position-icon display-hints-panel__position-icon--${position}`} aria-hidden="true"><i /></span>;

export const DisplayHintsPanel = ({ component, store }: Props) => {
  const current = useStore(store, (state) => state.history.present.components.find((candidate) => candidate.id === component.id) ?? component);
  const annotations = ComponentDisplayAnnotations.parse(current.displayAnnotations ?? defaultAnnotations());
  const sourceEntries = annotations.annotations.length > 0
    ? annotations.annotations
    : annotations.unitText.trim().length > 0
      ? [{ position: "topLeft" as const, text: annotations.unitText }]
      : [];
  const entries = sourceEntries.filter((entry) => entry.text.trim().length > 0);
  const entriesKey = entries.map((entry) => `${entry.position}:${entry.text}`).join("|");
  const [drafts, setDrafts] = useState<Record<AnnotationPosition, string>>({ topLeft: "", topRight: "", bottomRight: "", bottomLeft: "" });

  useEffect(() => {
    setDrafts({
      topLeft: entries.find((entry) => entry.position === "topLeft")?.text ?? "",
      topRight: entries.find((entry) => entry.position === "topRight")?.text ?? "",
      bottomRight: entries.find((entry) => entry.position === "bottomRight")?.text ?? "",
      bottomLeft: entries.find((entry) => entry.position === "bottomLeft")?.text ?? "",
    });
  }, [entriesKey]);

  const update = (next: readonly AnnotationEntry[]) => store.getState().dispatch({
    type: "component.display-annotations.update",
    componentId: component.id,
    nextDisplayAnnotations: { ...annotations, annotations: [...next], unitText: "" },
  });
  const commitEntry = (position: AnnotationPosition) => {
    const text = drafts[position] ?? "";
    const next = entries.filter((entry) => entry.position !== position);
    if (text.trim().length > 0) next.push({ position, text });
    update(next);
  };
  const moveEntry = (from: AnnotationPosition, to: AnnotationPosition) => {
    const text = drafts[from] ?? entries.find((entry) => entry.position === from)?.text ?? "";
    if (from === to || text.trim().length === 0 || entries.some((entry) => entry.position === to)) return;
    setDrafts((previous) => ({ ...previous, [from]: "", [to]: text }));
    update(entries.map((entry) => entry.position === from ? { position: to, text } : entry));
  };
  const positionPicker = (position: AnnotationPosition) => <div className="display-hints-panel__position-picker" role="group" aria-label="选择说明位置">
    {positions.map((option) => <button
      type="button"
      key={option.value}
      className={option.value === position ? "is-selected" : ""}
      aria-label={`移动到${option.label}`}
      disabled={option.value !== position && entries.some((entry) => entry.position === option.value)}
      onClick={() => moveEntry(position, option.value)}
    >
      <PositionIcon position={option.value} />
      <span>{option.label}</span>
    </button>)}
  </div>;
  const renderEntry = (position: AnnotationPosition, value: string, isDraft = false) => <div className="display-hints-panel__entry" key={position}>
    <Input
      aria-label={`${positionLabel(position)}说明文本`}
      allowClear={!isDraft}
      maxLength={80}
      placeholder={`输入${positionLabel(position)}说明`}
      value={value}
      onChange={(event) => setDrafts((previous) => ({ ...previous, [position]: event.target.value }))}
      onBlur={() => commitEntry(position)}
    />
    <Popover content={positionPicker(position)} placement="bottomRight" trigger="click">
      <button type="button" className="display-hints-panel__position-trigger" aria-label={`选择${positionLabel(position)}说明的位置`}>
        <PositionIcon position={position} />
      </button>
    </Popover>
  </div>;

  return <section className="display-hints-panel" aria-label="辅助展示">
    <div className="display-hints-panel__heading">
      <Typography.Text type="secondary">填写说明后显示在图表对应角落，最多 4 条。</Typography.Text>
    </div>
    <div className="display-hints-panel__entries">
      {positions.map((position) => renderEntry(position.value, drafts[position.value] ?? "", entries.some((entry) => entry.position === position.value) === false))}
    </div>
  </section>;
};
