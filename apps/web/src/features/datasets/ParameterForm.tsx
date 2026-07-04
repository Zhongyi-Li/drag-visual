import type { QueryParameter } from "@drag-visual/contracts";
import { Button, DatePicker, Form, Input, InputNumber, Space, Switch } from "antd";

type ParameterValues = Readonly<Record<string, unknown>>;

interface DateValue {
  format(format: string): string;
}

const calendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const dateString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "format" in value && typeof value.format === "function") {
    return (value as DateValue).format("YYYY-MM-DD");
  }
  return undefined;
};

const blank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

export const buildQueryParameters = (
  parameters: readonly QueryParameter[],
  values: ParameterValues,
): Record<string, string | number | boolean> => {
  const result: Record<string, string | number | boolean> = {};
  const setResult = (key: string, value: string | number | boolean): void => {
    Object.defineProperty(result, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };
  for (const parameter of parameters) {
    const value = Object.hasOwn(values, parameter.key) ? values[parameter.key] : undefined;
    if (blank(value)) {
      if (parameter.required) throw new Error(`Required parameter "${parameter.key}" is missing`);
      continue;
    }
    if (parameter.type === "date") {
      const serialized = dateString(value);
      if (serialized === undefined || !calendarDate(serialized)) {
        throw new Error(`Parameter "${parameter.key}" must be a valid YYYY-MM-DD date`);
      }
      setResult(parameter.key, serialized);
      continue;
    }
    if (parameter.type === "string" && typeof value === "string") setResult(parameter.key, value);
    else if (parameter.type === "boolean" && typeof value === "boolean") setResult(parameter.key, value);
    else if (parameter.type === "number" && typeof value === "number" && Number.isFinite(value)) {
      setResult(parameter.key, value);
    } else {
      throw new Error(`Parameter "${parameter.key}" must be a ${parameter.type}`);
    }
  }
  return result;
};

export interface ParameterFormProps {
  readonly parameters: readonly QueryParameter[];
  readonly onSubmit: (parameters: Record<string, string | number | boolean>) => void;
  readonly submitting?: boolean;
}

const control = (parameter: QueryParameter) => {
  if (parameter.type === "number") return <InputNumber style={{ width: "100%" }} />;
  if (parameter.type === "date") return <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />;
  if (parameter.type === "boolean") return <Switch />;
  return <Input />;
};

export const ParameterForm = ({ parameters, onSubmit, submitting = false }: ParameterFormProps) => (
  <Form
    layout="vertical"
    onFinish={(values: Record<string, unknown>) => onSubmit(buildQueryParameters(parameters, values))}
  >
    {parameters.map((parameter) => (
      <Form.Item
        key={parameter.key}
        name={parameter.key}
        label={parameter.label}
        valuePropName={parameter.type === "boolean" ? "checked" : "value"}
        {...(parameter.required ? { rules: [{
          validator: async (_: unknown, value: unknown) => blank(value)
            ? Promise.reject(new Error(`请输入${parameter.label}`))
            : Promise.resolve(),
        }] } : {})}
      >
        {control(parameter)}
      </Form.Item>
    ))}
    <Space>
      <Button type="primary" htmlType="submit" loading={submitting}>查询</Button>
    </Space>
  </Form>
);
