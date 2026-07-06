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
      { id: "pivot-table", type: "table", title: "交叉表", icon: "pivot-table" },
      { id: "detail-table", type: "table", title: "明细表", icon: "detail-table" },
      { id: "trend-analysis", type: "line", title: "趋势分析", icon: "trend-analysis" },
      { id: "multi-analysis", type: "line", title: "多维分析", icon: "multi-analysis" },
      { id: "heatmap", type: "table", title: "热力图", icon: "heatmap" },
    ],
  },
  {
    category: "指标",
    items: [
      { id: "metric-board", type: "kpi", title: "指标看板", icon: "metric-board" },
      { id: "metric-trend", type: "kpi", title: "指标趋势", icon: "metric-trend" },
      { id: "flip-number", type: "kpi", title: "翻牌器", icon: "flip-number" },
      { id: "progress", type: "kpi", title: "进度条", icon: "progress" },
      { id: "gauge", type: "kpi", title: "仪表盘", icon: "gauge" },
      { id: "liquid", type: "kpi", title: "水波图", icon: "liquid" },
      { id: "metric-breakdown", type: "kpi", title: "指标拆解", icon: "metric-breakdown" },
      { id: "metric-relation", type: "kpi", title: "指标关系", icon: "metric-relation" },
    ],
  },
  {
    category: "线/面积图",
    items: [
      { id: "line", type: "line", title: "线图", icon: "line" },
      { id: "area", type: "line", title: "面积图", icon: "area" },
      { id: "stacked-area", type: "line", title: "堆积", icon: "stacked-area" },
      { id: "percent-area", type: "line", title: "百分比", icon: "percent-area" },
      { id: "combo", type: "line", title: "组合图", icon: "combo" },
    ],
  },
  {
    category: "柱/条图",
    items: [
      { id: "bar", type: "bar", title: "柱图", icon: "bar" },
      { id: "stacked-bar", type: "bar", title: "堆积", icon: "stacked-bar" },
      { id: "percent-bar", type: "bar", title: "百分比", icon: "percent-bar" },
      { id: "ring-bar", type: "bar", title: "环形柱图", icon: "ring-bar" },
      { id: "ranking", type: "bar", title: "排行榜", icon: "ranking" },
      { id: "strip", type: "bar", title: "条形图", icon: "strip" },
      { id: "stacked-strip", type: "bar", title: "堆积", icon: "stacked-strip" },
      { id: "percent-strip", type: "bar", title: "百分比", icon: "percent-strip" },
      { id: "dynamic-strip", type: "bar", title: "动态条形", icon: "dynamic-strip" },
      { id: "waterfall", type: "bar", title: "瀑布图", icon: "waterfall" },
      { id: "bullet", type: "bar", title: "子弹图", icon: "bullet" },
      { id: "boxplot", type: "bar", title: "箱形图", icon: "boxplot" },
      { id: "histogram", type: "bar", title: "直方图", icon: "histogram" },
    ],
  },
  {
    category: "饼/环形",
    items: [
      { id: "pie", type: "pie", title: "饼图", icon: "pie" },
      { id: "rose", type: "pie", title: "玫瑰图", icon: "rose" },
      { id: "sunburst", type: "pie", title: "旭日图", icon: "sunburst" },
      { id: "radar", type: "pie", title: "雷达图", icon: "radar" },
      { id: "treemap", type: "pie", title: "矩形树图", icon: "treemap" },
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
    <button
      ref={setNodeRef}
      className={`palette-card${isDragging ? " palette-card--dragging" : ""}`}
      type="button"
      aria-label={`添加${title}`}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      onClick={() => { if (!isDragging) onAdd(); }}
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
  );
};

export const ComponentPalette = ({ store, createComponentId, registry = defaultRegistry }: ComponentPaletteProps) => {
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
    <aside className="editor-palette editor-panel-scroll" aria-label="图表组件">
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
                  <DraggablePaletteCard key={item.id} {...item} onAdd={() => addRegistryComponent(store, registry, createComponentId, item.type, { x: 0, y: 0 }, item.title)} />
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
