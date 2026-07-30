import { FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { createDefaultRegistry, type ComponentRegistry } from "@drag-visual/component-registry";
import type { ComponentType } from "@drag-visual/contracts";
import { Button, Input, Tooltip } from "antd";
import { useState, type KeyboardEvent } from "react";

import type { EditorStore } from "./store/editorStore.js";
import { addRegistryComponent } from "./componentActions.js";
import { getPaletteDragData } from "./paletteDrag.js";

interface ComponentPaletteProps {
  store: EditorStore;
  createComponentId: () => string;
  registry?: ComponentRegistry;
  highlighted?: boolean;
}

const defaultRegistry = createDefaultRegistry();

interface PaletteItem {
  readonly id: string;
  readonly type: ComponentType;
  readonly title: string;
  readonly category: string;
  readonly icon: string;
}

const officialPaletteGroups: ReadonlyArray<{ readonly category: string; readonly items: readonly Omit<PaletteItem, "category">[] }> = [
  {
    category: "表格",
    items: [
      // TODO(chart-palette): 交叉表待后续开发完成后再恢复展示。
      // { id: "pivot-table", type: "crosstab", title: "交叉表", icon: "pivot-table" },
      { id: "detail-table", type: "table", title: "明细表", icon: "detail-table" },
      // TODO(chart-palette): 趋势分析、多维分析待后续开发完成后再恢复展示。
      // { id: "trend-analysis", type: "trend", title: "趋势分析", icon: "trend-analysis" },
      // { id: "multi-analysis", type: "multidimensional", title: "多维分析", icon: "multi-analysis" },
      { id: "heatmap", type: "heatmap", title: "热力图", icon: "heatmap" },
    ],
  },
  {
    category: "指标",
    items: [
      { id: "metric-board", type: "kpi", title: "指标看板", icon: "metric-board" },
      { id: "metric-trend", type: "metricTrend", title: "指标趋势", icon: "metric-trend" },
      // TODO(chart-palette): 翻牌器待后续开发完成后再恢复展示。
      // { id: "flip-number", type: "flipNumber", title: "翻牌器", icon: "flip-number" },
      { id: "progress", type: "progressBar", title: "进度条", icon: "progress" },
      { id: "target-progress", type: "targetProgress", title: "目标完成率", icon: "target-progress" },
      { id: "gauge", type: "gauge", title: "仪表盘", icon: "gauge" },
      // TODO(chart-palette): 水波图、指标拆解待后续开发完成后再恢复展示。
      // { id: "liquid", type: "liquid", title: "水波图", icon: "liquid" },
      // { id: "metric-breakdown", type: "metricBreakdown", title: "指标拆解", icon: "metric-breakdown" },
    ],
  },
  // TODO(chart-palette): 整个线/面积图分类待后续开发完成后再恢复展示。
  // {
  //   category: "线/面积图",
  //   items: [
  //     { id: "line", type: "line", title: "线图", icon: "line" },
  //     { id: "area", type: "area", title: "面积图", icon: "area" },
  //     { id: "stacked-area", type: "stackedArea", title: "堆积", icon: "stacked-area" },
  //     { id: "percent-area", type: "percentArea", title: "百分比", icon: "percent-area" },
  //   ],
  // },
  {
    category: "柱/条图",
    items: [
      { id: "bar", type: "bar", title: "柱图", icon: "bar" },
      { id: "stacked-bar", type: "stackedBar", title: "堆积", icon: "stacked-bar" },
      { id: "percent-bar", type: "percentBar", title: "百分比", icon: "percent-bar" },
      { id: "ring-bar", type: "ringBar", title: "环形柱图", icon: "ring-bar" },
      { id: "ranking", type: "ranking", title: "排行榜", icon: "ranking" },
      // 暂不在组件面板展示：条形、堆积条形、百分比条形、动态条形、瀑布、子弹、箱形、直方图。
      // { id: "strip", type: "bar", title: "条形图", icon: "strip" },
      // { id: "stacked-strip", type: "bar", title: "堆积", icon: "stacked-strip" },
      // { id: "percent-strip", type: "bar", title: "百分比", icon: "percent-strip" },
      // { id: "dynamic-strip", type: "bar", title: "动态条形", icon: "dynamic-strip" },
      // { id: "waterfall", type: "bar", title: "瀑布图", icon: "waterfall" },
      // { id: "bullet", type: "bar", title: "子弹图", icon: "bullet" },
      // { id: "boxplot", type: "bar", title: "箱形图", icon: "boxplot" },
      // { id: "histogram", type: "bar", title: "直方图", icon: "histogram" },
    ],
  },
  {
    category: "饼/环形",
    items: [
      { id: "pie", type: "pie", title: "饼图", icon: "pie" },
      { id: "donut", type: "donut", title: "环形图", icon: "donut" },
      { id: "rose", type: "rose", title: "玫瑰图", icon: "rose" },
      // TODO(chart-palette): 旭日图、雷达图、矩形树图待后续开发完成后再恢复展示。
      // { id: "sunburst", type: "sunburst", title: "旭日图", icon: "sunburst" },
      // { id: "radar", type: "radar", title: "雷达图", icon: "radar" },
      // { id: "treemap", type: "treemap", title: "矩形树图", icon: "treemap" },
    ],
  },
];

const DraggablePaletteCard = ({ id, type, title, icon, onAdd }: PaletteItem & { onAdd: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${id}`,
    data: getPaletteDragData(type, title),
  });
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onAdd();
      return;
    }
    listeners?.onKeyDown?.(event);
  };
  return (
    <Tooltip title={title} placement="top">
      <button
        ref={setNodeRef}
        className={`palette-card${isDragging ? " palette-card--dragging" : ""}`}
        type="button"
        aria-label={`添加${title}`}
        style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
        // A pointer click can briefly activate dnd-kit before this handler runs.
        // Adding must remain reliable for the primary click-to-add interaction.
        onClick={onAdd}
        {...listeners}
        {...attributes}
        onKeyDown={onKeyDown}
      >
        <span className={`palette-card__icon palette-card__icon--${icon}`} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span>{title}</span>
      </button>
    </Tooltip>
  );
};

export const ComponentPalette = ({ store, createComponentId, registry = defaultRegistry, highlighted = false }: ComponentPaletteProps) => {
  const [search, setSearch] = useState("");
  const registeredTypes = new Set(registry.list().map((definition) => definition.type));
  const query = search.trim().toLocaleLowerCase("zh-CN");
  const visibleGroups = officialPaletteGroups
    .map((group) => ({
      category: group.category,
      items: group.items
        .filter((item) => registeredTypes.has(item.type))
        .map((item) => ({ ...item, category: group.category }))
        .filter((item) =>
          query.length === 0 ||
          item.title.toLocaleLowerCase("zh-CN").includes(query) ||
          item.category.toLocaleLowerCase("zh-CN").includes(query) ||
          registry.get(item.type).title.toLocaleLowerCase("zh-CN").includes(query)
        ),
    }))
    .filter((group) => group.items.length > 0);
  const hasVisibleItems = visibleGroups.some((group) => group.items.length > 0);

  return (
    <aside className={`editor-palette editor-panel-scroll${highlighted ? " editor-palette--highlighted" : ""}`} aria-label="图表组件">
      <div className="palette-content">
        <div className="palette-search">
          <Input id="component-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="搜索图表" prefix={<SearchOutlined />} placeholder="搜索图表" size="small" />
          <Tooltip title="筛选图表即将开放"><span><Button type="text" size="small" icon={<FilterOutlined />} disabled aria-label="筛选图表（即将开放）" /></span></Tooltip>
        </div>
        {visibleGroups.map(({ category, items }, categoryIndex) => {
          const headingId = `palette-category-${categoryIndex}`;
          return (
            <section className="palette-section" aria-labelledby={headingId} key={category}>
              <h2 id={headingId}>{category}</h2>
              <div className="palette-grid">
                {items.map((item) => (
                  <DraggablePaletteCard key={item.id} {...item} onAdd={() => addRegistryComponent(store, registry, createComponentId, item.type, undefined, item.title)} />
                ))}
              </div>
            </section>
          );
        })}
        {!hasVisibleItems && <p className="palette-no-results">未找到匹配的图表</p>}
      </div>
    </aside>
  );
};
