import { AppstoreOutlined, FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { createDefaultRegistry, type ComponentRegistry } from "@drag-visual/component-registry";
import type { ComponentType } from "@drag-visual/contracts";
import { Button, Input, Tabs, Tooltip } from "antd";
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

const DraggablePaletteCard = ({ type, title, onAdd }: { type: ComponentType; title: string; onAdd: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: getPaletteDragData(type),
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
      <AppstoreOutlined className="palette-card__icon" />
      <span>{title}</span>
    </button>
  );
};

export const ComponentPalette = ({ store, createComponentId, registry = defaultRegistry }: ComponentPaletteProps) => {
  const [search, setSearch] = useState("");
  const addDefinition = (type: ComponentType) => {
    addRegistryComponent(store, registry, createComponentId, type);
  };
  const query = search.trim().toLocaleLowerCase("zh-CN");
  const visibleDefinitions = registry.list().filter((definition) =>
    query.length === 0 ||
      definition.title.toLocaleLowerCase("zh-CN").includes(query) ||
      definition.category.toLocaleLowerCase("zh-CN").includes(query)
  );
  const groupedDefinitions = new Map<string, typeof visibleDefinitions>();
  for (const definition of visibleDefinitions) {
    const definitions = groupedDefinitions.get(definition.category) ?? [];
    groupedDefinitions.set(definition.category, [...definitions, definition]);
  }

  const official = (
    <div className="palette-content">
      <div className="palette-search">
        <Input id="component-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="搜索图表" prefix={<SearchOutlined />} placeholder="搜索图表" size="small" />
        <Tooltip title="筛选图表即将开放"><span><Button type="text" size="small" icon={<FilterOutlined />} disabled aria-label="筛选图表（即将开放）" /></span></Tooltip>
      </div>
      {[...groupedDefinitions.entries()].map(([category, definitions], categoryIndex) => {
        const headingId = `palette-category-${categoryIndex}`;
        return (
          <section aria-labelledby={headingId} key={category}>
            <h2 id={headingId}>{category}</h2>
            <div className="palette-grid">
              {definitions.map((definition) => (
                <DraggablePaletteCard key={definition.type} type={definition.type} title={definition.title} onAdd={() => addDefinition(definition.type)} />
              ))}
            </div>
          </section>
        );
      })}
      {visibleDefinitions.length === 0 && <p className="palette-no-results">未找到匹配的图表</p>}
    </div>
  );

  return (
    <aside className="editor-palette editor-panel-scroll" aria-label="图表组件">
      <Tabs size="small" defaultActiveKey="official" items={[
        { key: "official", label: "官方", children: official },
        { key: "custom", label: "自定义", children: <div className="palette-empty">暂无自定义组件</div> },
      ]} />
    </aside>
  );
};
