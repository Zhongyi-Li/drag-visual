import { ArrowDownOutlined, ArrowLeftOutlined, ArrowUpOutlined, DeleteOutlined, DownOutlined, EditOutlined, EyeOutlined, FilterOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import type { DatasetCombineConfig, DatasetCombineStep, DatasetField, DatasetProcessingFilter, DatasetQueryResult } from "@drag-visual/contracts";
import { Alert, Button, Card, Checkbox, Empty, Input, Modal, Select, Space, Spin, Tag, Typography } from "antd";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { appPath } from "../../app/appPath.js";
import { getDataset, getDatasetDraft, listDatasets, previewDatasetDraft, publishDatasetDraft, updateDatasetDraft } from "../datasets/datasetApi.js";
import { DataPreview } from "../datasets/DataPreview.js";
import { type CalculatedFieldDraft, type CalculatedFieldOperator } from "./calculatedFields.js";
import { typeLabel, previewParameters } from "./dataCenterHelpers.js";

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : "未知错误";
const operatorOptions: { label: string; value: CalculatedFieldOperator }[] = [{ label: "加", value: "+" }, { label: "减", value: "-" }, { label: "乘", value: "*" }, { label: "除", value: "/" }, { label: "占比（%）", value: "percent" }];
const operatorText: Record<CalculatedFieldOperator, string> = { "+": "+", "-": "-", "*": "×", "/": "÷", percent: "÷（百分比）" };
type JoinStep = Extract<DatasetCombineStep, { kind: "join" }>;
type UnionStep = Extract<DatasetCombineStep, { kind: "union" }>;

export const DatasetDetail = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<CalculatedFieldDraft[]>([]);
  const [label, setLabel] = useState("");
  const [leftField, setLeftField] = useState<string>();
  const [operator, setOperator] = useState<CalculatedFieldOperator>("+");
  const [rightField, setRightField] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [combine, setCombine] = useState<DatasetCombineConfig | null>(null);
  const [filters, setFilters] = useState<DatasetProcessingFilter[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[] | null>(null);
  const [filterField, setFilterField] = useState<string>();
  const [filterOperator, setFilterOperator] = useState<DatasetProcessingFilter["operator"]>("eq");
  const [filterValue, setFilterValue] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [resultName, setResultName] = useState("");
  const [renameField, setRenameField] = useState<{ id: string; label: string }>();
  const [calculationError, setCalculationError] = useState<string>();
  const [calculationEditorOpen, setCalculationEditorOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const schema = useQuery({ queryKey: ["datasets", datasetId, "schema"], queryFn: () => getDataset(datasetId!), enabled: datasetId !== undefined });
  const draft = useQuery({ queryKey: ["datasets", datasetId, "draft"], queryFn: () => getDatasetDraft(datasetId!), enabled: datasetId !== undefined });
  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => listDatasets() });
  const combineSteps = useMemo<DatasetCombineStep[]>(() => combine === null ? [] : combine.kind === "pipeline" ? [...combine.steps] : [combine], [combine]);
  const sourceSchemaQueries = useQueries({ queries: combineSteps.map((step, index) => ({ queryKey: ["datasets", step.sourceDatasetId, "schema", "combine", index], queryFn: () => getDataset(step.sourceDatasetId), enabled: Boolean(step.sourceDatasetId) })) });
  const sourceSchemas = sourceSchemaQueries.map((query) => query.data);
  useEffect(() => {
    if (draft.data !== undefined) {
      setFields(draft.data.calculatedFields);
      setCombine(draft.data.combine);
      setFilters(draft.data.filters);
      setSelectedFields(draft.data.selectedFields);
    }
  }, [draft.data]);
  const preview = useQuery({ queryKey: ["datasets", datasetId, "query", "data-center-detail", schema.data?.schemaVersion, JSON.stringify(fields), JSON.stringify(combine), JSON.stringify(filters), JSON.stringify(selectedFields)], queryFn: () => previewDatasetDraft(datasetId!, { parameters: previewParameters(schema.data?.parameters ?? []), calculatedFields: fields, combine, filters, selectedFields }), enabled: previewOpen && datasetId !== undefined && schema.data !== undefined && draft.data !== undefined });
  const stepInputFields = useMemo(() => {
    const inputs: DatasetField[][] = [];
    let current = schema.data?.fields ?? [];
    combineSteps.forEach((step, index) => {
      inputs.push(current);
      const source = sourceSchemas[index];
      if (step.kind === "join" && source !== undefined) {
        const existing = new Set(current.map((field) => field.key));
        const selected = new Set(step.selectedFields);
        current = [...current, ...source.fields.filter((field) => selected.has(field.key) || selected.has(field.label) || selected.has(`joined_${index + 1}_${field.key}`)).map((field) => {
          let key = field.key;
          if (existing.has(key)) {
            key = `joined_${index + 1}_${field.key}`;
            let suffix = 2;
            while (existing.has(key)) key = `joined_${index + 1}_${field.key}_${suffix++}`;
          }
          existing.add(key);
          return { ...field, key, label: `${source.name} · ${field.label}` };
        })];
      }
    });
    // Keep the post-combine schema as the final entry. Field selection and
    // calculated-field options consume the result after the last join.
    inputs.push(current);
    return inputs;
  }, [combineSteps, schema.data?.fields, sourceSchemas]);
  const availableFields = useMemo(() => stepInputFields[stepInputFields.length - 1] ?? schema.data?.fields ?? [], [schema.data?.fields, stepInputFields]);
  const joinedFields = useMemo(() => availableFields.filter((field) => !(schema.data?.fields ?? []).some((baseField) => baseField.key === field.key)), [availableFields, schema.data?.fields]);
  const numericFields = useMemo(() => [
    ...availableFields.filter((field) => field.type === "number"),
    ...fields.map((field) => ({ key: field.id, label: field.label, type: "number" as const, nullable: true })),
  ], [availableFields, fields]);
  const processingFields = useMemo(() => [...availableFields, ...fields.map((field) => ({ key: field.id, label: field.label, type: "number" as const, nullable: true }))], [availableFields, fields]);
  const selectedFieldKeys = useMemo(() => processingFields.map((field) => field.key).filter((key) => selectedFields === null || selectedFields.includes(key)), [processingFields, selectedFields]);
  const allFieldsSelected = processingFields.length > 0 && selectedFieldKeys.length === processingFields.length;
  const numericFieldOptions = useMemo(() => numericFields.map((field) => ({ label: `${field.label}（${field.key}）`, value: field.key })), [numericFields]);
  const filterFieldOptions = useMemo(() => processingFields.map((field) => ({ label: `${field.label}（${field.key}）`, value: field.key })), [processingFields]);
  const filterOperatorOptions = [{ label: "等于", value: "eq" }, { label: "不等于", value: "neq" }, { label: "包含", value: "contains" }, { label: "大于", value: "gt" }, { label: "大于等于", value: "gte" }, { label: "小于", value: "lt" }, { label: "小于等于", value: "lte" }, { label: "为空", value: "isEmpty" }, { label: "不为空", value: "isNotEmpty" }];
  const calculatedPreview = useMemo(() => preview.data, [preview.data]);
  const combineValidationMessage = useMemo(() => {
    if (combine === null) return "请添加整合步骤。";
    for (const [index, step] of combineSteps.entries()) {
      const source = sourceSchemas[index];
      if (!step.sourceDatasetId) return `第 ${index + 1} 步请选择数据集。`;
      if (sourceSchemaQueries[index]?.isError) return `第 ${index + 1} 步数据集字段加载失败，请重新选择。`;
      if (source === undefined || stepInputFields[index] === undefined) return undefined;
      if (step.kind === "union") {
        const mappings = step.fieldMappings ?? stepInputFields[index]!.flatMap((target) => {
          const sourceField = source.fields.find((field) => field.key === target.key && field.type === target.type);
          return sourceField ? [{ targetField: target.key, sourceField: sourceField.key }] : [];
        });
        if (mappings.length !== stepInputFields[index]!.length || new Set(mappings.map((mapping) => mapping.targetField)).size !== mappings.length) return `第 ${index + 1} 步请为每个目标字段配置 Union 映射。`;
        for (const mapping of mappings) {
          const target = stepInputFields[index]!.find((field) => field.key === mapping.targetField);
          const sourceField = source.fields.find((field) => field.key === mapping.sourceField);
          if (!target || !sourceField || target.type !== sourceField.type) return `第 ${index + 1} 步 Union 映射存在类型不一致。`;
        }
      } else {
        const conditions = [{ leftField: step.leftField, rightField: step.rightField }, ...(step.additionalConditions ?? [])];
        if (conditions.some((condition) => !condition.leftField || !condition.rightField)) return `第 ${index + 1} 步请完整配置关联字段。`;
        for (const condition of conditions) {
          const left = stepInputFields[index]!.find((field) => field.key === condition.leftField);
          const right = source.fields.find((field) => field.key === condition.rightField);
          if (!left || !right || left.type !== right.type) return `第 ${index + 1} 步关联字段类型不一致。`;
        }
      }
    }
    return undefined;
  }, [combine, combineSteps, schema.data, sourceSchemaQueries, sourceSchemas, stepInputFields]);
  const combineBlocked = combineValidationMessage !== undefined || sourceSchemaQueries.some((query) => query.isLoading);
  const duplicateResultName = resultName.trim().length > 0 && (datasets.data ?? []).some((dataset) => dataset.name.trim().toLocaleLowerCase() === resultName.trim().toLocaleLowerCase());
  const duplicateLabel = fields.some((field) => field.label.trim().toLocaleLowerCase() === label.trim().toLocaleLowerCase());
  const formulaReady = label.trim() !== "" && leftField !== undefined && rightField !== undefined && !duplicateLabel;
  const selectedFieldLabel = (key: string | undefined): string => numericFields.find((field) => field.key === key)?.label ?? "未选择字段";

  const addField = () => {
    if (label.trim() === "" || leftField === undefined || rightField === undefined || datasetId === undefined) return;
    if (duplicateLabel) { setCalculationError("字段名称已存在，请使用不同的名称。"); return; }
    const next: CalculatedFieldDraft = { id: `calculated-${Date.now()}`, label: label.trim(), leftField, operator, rightField };
    setFields((current) => [...current, next]);
    setLabel("");
    setCalculationError(undefined);
    setMessage(`已添加计算字段“${next.label}”，保存草稿后会保留。`);
  };
  const moveField = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= fields.length) return;
    const current = fields[index]!;
    const adjacent = fields[target]!;
    if ((offset === -1 && (current.leftField === adjacent.id || current.rightField === adjacent.id))
      || (offset === 1 && (adjacent.leftField === current.id || adjacent.rightField === current.id))) {
      setCalculationError("存在计算字段依赖，不能调整到被依赖字段之前。");
      return;
    }
    setFields((items) => { const next = [...items]; [next[index], next[target]] = [next[target]!, next[index]!]; return next; });
    setCalculationError(undefined);
  };
  const confirmRename = () => {
    if (!renameField?.label.trim()) return;
    const duplicated = fields.some((field) => field.id !== renameField.id && field.label.trim().toLocaleLowerCase() === renameField.label.trim().toLocaleLowerCase());
    if (duplicated) { setCalculationError("字段名称已存在，请使用不同的名称。"); return; }
    setFields((items) => items.map((field) => field.id === renameField.id ? { ...field, label: renameField.label.trim() } : field));
    setRenameField(undefined);
    setCalculationError(undefined);
  };
  const deleteField = (field: CalculatedFieldDraft) => {
    const dependent = fields.find((candidate) => candidate.leftField === field.id || candidate.rightField === field.id);
    if (dependent) { setCalculationError(`“${field.label}”正在被“${dependent.label}”使用，请先删除或修改依赖字段。`); return; }
    setFields((current) => current.filter((candidate) => candidate.id !== field.id));
    setCalculationError(undefined);
  };
  const saveMutation = useMutation({ mutationFn: (next: { fields: readonly CalculatedFieldDraft[]; combine: DatasetCombineConfig | null; filters: readonly DatasetProcessingFilter[]; selectedFields: readonly string[] | null }) => updateDatasetDraft(datasetId!, { calculatedFields: [...next.fields], combine: next.combine, filters: [...next.filters], selectedFields: next.selectedFields === null ? null : [...next.selectedFields] }), onSuccess: (next) => { queryClient.setQueryData(["datasets", datasetId, "draft"], next); void queryClient.invalidateQueries({ queryKey: ["datasets", "processing", "tasks"] }); setMessage("数据关联、结果筛选与字段选择草稿已保存到服务端。"); } });
  const publishMutation = useMutation({ mutationFn: async (name: string) => { await updateDatasetDraft(datasetId!, { calculatedFields: [...fields], combine, filters, selectedFields }); return publishDatasetDraft(datasetId!, name); }, onSuccess: (next) => { queryClient.setQueryData(["datasets", datasetId, "draft"], next.draft); void queryClient.invalidateQueries({ queryKey: ["datasets"] }); void queryClient.invalidateQueries({ queryKey: ["datasets", "processing"] }); setFields(next.draft.calculatedFields); setCombine(next.draft.combine); setFilters(next.draft.filters); setSelectedFields(next.draft.selectedFields); setPublishOpen(false); setMessage(`已发布为新数据集“${next.resultDataset.name}”，原始数据集保持不变。`); } });
  const save = () => { if (datasetId !== undefined) saveMutation.mutate({ fields, combine, filters, selectedFields }); };
  const reset = () => {
    setFields([]);
    setCombine(null);
    setFilters([]);
    setSelectedFields(null);
    setActiveStep(1);
    if (datasetId !== undefined) saveMutation.mutate({ fields: [], combine: null, filters: [], selectedFields: null });
    setMessage("已清空当前数据集的加工草稿并同步到服务端。");
  };
  const addFilter = () => {
    if (!filterField || (!filterOperator.startsWith("is") && filterValue.trim() === "")) return;
    const field = numericFields.find((candidate) => candidate.key === filterField);
    const parsedValue = field?.type === "number" && Number.isFinite(Number(filterValue)) ? Number(filterValue) : filterValue;
    setFilters((current) => [...current, { id: `filter-${Date.now()}`, fieldKey: filterField, operator: filterOperator, ...(filterOperator.startsWith("is") ? {} : { value: parsedValue }) }]);
    setFilterValue("");
  };
  const updateCombineSteps = (updater: (steps: DatasetCombineStep[]) => DatasetCombineStep[]) => {
    setCombine((current) => {
      const steps = current === null ? [] : current.kind === "pipeline" ? [...current.steps] : [current];
      const next = updater(steps);
      return next.length === 0 ? null : next.length === 1 ? next[0]! : { kind: "pipeline", steps: next };
    });
  };
  const updateCombineStep = (index: number, step: DatasetCombineStep) => updateCombineSteps((steps) => steps.map((item, itemIndex) => itemIndex === index ? step : item));
  const addCombineStep = () => updateCombineSteps((steps) => [...steps, { kind: "join", sourceDatasetId: "", joinType: "left", leftField: "", rightField: "", selectedFields: [] }]);
  const removeCombineStep = (index: number) => updateCombineSteps((steps) => steps.filter((_step, itemIndex) => itemIndex !== index));
  const stepSummaries = [
    combineSteps.length > 0 ? `已配置 ${combineSteps.length} 个整合步骤` : "尚未配置整合",
    fields.length > 0 ? `已创建 ${fields.length} 个派生字段` : "可选",
    `${selectedFieldKeys.length} 个字段将发布`,
    filters.length > 0 ? `已添加 ${filters.length} 个条件` : "未添加条件",
  ];
  const stepTitles = ["数据关联", "派生字段", "字段选择", "结果筛选"];
  const stepDescriptions = [
    "添加整合步骤，选择整合方式与数据集，并完成匹配条件。",
    "用现有数值字段计算新指标，例如用销售额减去成本得到利润。此步可以跳过。",
    "选择最终结果中需要保留的字段，减少无关信息。",
    "按条件保留需要的记录。确认结果后即可保存草稿或发布。",
  ];
  const goToStep = (step: number) => { if (step >= 1 && step <= 4 && (step === 1 || !combineBlocked) && (step !== 4 || selectedFieldKeys.length > 0)) setActiveStep(step as 1 | 2 | 3 | 4); };
  const canAdvance = activeStep === 1 ? !combineBlocked : activeStep === 3 ? selectedFieldKeys.length > 0 : true;

  return (
    <div className="data-center data-center--detail">
      <header className="data-center__header">
        <div className="data-center__brand-cluster"><a className="data-center__brand" href={appPath()} aria-label="返回看板中心"><img src={appPath("images/jimou-orbit-lens-mark.png")} alt="" /><span>极眸</span></a><nav aria-label="主导航"><a href={appPath()}>看板中心</a><a href={appPath("data")}>数据中心</a><span className="is-active">数据集详情</span></nav></div>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/data")}>返回数据中心</Button>
      </header>
      <main className="data-center__main data-center__detail-main">
        {schema.isLoading || draft.isLoading ? <div className="data-center__loading"><Spin /></div> : schema.isError ? <Alert type="error" showIcon title="加载数据集失败" description={errorMessage(schema.error)} /> : draft.isError ? <Alert type="warning" showIcon title="该数据集暂不支持加工" description="只有已上传的数据集支持服务端草稿和发布。" /> : schema.data === undefined ? <Empty description="数据集不存在" /> : (
          <>
            {message && <Alert className="data-center__alert" type="success" showIcon title={message} />}
            <div className="data-center__detail-grid data-center__wizard-layout">
              <aside className="data-center__wizard-nav" aria-label="数据加工步骤">
                <div className="data-center__wizard-context"><small>当前数据集</small><strong title={schema.data.name}>{schema.data.name}</strong><span>设置完成后可发布为新数据集</span></div>
                <div className="data-center__wizard-nav-title"><FilterOutlined /> <strong>加工步骤</strong><small>{activeStep} / 4</small></div>
                <nav aria-label="加工步骤导航">
                  {stepTitles.map((title, index) => { const step = (index + 1) as 1 | 2 | 3 | 4; return <button key={title} type="button" aria-current={activeStep === step ? "step" : undefined} disabled={(step > 1 && combineBlocked) || (step === 4 && selectedFieldKeys.length === 0)} className={`data-center__wizard-nav-item${activeStep === step ? " is-active" : ""}`} onClick={() => goToStep(step)}><span className="data-center__wizard-nav-index">{step}</span><span><strong>{title}</strong><small>{stepSummaries[index]}</small></span></button>; })}
                </nav>
              </aside>
              <div className="data-center__wizard-main">
              <div className="data-center__wizard-hero">
                <div className="data-center__wizard-hero-copy"><span>第 {activeStep} 步 · 共 4 步</span><h1>{stepTitles[activeStep - 1]}</h1><p>{stepDescriptions[activeStep - 1]}</p></div>
                <div className="data-center__wizard-progress" role="progressbar" aria-label="加工步骤进度" aria-valuenow={activeStep} aria-valuemin={1} aria-valuemax={4}><span style={{ width: `${activeStep * 25}%` }} /></div>
              </div>
              <Card className={`data-center__processing-steps data-center__wizard-card${activeStep === 2 ? " is-step-hidden" : ""}`}>
                <div className={`data-center__step-section data-center__wizard-step${activeStep === 1 ? " is-active" : ""}`} data-wizard-step="1">
                  <div className="data-center__combine-pipeline">
                    {combineSteps.length === 0 && <div className="data-center__step-empty"><strong>尚未添加整合步骤</strong><span>请先添加整合步骤，并完成整合方式、数据集和匹配条件配置。</span></div>}
                    {combineSteps.map((step, index) => {
                      const source = sourceSchemas[index];
                      const inputFields = stepInputFields[index] ?? schema.data.fields;
                      const conditions = step.kind === "join" ? [{ leftField: step.leftField, rightField: step.rightField }, ...(step.additionalConditions ?? [])] : [];
                      return <div className="data-center__combine-step" key={`combine-step-${index}`}>
                        <div className="data-center__combine-step-heading"><strong>第 {index + 1} 步</strong><Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除整合步骤 ${index + 1}`} onClick={() => removeCombineStep(index)} /></div>
                        <label><span>整合方式</span><Select aria-label={`第${index + 1}步整合方式`} value={step.kind === "join" ? step.joinType : "union"} options={[{ label: "Left Join（保留当前数据）", value: "left" }, { label: "Right Join（保留第二数据）", value: "right" }, { label: "Inner Join（只保留匹配数据）", value: "inner" }, { label: "Full Join（保留两边数据）", value: "full" }, { label: "Union（字段映射追加）", value: "union" }]} onChange={(value) => updateCombineStep(index, value === "union" ? { kind: "union", sourceDatasetId: step.sourceDatasetId } : { kind: "join", sourceDatasetId: step.sourceDatasetId, joinType: value as JoinStep["joinType"], leftField: "", rightField: "", selectedFields: [] })} /></label>
                        <label><span>数据集</span><Select aria-label={`第${index + 1}步数据集`} placeholder="选择数据集" showSearch optionFilterProp="label" value={step.sourceDatasetId || null} options={(datasets.data ?? []).filter((item) => item.id !== datasetId).map((item) => ({ label: item.name, value: item.id }))} onChange={(value: string) => updateCombineStep(index, step.kind === "join" ? { ...step, sourceDatasetId: value, leftField: "", rightField: "", selectedFields: [] } : { ...step, sourceDatasetId: value, fieldMappings: undefined })} /></label>
                        {step.kind === "join" && <>
                          <div className="data-center__match-group">
                            <div className="data-center__match-group-heading"><strong>匹配条件</strong><Typography.Text type="secondary">需同时满足以下全部条件</Typography.Text></div>
                            {conditions.map((condition, conditionIndex) => <div className="data-center__combine-condition" key={`condition-${conditionIndex}`}><span className="data-center__match-condition-index">条件 {conditionIndex + 1}</span><label><span>当前数据集字段</span><Select aria-label={`第${index + 1}步左侧匹配字段${conditionIndex + 1}`} placeholder="选择字段" showSearch optionFilterProp="label" value={condition.leftField || null} options={inputFields.map((field) => ({ label: `${field.label}（${typeLabel[field.type]}）`, value: field.key }))} onChange={(value: string) => updateCombineStep(index, { ...step, ...(conditionIndex === 0 ? { leftField: value } : { additionalConditions: (step.additionalConditions ?? []).map((item, itemIndex) => itemIndex === conditionIndex - 1 ? { ...item, leftField: value } : item) }) })} /></label><span className="data-center__match-equals">等于</span><label><span>第二数据集字段</span><Select aria-label={`第${index + 1}步右侧匹配字段${conditionIndex + 1}`} placeholder="选择字段" showSearch optionFilterProp="label" value={condition.rightField || null} options={(source?.fields ?? []).map((field) => ({ label: `${field.label}（${typeLabel[field.type]}）`, value: field.key }))} onChange={(value: string) => updateCombineStep(index, { ...step, ...(conditionIndex === 0 ? { rightField: value, selectedFields: step.selectedFields.includes(value) ? step.selectedFields : [...step.selectedFields, value] } : { additionalConditions: (step.additionalConditions ?? []).map((item, itemIndex) => itemIndex === conditionIndex - 1 ? { ...item, rightField: value } : item) }) })} /></label>{conditionIndex > 0 ? <Button className="data-center__match-remove" type="text" danger icon={<DeleteOutlined />} aria-label={`删除匹配条件 ${conditionIndex + 1}`} onClick={() => updateCombineStep(index, { ...step, additionalConditions: (step.additionalConditions ?? []).filter((_item, itemIndex) => itemIndex !== conditionIndex - 1) })} /> : <span className="data-center__match-remove-placeholder" aria-hidden="true" />}</div>)}
                            <Button className="data-center__match-add" type="dashed" icon={<PlusOutlined />} onClick={() => updateCombineStep(index, { ...step, additionalConditions: [...(step.additionalConditions ?? []), { leftField: "", rightField: "" }] })}>添加匹配条件</Button>
                          </div>
                          <label className="data-center__combine-fields"><span>第二数据集 · 带入字段 <small>将原始字段加入结果</small></span><Select aria-label={`第${index + 1}步带入字段`} mode="multiple" allowClear placeholder="选择需要加入结果的字段" showSearch optionFilterProp="label" value={step.selectedFields} options={(source?.fields ?? []).map((field) => ({ label: field.label, value: field.key }))} onChange={(values: string[]) => updateCombineStep(index, { ...step, selectedFields: values })} /></label>
                          <Typography.Text className="data-center__combine-hint" type="secondary">{step.joinType === "left" ? "保留当前数据集全部记录。" : step.joinType === "right" ? "保留第二数据集全部记录。" : step.joinType === "full" ? "保留两边数据集全部记录。" : "只保留全部关联条件都匹配的记录。"}</Typography.Text>
                        </>}
                        {step.kind === "union" && <div className="data-center__union-mappings"><Typography.Text type="secondary">Union 会把第二数据集按字段映射追加到当前结果。</Typography.Text>{inputFields.map((target) => { const mapping = step.fieldMappings?.find((item) => item.targetField === target.key); const automatic = source?.fields.find((field) => field.key === target.key && field.type === target.type); return <label key={target.key}><span>{target.label}（{typeLabel[target.type]}）</span><Select aria-label={`Union 映射 ${target.label}`} placeholder="选择第二数据集字段" showSearch optionFilterProp="label" value={mapping?.sourceField ?? automatic?.key ?? null} options={(source?.fields ?? []).filter((field) => field.type === target.type).map((field) => ({ label: `${field.label}（${typeLabel[field.type]}）`, value: field.key }))} onChange={(value: string) => { const mappings = inputFields.map((field) => { const existing = step.fieldMappings?.find((item) => item.targetField === field.key); const auto = source?.fields.find((sourceField) => sourceField.key === field.key && sourceField.type === field.type); return existing ?? (auto ? { targetField: field.key, sourceField: auto.key } : { targetField: field.key, sourceField: "" }); }).map((item) => item.targetField === target.key ? { ...item, sourceField: value } : item).filter((item) => item.sourceField); updateCombineStep(index, { ...step, fieldMappings: mappings }); }} /></label>; })}</div>}
                      </div>;
                    })}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={addCombineStep}>添加下一步整合</Button>
                  </div>
                </div>
                <div className={`data-center__step-section data-center__wizard-step${activeStep === 3 ? " is-active" : ""}`} data-wizard-step="3">
                  {joinedFields.length > 0 && <div className="data-center__selected-source-fields"><strong>第二数据集带入字段</strong><span>{joinedFields.map((field) => field.label).join("、")}</span></div>}
                  <div className="data-center__field-selection-toolbar"><span aria-live="polite">已选 {selectedFieldKeys.length} / {processingFields.length} 个字段</span><Space size="small"><Button size="small" type="link" disabled={allFieldsSelected} onClick={() => setSelectedFields(null)}>全选</Button><Button size="small" type="link" disabled={selectedFieldKeys.length === 0} onClick={() => setSelectedFields([])}>取消全选</Button></Space></div>
                  <Checkbox.Group value={selectedFieldKeys} onChange={(values) => setSelectedFields(values.map(String))} options={processingFields.map((field) => ({ label: field.label, value: field.key }))} />
                  {selectedFieldKeys.length === 0 && <Typography.Text type="secondary">请选择至少一个字段，才能进入下一步。</Typography.Text>}
                </div>
                <div className={`data-center__step-section data-center__wizard-step${activeStep === 4 ? " is-active" : ""}`} data-wizard-step="4">{filters.length === 0 && <div className="data-center__step-empty"><strong>暂未设置筛选条件</strong><span>不筛选时会保留全部结果记录，可以直接预览或发布。</span></div>}{filters.length > 0 && <div className="data-center__filter-list">{filters.map((filter) => <div className="data-center__filter-item" key={filter.id}><span>{processingFields.find((field) => field.key === filter.fieldKey)?.label ?? filter.fieldKey} · {filterOperatorOptions.find((option) => option.value === filter.operator)?.label}{filter.value === undefined ? "" : ` ${String(filter.value)}`}</span><Button type="text" danger onClick={() => setFilters((current) => current.filter((item) => item.id !== filter.id))}>删除</Button></div>)}</div>}<div className="data-center__filter-composer"><Select aria-label="结果筛选字段" placeholder="选择结果字段（可不选）" allowClear showSearch optionFilterProp="label" value={filterField} options={filterFieldOptions} onChange={setFilterField} /><Select aria-label="结果筛选条件" value={filterOperator} options={filterOperatorOptions} onChange={setFilterOperator} /><Input aria-label="结果筛选值" placeholder={filterOperator.startsWith("is") ? "无需填写" : "输入筛选值"} disabled={filterOperator.startsWith("is")} value={filterValue} onChange={(event) => setFilterValue(event.target.value)} onPressEnter={addFilter} /><Button icon={<PlusOutlined />} onClick={addFilter} disabled={!filterField || (!filterOperator.startsWith("is") && !filterValue.trim())}>添加筛选条件</Button></div></div>
              </Card>
              <Card className={`data-center__field-editor data-center__wizard-step${activeStep === 2 ? " is-active" : ""}`} data-wizard-step="2">
                <div className="data-center__calculated-heading"><span><Typography.Title level={5}>我的派生字段 <Tag color="blue" bordered={false}>{fields.length} 个</Tag></Typography.Title><Typography.Text type="secondary">新字段会加入结果，不会覆盖原始数据。</Typography.Text></span><Button type={calculationEditorOpen ? "default" : "primary"} icon={calculationEditorOpen ? undefined : <PlusOutlined />} onClick={() => setCalculationEditorOpen((open) => !open)}>{calculationEditorOpen ? "收起创建表单" : "新建派生字段"}</Button></div>
                {calculationError && <Alert className="data-center__calculation-error" type="warning" showIcon title={calculationError} closable onClose={() => setCalculationError(undefined)} />}
                {fields.length === 0 && !calculationEditorOpen ? <div className="data-center__calculated-empty"><div className="data-center__calculated-empty-icon"><PlusOutlined /></div><strong>还没有派生字段</strong><span>需要新指标时，点“新建派生字段”选择两个数值字段和运算方式。</span></div> : fields.length > 0 ? <div className="data-center__calculated-list">{fields.map((field, index) => <div className="data-center__calculated-item" key={field.id}><span><strong>{field.label}</strong><small>{selectedFieldLabel(field.leftField)} {operatorText[field.operator]} {selectedFieldLabel(field.rightField)}{field.operator === "percent" ? " × 100" : ""}</small></span><Space size={0}><Button type="text" icon={<ArrowUpOutlined />} disabled={index === 0} aria-label={`上移计算字段 ${field.label}`} onClick={() => moveField(index, -1)} /><Button type="text" icon={<ArrowDownOutlined />} disabled={index === fields.length - 1} aria-label={`下移计算字段 ${field.label}`} onClick={() => moveField(index, 1)} /><Button type="text" icon={<EditOutlined />} aria-label={`重命名计算字段 ${field.label}`} onClick={() => setRenameField({ id: field.id, label: field.label })} /><Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除计算字段 ${field.label}`} onClick={() => deleteField(field)} /></Space></div>)}</div> : null}
                {calculationEditorOpen && <div className="data-center__formula-editor">
                  <div className="data-center__formula-header"><span><Typography.Text strong>设置新指标</Typography.Text><Typography.Text type="secondary">先给新字段命名，再选择两个数值字段和计算方式。</Typography.Text></span></div>
                  <label className="data-center__formula-name"><span>字段名称</span><Input aria-label="计算字段名称" placeholder="例如：利润率" value={label} onChange={(event) => setLabel(event.target.value)} onPressEnter={() => { if (formulaReady) addField(); }} maxLength={100} showCount /></label>
                  <div className="data-center__formula-composer">
                    <label><span>第一个字段</span><Select aria-label="计算字段左值" placeholder="选择数值字段" value={leftField} options={numericFieldOptions} showSearch optionFilterProp="label" onChange={setLeftField} /></label>
                    <label className="data-center__formula-operator"><span>运算方式</span><Select aria-label="计算字段运算符" value={operator} options={operatorOptions} onChange={setOperator} /></label>
                    <label><span>第二个字段</span><Select aria-label="计算字段右值" placeholder="选择数值字段" value={rightField} options={numericFieldOptions} showSearch optionFilterProp="label" onChange={setRightField} /></label>
                  </div>
                  <div className="data-center__formula-footer">
                    <span className={formulaReady ? "is-ready" : ""}><small>公式预览</small><strong>{selectedFieldLabel(leftField)} {operatorText[operator]} {selectedFieldLabel(rightField)}{operator === "percent" ? " × 100" : ""}{label.trim() ? ` → ${label.trim()}` : ""}</strong></span>
                    <Button type="primary" icon={<PlusOutlined />} onClick={addField} disabled={!formulaReady}>添加计算字段</Button>
                  </div>
                </div>}
                <details className="data-center__source-fields-disclosure"><summary><span><strong>查看可用的原始字段</strong><small>共 {availableFields.length} 个，其中 {availableFields.filter((field) => field.type === "number").length} 个数值字段可用于计算</small></span><DownOutlined aria-hidden="true" /></summary><div className="data-center__fields data-center__fields--detail">{availableFields.map((field) => <div className="data-center__field" key={field.key}><span><strong>{field.label}</strong><small>{field.key}</small></span><Tag>{typeLabel[field.type]}</Tag></div>)}</div></details>
              </Card>
                <div className={`data-center__wizard-actions${activeStep === 4 ? " is-final-step" : ""}`}>
                  <Button onClick={() => goToStep(activeStep - 1)} disabled={activeStep === 1}>上一步</Button>
                  <span>步骤 {activeStep} / 4</span>
                  <div className="data-center__wizard-action-buttons">
                    {activeStep === 4 && <><Button icon={<EyeOutlined />} disabled={combineBlocked} onClick={() => setPreviewOpen(true)}>预览加工结果</Button><Button onClick={reset} disabled={saveMutation.isPending}>清空草稿</Button></>}
                    <Button
                      type={activeStep === 4 ? "default" : "primary"}
                      icon={activeStep === 4 ? <SaveOutlined /> : undefined}
                      disabled={!canAdvance || saveMutation.isPending}
                      loading={activeStep === 4 && saveMutation.isPending}
                      onClick={() => {
                        if (activeStep === 4) {
                          save();
                          return;
                        }
                        goToStep(activeStep + 1);
                      }}
                    >
                      {activeStep === 4 ? "保存草稿" : `下一步：${["派生字段", "字段选择", "结果筛选"][activeStep - 1]}`}
                    </Button>
                    {activeStep === 4 && <Button type="primary" loading={publishMutation.isPending} disabled={combineBlocked} onClick={() => { setResultName(`${schema.data.name} · 加工结果`); setPublishOpen(true); }}>发布为新数据集</Button>}
                  </div>
                </div>
              </div>
            </div>
            <div className="data-center__draft-note"><strong>服务端草稿</strong><span>草稿会持续保留；发布时生成独立结果数据集，可直接用于图表，原始数据不会被修改。</span></div>
            <Modal title="发布为新数据集" open={publishOpen} okText="确认发布" cancelText="取消" confirmLoading={publishMutation.isPending} okButtonProps={{ disabled: resultName.trim().length === 0 || duplicateResultName }} onCancel={() => setPublishOpen(false)} onOk={() => { if (!duplicateResultName) publishMutation.mutate(resultName.trim()); }}>
              <div className="data-center__publish-form"><Typography.Paragraph type="secondary">系统会把当前预览结果保存为一张独立数据集，原始数据集和草稿都会保留。</Typography.Paragraph><label><span>结果数据集名称</span><Input autoFocus maxLength={100} showCount {...(duplicateResultName ? { status: "error" as const } : {})} value={resultName} onChange={(event) => setResultName(event.target.value)} onPressEnter={() => { if (resultName.trim() && !duplicateResultName) publishMutation.mutate(resultName.trim()); }} /></label>{duplicateResultName && <Alert type="warning" showIcon title="数据集名称已存在" description="请使用一个未被占用的名称。" />}{publishMutation.isError && !duplicateResultName && <Alert type="error" showIcon title="发布失败" description={errorMessage(publishMutation.error)} />}</div>
            </Modal>
            <Modal className="data-center__preview-modal" title="加工结果预览" open={previewOpen} width={1080} footer={<Button onClick={() => setPreviewOpen(false)}>关闭</Button>} onCancel={() => setPreviewOpen(false)}>
              <div className="data-center__preview-modal-body">{preview.isLoading ? <div className="data-center__loading"><Spin /></div> : preview.isError ? <Alert type="warning" showIcon title="暂时无法预览数据" description={errorMessage(preview.error)} /> : calculatedPreview ? <DataPreview result={calculatedPreview as DatasetQueryResult} scrollY="calc(100vh - 410px)" /> : <Empty description="暂无预览数据" />}</div>
            </Modal>
            <Modal title="重命名计算字段" open={renameField !== undefined} okText="保存" cancelText="取消" okButtonProps={{ disabled: !renameField?.label.trim() }} onCancel={() => setRenameField(undefined)} onOk={confirmRename}>
              <Input autoFocus maxLength={100} showCount value={renameField?.label ?? ""} onChange={(event) => setRenameField((current) => current ? { ...current, label: event.target.value } : current)} onPressEnter={confirmRename} />
            </Modal>
          </>
        )}
      </main>
    </div>
  );
};
