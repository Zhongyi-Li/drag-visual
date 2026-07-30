import { ReloadOutlined } from "@ant-design/icons";
import type { QueryParameter } from "@drag-visual/contracts";
import { Button, Input, InputNumber, Switch } from "antd";

import "./RuntimeDatasetRequestBar.css";

export type RuntimeParameterValues = Readonly<Record<string, string | number | boolean>>;

interface RuntimeDatasetRequestBarProps {
  readonly parameters: readonly QueryParameter[];
  readonly values: RuntimeParameterValues;
  readonly onChange: (key: string, value: string | number | boolean) => void;
  readonly onRequest: () => void;
  readonly loading?: boolean;
}

export const runtimeParameters = (parameters: readonly QueryParameter[]): readonly QueryParameter[] =>
  parameters.filter((parameter) => parameter.runtime === true);

export const defaultRuntimeParameterValue = (parameter: QueryParameter): string | number | boolean => {
  if (parameter.defaultValue !== undefined) return parameter.defaultValue;
  if (parameter.key === "current") return 1;
  if (parameter.key === "size") return 20;
  if (parameter.type === "number") return 0;
  if (parameter.type === "boolean") return false;
  return "";
};

export const buildRuntimeParameters = (
  parameters: readonly QueryParameter[],
  values: RuntimeParameterValues,
): Record<string, string | number | boolean> => Object.fromEntries(
  parameters.map((parameter) => [parameter.key, values[parameter.key] ?? defaultRuntimeParameterValue(parameter)]),
);

const parameterControl = (
  parameter: QueryParameter,
  value: string | number | boolean,
  onChange: (value: string | number | boolean) => void,
) => {
  if (parameter.type === "number") return <InputNumber aria-label={parameter.label} min={1} precision={0} size="small" value={typeof value === "number" ? value : Number(value)} onChange={(nextValue) => { if (nextValue !== null) onChange(nextValue); }} />;
  if (parameter.type === "boolean") return <Switch aria-label={parameter.label} size="small" checked={value === true} onChange={onChange} />;
  return <Input aria-label={parameter.label} size="small" value={String(value)} onChange={(event) => onChange(event.target.value)} />;
};

export const RuntimeDatasetRequestBar = ({ parameters, values, onChange, onRequest, loading = false }: RuntimeDatasetRequestBarProps) => {
  if (parameters.length === 0) return null;
  return <div className="runtime-dataset-request" onClick={(event) => event.stopPropagation()}>
    <div className="runtime-dataset-request__controls">
      {parameters.map((parameter) => <label className="runtime-dataset-request__field" key={parameter.key}>
        <span>{parameter.label}</span>
        {parameterControl(parameter, values[parameter.key] ?? defaultRuntimeParameterValue(parameter), (value) => onChange(parameter.key, value))}
      </label>)}
      <Button aria-label="查询" type="primary" size="small" icon={<ReloadOutlined />} loading={loading} onClick={onRequest}>查询</Button>
    </div>
  </div>;
};
