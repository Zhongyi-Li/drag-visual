import { BarChartOutlined, DatabaseOutlined, DeleteOutlined, FormOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { createDefaultRegistry } from "@drag-visual/component-registry";
import { ComponentInteraction, type ComponentInstance, type Dataset, type DatasetField } from "@drag-visual/contracts";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Modal, Radio, Select, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";

import { getDataset } from "../datasets/datasetApi.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { listDashboards } from "../dashboards/dashboardApi.js";
import { dashboardGlobalFilters } from "../viewer/dashboardGlobalFilters.js";
import type { EditorStore } from "./store/editorStore.js";

interface SavedJumpRule {
  readonly id: string;
  readonly triggerFieldKey: string;
  readonly targetDashboardId: string;
  readonly openMode: "current" | "newTab";
  readonly targetPosition?: "top" | "component" | undefined;
  readonly targetComponentId?: string | undefined;
  readonly parameterMappings: readonly { readonly sourceFieldKey: string; readonly targetFilterId: string }[];
}

interface JumpConfigComponent {
  readonly id: string;
  readonly type: ComponentInstance["type"];
  readonly title?: string | undefined;
  readonly binding?: {
    readonly datasetId: string;
    readonly slots: Readonly<Record<string, { readonly fieldKey: string } | readonly { readonly fieldKey: string }[]>>;
  } | undefined;
  readonly interaction?: { readonly jumpRules: readonly SavedJumpRule[] } | undefined;
}

interface Props {
  readonly component: JumpConfigComponent;
  readonly store: EditorStore;
}

interface DraftJumpRule {
  id: string;
  triggerFieldKey: string;
  targetDashboardId: string;
  openMode: "current" | "newTab";
  targetPosition: "top" | "component";
  targetComponentId?: string | undefined;
  parameterMappings: { sourceFieldKey: string; targetFilterId: string }[];
}

const cloneRule = (rule: SavedJumpRule): DraftJumpRule => ({
  ...rule,
  targetPosition: rule.targetPosition ?? "top",
  parameterMappings: rule.parameterMappings.map((mapping) => ({ ...mapping })),
});

const flatBindings = (component: Pick<JumpConfigComponent, "binding">): readonly string[] => {
  const slots = Object.values(component.binding?.slots ?? {});
  return [...new Set(slots.flatMap((slot) => "fieldKey" in slot ? [slot.fieldKey] : slot.map((entry) => entry.fieldKey)))];
};

const metricBindingKeys = (component: JumpConfigComponent): readonly string[] => {
  const definition = createDefaultRegistry().get(component.type);
  const numericSlots = new Set(definition.dataSlots.filter((slot) => slot.acceptedTypes.includes("number")).map((slot) => slot.key));
  return Object.entries(component.binding?.slots ?? {}).flatMap(([slotKey, slot]) => {
    if (!numericSlots.has(slotKey)) return [];
    return "fieldKey" in slot ? [slot.fieldKey] : slot.map((entry) => entry.fieldKey);
  });
};

const createRule = (fieldKey = ""): DraftJumpRule => ({
  id: `jump-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  triggerFieldKey: fieldKey,
  targetDashboardId: "",
  openMode: "current",
  targetPosition: "top",
  parameterMappings: [],
});

const replaceRule = (rules: readonly DraftJumpRule[], ruleId: string, next: DraftJumpRule): readonly DraftJumpRule[] =>
  rules.map((rule) => rule.id === ruleId ? next : rule);

const labelForField = (field: DatasetField | undefined, fallback: string): string => field === undefined ? fallback : `${field.label}（${field.key}）`;

export const ChartJumpConfigurationPanel = ({ component, store }: Props) => {
  const dashboard = useStore(store, (state) => state.history.present);
  const current = dashboard.components.find((candidate) => candidate.id === component.id) ?? component;
  const localDatasets = useLocalDatasets();
  const datasetId = current.binding?.datasetId;
  const localDataset = datasetId === undefined ? undefined : localDatasets.getDataset(datasetId);
  const schema = useQuery({
    queryKey: ["dataset-schema", datasetId],
    queryFn: () => getDataset(datasetId!),
    enabled: datasetId !== undefined && localDataset === undefined,
  });
  const dashboardList = useQuery({ queryKey: ["dashboards", "jump-targets"], queryFn: () => listDashboards() });
  const dataset: Dataset | undefined = localDataset ?? schema.data;
  const fieldKeys = flatBindings(current);
  const sourceFields = useMemo<readonly DatasetField[]>(() => fieldKeys.map((key) => dataset?.fields.find((field) => field.key === key) ?? { key, label: key, type: "string" as const, nullable: true }), [dataset?.fields, fieldKeys]);
  const triggerFieldKeys = metricBindingKeys(current);
  const triggerFields = sourceFields.filter((field) => triggerFieldKeys.includes(field.key));
  const savedRules = current.interaction?.jumpRules ?? [];
  const savedRulesKey = JSON.stringify(savedRules);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<readonly DraftJumpRule[]>(() => savedRules.map(cloneRule));
  const [activeRuleId, setActiveRuleId] = useState<string | null>(() => savedRules[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDraftRules(savedRules.map(cloneRule));
    setActiveRuleId(savedRules[0]?.id ?? null);
    setError(null);
  }, [savedRulesKey]);

  const targets = useMemo(() => (dashboardList.data ?? []).filter((candidate) => candidate.id !== dashboard.id), [dashboard.id, dashboardList.data]);
  const currentChartTitle = current.title?.trim() || createDefaultRegistry().get(current.type).title;
  const activeRule = draftRules.find((rule) => rule.id === activeRuleId) ?? draftRules[0];
  const activeTarget = targets.find((target) => target.id === activeRule?.targetDashboardId);
  const targetHeader = activeTarget?.components.find((candidate) => candidate.type === "dashboardHeader");
  const targetFilters = dashboardGlobalFilters(targetHeader).filter((filter) => filter.controlType !== "dateRange");
  const targetComponentOptions = useMemo(() => (activeTarget?.components ?? [])
    .filter((candidate) => candidate.type !== "dashboardHeader" && candidate.type !== "analysisGroup" && createDefaultRegistry().get(candidate.type).dataSlots.length > 0)
    .map((candidate) => ({ value: candidate.id, label: candidate.title?.trim() || createDefaultRegistry().get(candidate.type).title })), [activeTarget]);
  const sourceFieldOptions = sourceFields.map((field) => ({ value: field.key, label: labelForField(field, field.key) }));
  const triggerFieldOptions = triggerFields.map((field) => ({ value: field.key, label: labelForField(field, field.key) }));

  const updateActiveRule = (update: (rule: DraftJumpRule) => DraftJumpRule) => {
    if (activeRule === undefined) return;
    setDraftRules((rules) => replaceRule(rules, activeRule.id, update(activeRule)));
  };
  const addRule = () => {
    const next = createRule(triggerFields[0]?.key);
    setDraftRules((rules) => [...rules, next]);
    setActiveRuleId(next.id);
  };
  const removeRule = (ruleId: string) => {
    setDraftRules((rules) => {
      const next = rules.filter((rule) => rule.id !== ruleId);
      setActiveRuleId(next[0]?.id ?? null);
      return next;
    });
  };
  const openModal = () => {
    setDraftRules(savedRules.map(cloneRule));
    setActiveRuleId(savedRules[0]?.id ?? null);
    setError(null);
    setModalOpen(true);
  };
  const openNewRule = () => {
    const next = createRule(triggerFields[0]?.key);
    setDraftRules([...savedRules.map(cloneRule), next]);
    setActiveRuleId(next.id);
    setError(null);
    setModalOpen(true);
  };
  const save = () => {
    const parsed = ComponentInteraction.safeParse({ jumpRules: draftRules });
    if (!parsed.success) {
      setError("请为每条跳转规则选择触发指标和目标看板；定位到图表时还需选择目标图表。");
      return;
    }
    store.getState().dispatch({
      type: "component.interaction.update",
      componentId: current.id,
      nextInteraction: parsed.data.jumpRules.length === 0 ? undefined : parsed.data,
    });
    setModalOpen(false);
  };

  if (current.binding === undefined) {
    return <section className="chart-jump-panel" aria-label="图表跳转配置"><Typography.Text type="secondary">请先在“字段”页绑定数据源，再配置图表跳转。</Typography.Text></section>;
  }
  if (schema.isLoading && localDataset === undefined) {
    return <section className="chart-jump-panel" aria-label="图表跳转配置"><Typography.Text type="secondary">正在加载可跳转字段…</Typography.Text></section>;
  }
  if (triggerFields.length === 0) {
    return <section className="chart-jump-panel" aria-label="图表跳转配置"><Typography.Text type="secondary">当前图表尚未绑定可点击的指标字段。</Typography.Text></section>;
  }

  return <section className="chart-jump-panel" aria-label="图表跳转配置">
    <div className="chart-jump-panel__status" aria-label="跳转配置状态">
      <span>{savedRules.length > 0 ? "已配置" : "未配置"}</span>
      <Button aria-label="编辑跳转规则" type="text" size="small" icon={<FormOutlined />} onClick={savedRules.length > 0 ? openModal : openNewRule} />
    </div>
    {savedRules.length > 0 && <div className="chart-jump-panel__summary" aria-label="已配置跳转规则">
      {savedRules.map((rule) => {
        const field = sourceFields.find((candidate) => candidate.key === rule.triggerFieldKey);
        const target = targets.find((candidate) => candidate.id === rule.targetDashboardId);
        return <article className="chart-jump-panel__summary-item" key={rule.id}>
          <div>
            <strong>{field?.label ?? rule.triggerFieldKey}</strong>
            <RightOutlined aria-hidden="true" className="chart-jump-panel__arrow" />
            <span>{target?.name ?? "目标看板"}</span>
          </div>
        </article>;
      })}
    </div>}
    <Modal
      centered
      className="chart-jump-modal"
      destroyOnHidden
      footer={<div className="chart-jump-modal__footer"><Button onClick={() => setModalOpen(false)}>取消</Button><Button type="primary" onClick={save}>确认</Button></div>}
      open={modalOpen}
      title="图表跳转设置"
      width={1000}
      onCancel={() => setModalOpen(false)}
    >
      <div className="chart-jump-modal__context" aria-label="当前图表与数据集">
        <div><span>当前图表</span><strong><BarChartOutlined aria-hidden="true" />{currentChartTitle}</strong></div>
        <span className="chart-jump-modal__context-divider" aria-hidden="true" />
        <div><span>当前数据集</span><strong><DatabaseOutlined aria-hidden="true" />{dataset?.name ?? "未命名数据集"}</strong></div>
      </div>
      <div className="chart-jump-modal__body">
        <aside className="chart-jump-modal__rules" aria-label="跳转规则列表">
          <div className="chart-jump-modal__rules-heading"><span>跳转规则</span><Button aria-label="添加跳转规则" type="text" size="small" icon={<PlusOutlined />} onClick={addRule} /></div>
          {draftRules.map((rule) => {
            const field = sourceFields.find((candidate) => candidate.key === rule.triggerFieldKey);
            return <div
              className={`chart-jump-modal__rule${rule.id === activeRule?.id ? " is-active" : ""}`}
              key={rule.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveRuleId(rule.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveRuleId(rule.id);
                }
              }}
            >
              <span>{(field?.label ?? rule.triggerFieldKey) || "请选择指标"}</span><Button aria-label="删除该跳转规则" size="small" type="text" danger icon={<DeleteOutlined />} onClick={(event) => { event.stopPropagation(); removeRule(rule.id); }} />
            </div>;
          })}
          {draftRules.length === 0 && <div className="chart-jump-modal__rules-empty">点击右上角添加规则</div>}
        </aside>
        <main className="chart-jump-modal__form">
          {activeRule === undefined ? <div className="chart-jump-modal__form-empty">请选择或添加一条跳转规则。</div> : <>
            <label><span className="chart-jump-modal__field-label">触发指标</span>
              <Select className="chart-jump-modal__select" aria-label="触发指标" value={activeRule.triggerFieldKey || null} placeholder="选择点击后触发跳转的指标" options={triggerFieldOptions} onChange={(triggerFieldKey: string) => updateActiveRule((rule) => ({ ...rule, triggerFieldKey }))} />
            </label>
            <section className="chart-jump-modal__destination" aria-label="跳转目标设置">
              <label><span className="chart-jump-modal__field-label">跳转目标</span>
                <Select className="chart-jump-modal__select" aria-label="目标看板" loading={dashboardList.isLoading} value={activeRule.targetDashboardId || null} placeholder="选择目标看板" options={targets.map((target) => ({ value: target.id, label: target.name }))} onChange={(targetDashboardId: string) => updateActiveRule((rule) => ({ ...rule, targetDashboardId, targetPosition: "top", targetComponentId: undefined, parameterMappings: [] }))} />
              </label>
              <div className="chart-jump-modal__position"><span className="chart-jump-modal__field-label">跳转位置</span><div className="chart-jump-modal__position-controls">
                <Radio.Group value={activeRule.targetPosition} onChange={(event) => updateActiveRule((rule) => ({ ...rule, targetPosition: event.target.value, targetComponentId: event.target.value === "component" ? undefined : rule.targetComponentId }))}><Radio value="top">默认顶部</Radio><Radio value="component">定位到图表</Radio></Radio.Group>
                {activeRule.targetPosition === "component" && <Select className="chart-jump-modal__select chart-jump-modal__target-component" aria-label="目标图表" disabled={activeTarget === undefined} value={activeRule.targetComponentId ?? null} placeholder={activeTarget === undefined ? "请先选择目标看板" : "选择目标图表"} options={targetComponentOptions} onChange={(targetComponentId: string) => updateActiveRule((rule) => ({ ...rule, targetComponentId }))} />}
              </div></div>
              <div className="chart-jump-modal__mode"><span className="chart-jump-modal__field-label">打开方式</span><Radio.Group value={activeRule.openMode} onChange={(event) => updateActiveRule((rule) => ({ ...rule, openMode: event.target.value }))}><Radio value="current">当前页打开</Radio><Radio value="newTab">新标签页打开</Radio></Radio.Group></div>
            </section>
            <section className="chart-jump-modal__parameters" aria-label="筛选参数映射">
              <div className="chart-jump-modal__parameters-heading"><strong>筛选参数</strong></div>
              {activeTarget === undefined ? <div className="chart-jump-modal__parameters-empty">请先选择目标看板。</div>
                : targetFilters.length === 0 ? <div className="chart-jump-modal__parameters-empty chart-jump-modal__parameters-empty--centered">
                  <Typography.Text type="secondary">将点击数据带入目标看板的全局筛选器。</Typography.Text>
                  <Typography.Text className="chart-jump-modal__parameters-warning">目标看板暂未配置可接收的全局筛选器，可直接跳转。</Typography.Text>
                </div>
                  : <>
                    {activeRule.parameterMappings.map((mapping, index) => <div className="chart-jump-modal__mapping" key={`${mapping.sourceFieldKey}-${mapping.targetFilterId}-${index}`}>
                      <Select className="chart-jump-modal__select" aria-label={`来源字段${index + 1}`} value={mapping.sourceFieldKey || null} placeholder="来源字段" options={sourceFieldOptions} onChange={(sourceFieldKey: string) => updateActiveRule((rule) => ({ ...rule, parameterMappings: rule.parameterMappings.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, sourceFieldKey } : candidate) }))} />
                      <span>传递至</span>
                      <Select className="chart-jump-modal__select" aria-label={`目标筛选器${index + 1}`} value={mapping.targetFilterId || null} placeholder="目标筛选器" options={targetFilters.map((filter) => ({ value: filter.id, label: filter.label }))} onChange={(targetFilterId: string) => updateActiveRule((rule) => ({ ...rule, parameterMappings: rule.parameterMappings.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, targetFilterId } : candidate) }))} />
                      <Button aria-label={`删除筛选参数${index + 1}`} size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => updateActiveRule((rule) => ({ ...rule, parameterMappings: rule.parameterMappings.filter((_, candidateIndex) => candidateIndex !== index) }))} />
                    </div>)}
                    <Button className="chart-jump-modal__add-mapping" size="small" type="text" icon={<PlusOutlined />} onClick={() => updateActiveRule((rule) => ({ ...rule, parameterMappings: [...rule.parameterMappings, { sourceFieldKey: sourceFields[0]?.key ?? "", targetFilterId: targetFilters[0]?.id ?? "" }] }))}>添加筛选参数</Button>
                  </>}
            </section>
            {error !== null && <Alert type="warning" showIcon message={error} />}
          </>}
        </main>
      </div>
    </Modal>
  </section>;
};
