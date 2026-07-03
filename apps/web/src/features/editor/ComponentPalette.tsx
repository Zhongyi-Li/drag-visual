import { AppstoreOutlined, FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { createDefaultRegistry, type ComponentRegistry } from "@drag-visual/component-registry";
import type { ComponentType } from "@drag-visual/contracts";
import { Button, Input, Tabs, Tooltip } from "antd";
import { useState } from "react";

import type { EditorStore } from "./store/editorStore.js";

interface ComponentPaletteProps {
  store: EditorStore;
  createComponentId: () => string;
  registry?: ComponentRegistry;
}

const defaultRegistry = createDefaultRegistry();

export const ComponentPalette = ({ store, createComponentId, registry = defaultRegistry }: ComponentPaletteProps) => {
  const [search, setSearch] = useState("");
  const addDefinition = (type: ComponentType) => {
    const definition = registry.get(type);
    const id = createComponentId();
    store.getState().dispatch({
      type: "component.add",
      component: { id, type, title: definition.title, props: definition.createDefaults() },
      layout: { i: id, x: 0, y: 0, ...definition.defaultLayout },
    });
    store.getState().select(id);
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
                <button className="palette-card" key={definition.type} type="button" aria-label={`添加${definition.title}`} onClick={() => addDefinition(definition.type)}>
                  <AppstoreOutlined className="palette-card__icon" />
                  <span>{definition.title}</span>
                </button>
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
