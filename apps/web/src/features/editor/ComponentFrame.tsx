import { MoreOutlined } from "@ant-design/icons";
import { DashboardComponentRenderer } from "@drag-visual/chart-renderer";
import type { ComponentInstance, DatasetQueryRequest } from "@drag-visual/contracts";
import { useQuery } from "@tanstack/react-query";
import { Button, Drawer, Empty, Dropdown, Spin, type MenuProps } from "antd";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { DataPreview } from "../datasets/DataPreview.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { queryDataset } from "../datasets/datasetApi.js";
import { findAvailableLayout } from "./canvasLayout.js";
import type { EditorStore } from "./store/editorStore.js";

interface ComponentFrameProps {
  component: {
    readonly id: ComponentInstance["id"];
    readonly type: ComponentInstance["type"];
    readonly title?: ComponentInstance["title"];
    readonly props: Readonly<Record<string, unknown>>;
    readonly binding?: unknown;
  };
  store: EditorStore;
  createComponentId: () => string;
  isInteracting: boolean;
}

// Keep the acknowledgement visible long enough to register, even when the
// chart itself can remount faster than a network request.
const REFRESH_INDICATOR_DURATION = 650;

export const ComponentFrame = ({ component, store, createComponentId, isInteracting }: ComponentFrameProps) => {
  const localDatasets = useLocalDatasets();
  const [dataPreviewOpen, setDataPreviewOpen] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSunburstMeasure, setSelectedSunburstMeasure] = useState<string | null>(null);
  const [selectedTreemapMeasure, setSelectedTreemapMeasure] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInput = useRef<HTMLInputElement | null>(null);
  const titleEditSettled = useRef(false);
  const selected = useStore(store, (state) => state.selectedComponentId === component.id);
  const title = component.title ?? component.type;
  const datasetId = typeof component.binding === "object" && component.binding !== null && "datasetId" in component.binding
    ? String(component.binding.datasetId)
    : undefined;
  const localDataset = datasetId ? localDatasets.getDataset(datasetId) : undefined;
  const localResult = datasetId ? localDatasets.queryDataset(datasetId) : undefined;
  const savedDataset = useStore(store, (state) => datasetId === undefined
    ? undefined
    : state.history.present.datasets.find((dataset) => dataset.datasetId === datasetId));
  // Dashboard schema preserves parameters as readonly JSON; the API request body
  // is the same validated value, expressed with the mutable request contract.
  const queryParameters = savedDataset?.parameters as DatasetQueryRequest["parameters"] | undefined;
  const remoteQuery = useQuery({
    queryKey: ["editor-component-data", component.id, datasetId, queryParameters],
    queryFn: () => queryDataset(datasetId!, queryParameters!),
    enabled: datasetId !== undefined && savedDataset !== undefined && localDataset === undefined,
  });
  const dataResult = localResult ?? remoteQuery.data;
  const fields = localDataset?.fields ?? dataResult?.columns;
  const rows = dataResult?.rows ?? [];
  const chartComponent = component as ComponentInstance;
  const isSunburst = chartComponent.type === "sunburst" || (chartComponent.type === "pie" && (chartComponent.title ?? "").includes("旭日"));
  const isTreemap = chartComponent.type === "treemap" || (chartComponent.type === "pie" && (chartComponent.title ?? "").includes("矩形"));
  const measureBinding = chartComponent.binding?.slots.measure;
  const sunburstMeasures = (Array.isArray(measureBinding) ? measureBinding : measureBinding === undefined ? [] : [measureBinding])
    .map((binding) => binding.fieldKey);
  const activeSunburstMeasure = sunburstMeasures.includes(selectedSunburstMeasure ?? "")
    ? selectedSunburstMeasure!
    : sunburstMeasures[0];
  const treemapMeasures = sunburstMeasures;
  const activeTreemapMeasure = treemapMeasures.includes(selectedTreemapMeasure ?? "")
    ? selectedTreemapMeasure!
    : treemapMeasures[0];
  const fieldLabels = new Map((fields ?? []).map((field) => [field.key, field.label]));
  const canRefreshRemoteData = datasetId !== undefined && savedDataset !== undefined && localDataset === undefined;
  const select = () => store.getState().select(component.id);
  const stopControlEvent = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const beginTitleEdit = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    select();
    titleEditSettled.current = false;
    setDraftTitle(title);
    setIsEditingTitle(true);
  };
  const cancelTitleEdit = () => {
    titleEditSettled.current = true;
    setIsEditingTitle(false);
  };
  const commitTitleEdit = () => {
    if (titleEditSettled.current) return;
    titleEditSettled.current = true;
    setIsEditingTitle(false);
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== title) {
      store.getState().dispatch({ type: "component.title.update", componentId: component.id, nextTitle });
    }
  };
  useEffect(() => () => {
    if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
  }, []);
  useEffect(() => {
    if (isEditingTitle) {
      titleInput.current?.focus();
      titleInput.current?.select();
    }
  }, [isEditingTitle]);
  const duplicate = () => {
    const state = store.getState();
    const sourceLayout = state.history.present.layout.find((item) => item.i === component.id);
    if (!sourceLayout) return;
    const newComponentId = createComponentId();
    const layout = findAvailableLayout(state.history.present.layout, { ...sourceLayout, i: newComponentId });
    state.dispatch({ type: "component.duplicate", sourceId: component.id, newComponentId, layout });
    store.getState().select(newComponentId);
  };
  const remove = () => {
    store.getState().dispatch({ type: "component.remove", componentId: component.id });
    store.getState().select(null);
  };
  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const minimumFeedback = new Promise<void>((resolve) => {
      refreshTimer.current = setTimeout(resolve, REFRESH_INDICATOR_DURATION);
    });
    if (canRefreshRemoteData) await Promise.all([remoteQuery.refetch(), minimumFeedback]);
    else await minimumFeedback;
    setRenderVersion((current) => current + 1);
    setIsRefreshing(false);
    refreshTimer.current = null;
  };
  const menuItems: MenuProps["items"] = [
    { key: "duplicate", label: "复制" },
    { key: "delete", label: "删除", danger: true },
    { type: "divider" },
    { key: "refresh", label: isRefreshing ? "正在刷新" : "刷新", disabled: isRefreshing },
    { key: "view-data", label: "查看数据", disabled: dataResult === undefined },
  ];
  const onMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    stopControlEvent(domEvent);
    select();
    if (key === "duplicate") duplicate();
    if (key === "delete") remove();
    if (key === "refresh") void refresh();
    if (key === "view-data") setDataPreviewOpen(true);
  };

  return (
    <section
      aria-label={title}
      className={`component-frame${selected ? " component-frame--selected" : ""}`}
      role="group"
      tabIndex={0}
      onClick={select}
      onFocus={(event) => { if (event.target === event.currentTarget) select(); }}
    >
      <header className="component-frame__header">
        {isEditingTitle ? (
          <input
            ref={titleInput}
            className="component-frame__title-input"
            aria-label="图表名称"
            maxLength={100}
            value={draftTitle}
            onBlur={commitTitleEdit}
            onChange={(event) => setDraftTitle(event.target.value)}
            onClick={stopControlEvent}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") commitTitleEdit();
              if (event.key === "Escape") cancelTitleEdit();
            }}
          />
        ) : (
          <button className="component-frame__title-button" type="button" onClick={beginTitleEdit}>
            {title}
          </button>
        )}
        <div className="component-frame__header-controls">
          {isSunburst && sunburstMeasures.length > 1 && (
            <select
              className="component-frame__sunburst-select"
              aria-label="切换旭日图指标"
              value={activeSunburstMeasure}
              onChange={(event) => setSelectedSunburstMeasure(event.target.value)}
            >
              {sunburstMeasures.map((measure) => <option key={measure} value={measure}>{fieldLabels.get(measure) ?? measure}</option>)}
            </select>
          )}
          {isTreemap && treemapMeasures.length > 1 && (
            <select
              className="component-frame__sunburst-select"
              aria-label="切换矩形树图指标"
              value={activeTreemapMeasure}
              onChange={(event) => setSelectedTreemapMeasure(event.target.value)}
            >
              {treemapMeasures.map((measure) => <option key={measure} value={measure}>{fieldLabels.get(measure) ?? measure}</option>)}
            </select>
          )}
          <Dropdown menu={{ items: menuItems, onClick: onMenuClick }} placement="bottomLeft" trigger={["click"]}>
            <Button
              className="component-frame__menu-trigger"
              type="text"
              size="small"
              aria-label={`更多操作${title}`}
              icon={<MoreOutlined />}
              onClick={stopControlEvent}
            />
          </Dropdown>
        </div>
      </header>
      <div className="component-frame__renderer" data-testid="component-renderer" data-interacting={String(isInteracting)}>
        <DashboardComponentRenderer
          key={renderVersion}
          component={chartComponent}
          fields={fields}
          rows={rows}
          activeSunburstMeasure={isSunburst ? activeSunburstMeasure : undefined}
          onSunburstMeasureChange={isSunburst ? setSelectedSunburstMeasure : undefined}
          activeTreemapMeasure={isTreemap ? activeTreemapMeasure : undefined}
          onTreemapMeasureChange={isTreemap ? setSelectedTreemapMeasure : undefined}
        />
        {isRefreshing && (
          <div className="component-frame__refresh-mask" role="status" aria-live="polite">
            <Spin size="small" />
            <span>正在刷新图表</span>
          </div>
        )}
      </div>
      <Drawer title={`${title}的数据`} placement="right" size="large" open={dataPreviewOpen} onClose={() => setDataPreviewOpen(false)}>
        {dataResult === undefined ? <Empty description="暂无可查看的数据" /> : <DataPreview result={dataResult} />}
      </Drawer>
    </section>
  );
};
