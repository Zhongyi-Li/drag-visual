import { BoldOutlined, DesktopOutlined, ItalicOutlined } from "@ant-design/icons";
import { DashboardTableStyle, type DashboardTableTextStyle } from "@drag-visual/contracts";
import { Button, Dropdown, InputNumber, Radio, Space, Tooltip } from "antd";
import { ColorPalettePicker } from "../../components/ColorPalettePicker/ColorPalettePicker.js";
import "./TableStyleSettings.css";

export type DashboardTableStylePatch = Omit<Partial<DashboardTableStyle>, "header" | "body"> & { readonly header?: Partial<DashboardTableTextStyle>; readonly body?: Partial<DashboardTableTextStyle> };

const fonts = [
  { value: "system", label: "系统默认" },
  { value: "source-han-sans", label: "思源黑体" },
  { value: "source-han-serif", label: "思源宋体" },
  { value: "alibaba-puhuiti", label: "阿里巴巴普惠体" },
  { value: "harmonyos-sans", label: "HarmonyOS Sans" },
  { value: "lxgw-wenkai", label: "霞鹜文楷" },
];
const presets = [
  { value: "default", label: "默认" },
  { value: "grid", label: "线框" },
  { value: "simple", label: "简版" },
  { value: "minimal", label: "极简" },
] as const;

const TextStyleControls = ({ label, value, fallbackColor, onChange }: {
  readonly label: string;
  readonly value: DashboardTableTextStyle;
  readonly fallbackColor: string;
  readonly onChange: (patch: Partial<DashboardTableTextStyle>) => void;
}) => <div className="table-style-settings__text-row">
  <span>{label}</span>
  <ColorPalettePicker label={label} ariaLabel={`${label}文字颜色`} opacityLabel={`${label}文字透明度`} trigger="text" color={value.color ?? fallbackColor} opacity={value.opacity ?? 1} onChange={onChange} />
  <Space.Compact className="table-style-settings__font-size">
  <Dropdown trigger={["click"]} menu={{
    selectable: true,
    selectedKeys: [value.fontFamily],
    items: fonts.map((font) => ({ key: font.value, label: font.label })),
    onClick: ({ key }) => onChange({ fontFamily: key as DashboardTableTextStyle["fontFamily"] }),
  }} styles={{ root: { minWidth: 180 } }}>
    <Button aria-label={`${label}字体`} title={fonts.find((font) => font.value === value.fontFamily)?.label} size="small" className="table-style-settings__font" icon={<DesktopOutlined />} />
  </Dropdown>
  <InputNumber aria-label={`${label}字号`} size="small" controls={false} min={10} max={48} precision={0} value={value.fontSize} suffix="px" onChange={(fontSize) => { if (fontSize !== null) onChange({ fontSize }); }} />
  </Space.Compact>
  <Tooltip title={`${label}加粗`}><Button aria-label={`${label}加粗`} aria-pressed={value.bold} type="text" size="small" className={value.bold ? "table-style-settings__active" : ""} icon={<BoldOutlined />} onClick={() => onChange({ bold: !value.bold })} /></Tooltip>
  <Tooltip title={`${label}斜体`}><Button aria-label={`${label}斜体`} aria-pressed={value.italic} type="text" size="small" className={value.italic ? "table-style-settings__active" : ""} icon={<ItalicOutlined />} onClick={() => onChange({ italic: !value.italic })} /></Tooltip>
</div>;

export const TableStyleSettings = ({ value, primaryColor, dark, onChange }: {
  readonly value: DashboardTableStyle | undefined;
  readonly primaryColor: string;
  readonly dark: boolean;
  readonly onChange: (patch: DashboardTableStylePatch) => void;
}) => {
  const settings = DashboardTableStyle.parse(value ?? {});
  const update = (patch: DashboardTableStylePatch) => onChange(patch);
  const accent = settings.colorScheme === "custom" ? settings.customColor : settings.colorScheme === "gray" ? "#8c8c8c" : primaryColor;
  return <div className="dashboard-settings__section-body table-style-settings">
    <span className="table-style-settings__caption">样式设置</span>
    <div className="table-style-settings__presets" role="group" aria-label="表格样式预设">
      {presets.map((preset) => <button type="button" key={preset.value} aria-label={`${preset.label}表格样式`} aria-pressed={settings.preset === preset.value} className={`table-style-settings__preset${settings.preset === preset.value ? " table-style-settings__preset--selected" : ""}`} onClick={() => update({ preset: preset.value, header: { bold: preset.value === "grid" || preset.value === "simple" } })}>
        <table className={`table-style-settings__thumbnail table-style-settings__thumbnail--${preset.value}`} aria-hidden="true"><thead><tr><th /><th /><th /></tr></thead><tbody><tr><td /><td /><td /></tr><tr><td /><td /><td /></tr></tbody></table>
        <span>{preset.label}</span>
      </button>)}
    </div>
    {settings.preset !== "minimal" && <>
    <div className="table-style-settings__row"><span>主色系</span><Radio.Group aria-label="表格主色系" value={settings.colorScheme} onChange={(event) => update({ colorScheme: event.target.value })} options={[{ value: "theme", label: "主题色" }, { value: "gray", label: "灰色" }, { value: "custom", label: "自定义" }]} /></div>
    <div className="table-style-settings__row"><span>配色设置</span><ColorPalettePicker label="表格配色" ariaLabel="表格自定义配色" color={accent} opacity={settings.colorScheme === "custom" ? settings.customOpacity ?? 1 : 1} disabled={settings.colorScheme !== "custom"} onChange={({ color, opacity }) => update({ customColor: color, customOpacity: opacity })} /></div>
    </>}
    <TextStyleControls label="表头" value={settings.header} fallbackColor={dark ? "#e2e8f0" : "#334155"} onChange={(patch) => update({ header: patch })} />
    <TextStyleControls label="内容" value={settings.body} fallbackColor={dark ? "#e2e8f0" : "#1e293b"} onChange={(patch) => update({ body: patch })} />
  </div>;
};
