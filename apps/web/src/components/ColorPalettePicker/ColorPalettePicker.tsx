import { useEffect, useId, useRef, useState } from "react";
import { DownOutlined, ReloadOutlined, HighlightOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Button, ColorPicker, Tooltip } from "antd";
import { paletteColors, readRecentColors, recentColorsKey, rememberColor, shadeColor, type PaletteColor } from "./colorPalette.js";
import "./ColorPalettePicker.css";

export interface ColorPalettePickerProps {
  readonly label: string;
  readonly color: string;
  readonly opacity?: number;
  readonly disabled?: boolean;
  readonly disabledAlpha?: boolean;
  readonly trigger?: "text" | "swatch";
  readonly ariaLabel?: string;
  readonly opacityLabel?: string;
  readonly onChange: (value: PaletteColor) => void;
}

/** Shared color/brightness/alpha picker. Values use hex RGB plus a separate 0–1 alpha. */
export const ColorPalettePicker = ({ label, color, opacity = 1, disabled = false, disabledAlpha = false, trigger = "swatch", ariaLabel = `${label}颜色`, opacityLabel = `${label}透明度`, onChange }: ColorPalettePickerProps) => {
  const EyeDropper = typeof window === "undefined" ? undefined : (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
  const pickerId = useId();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState(readRecentColors);
  const [base, setBase] = useState(color);
  const [position, setPosition] = useState(50);
  const [expanded, setExpanded] = useState(false);
  const pending = useRef<PaletteColor>({ color, opacity });
  useEffect(() => { pending.current = { color, opacity }; }, [color, opacity]);
  useEffect(() => {
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== pickerId) { setOpen(false); setExpanded(false); }
    };
    window.addEventListener("drag-visual:color-picker-open", closeOther);
    return () => window.removeEventListener("drag-visual:color-picker-open", closeOther);
  }, [pickerId]);
  const change = (value: PaletteColor, remember = false) => {
    pending.current = value;
    onChange(value);
    if (remember) setRecent(rememberColor(value));
  };
  const commit = () => setRecent(rememberColor(pending.current));
  const choose = (value: PaletteColor) => { setBase(value.color); setPosition(50); change(disabledAlpha ? { ...value, opacity: 1 } : value, true); };
  const sample = async () => {
    if (!EyeDropper) return;
    try { const result = await new EyeDropper().open(); choose({ color: result.sRGBHex.toLowerCase(), opacity }); } catch { /* User cancellation leaves the current value intact. */ }
  };
  const swatch = (value: PaletteColor, index: number, prefix: string) => <button key={`${prefix}-${index}`} type="button" aria-label={`${prefix} ${value.color}${prefix === "最近使用颜色" ? ` · ${Math.round(value.opacity * 100)}%` : ""}`} title={`${value.color} · ${Math.round(value.opacity * 100)}%`} aria-pressed={prefix === "选择颜色" ? base.toLowerCase() === value.color.toLowerCase() : color.toLowerCase() === value.color.toLowerCase() && opacity === value.opacity} className="color-palette__swatch" onClick={() => choose(value)}><span style={{ background: value.color, opacity: prefix === "选择颜色" ? 1 : value.opacity }} /></button>;
  const stops = Array.from({ length: 13 }, (_, index) => shadeColor(base, index * 100 / 12));
  return <ColorPicker open={open} disabled={disabled} disabledAlpha={disabledAlpha} value={opacity < 1 ? `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}` : color} placement="bottomRight" arrow={false} destroyOnHidden
    onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) { window.dispatchEvent(new CustomEvent("drag-visual:color-picker-open", { detail: pickerId })); setRecent(readRecentColors()); setBase(color); setPosition(50); pending.current = { color, opacity }; } else setExpanded(false); }}
    onChange={(next) => { const value = { color: next.toHexString().slice(0, 7).toLowerCase(), opacity: next.toRgb().a }; setBase(value.color); setPosition(50); change(value); }}
    onChangeComplete={(next) => setRecent(rememberColor({ color: next.toHexString().slice(0, 7).toLowerCase(), opacity: next.toRgb().a }))}
    panelRender={(_, { components: { Picker } }) => open ? <div className="color-palette" aria-label={`${label}调色面板`}>
      <div className="color-palette__colors color-palette__base">{paletteColors.map((next, index) => swatch({ color: next, opacity }, index, "选择颜色"))}</div>
      <div className="color-palette__tone">
        <div className="color-palette__scales">
          <input className="color-palette__shade" aria-label={`${label}颜色深浅`} type="range" min={0} max={100} value={position} style={{ background: `linear-gradient(to right, ${stops.join(", ")})` }} onChange={(event) => { const next = Number(event.target.value); setPosition(next); change({ color: shadeColor(base, next), opacity: pending.current.opacity }); }} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
          {!disabledAlpha && <input className="color-palette__alpha" aria-label={opacityLabel} title={`不透明度 ${Math.round(opacity * 100)}%`} type="range" min={0} max={100} value={Math.round(opacity * 100)} style={{ background: `linear-gradient(to right, transparent, ${color}), repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 0 / 6px 6px` }} onChange={(event) => change({ color: pending.current.color, opacity: Number(event.target.value) / 100 })} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />}
        </div>
        <div className="color-palette__current" title={`${color} · ${Math.round(opacity * 100)}%`}><span style={{ background: color, opacity }} /></div>
        <div className="color-palette__tools">
          <Tooltip title={EyeDropper ? "屏幕取色" : "当前浏览器不支持屏幕取色"}><Button type="text" size="small" aria-label={`${label}屏幕取色`} disabled={!EyeDropper} icon={<HighlightOutlined />} onClick={() => { void sample(); }} /></Tooltip>
          <Button type="text" size="small" aria-label={`${label}自定义颜色`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span className="color-palette__wheel" /></Button>
        </div>
      </div>
      {expanded && <Picker />}
      <div className="color-palette__recent-heading"><span>最近使用 <Tooltip title="在各个颜色选择器之间共享，保留颜色和透明度"><InfoCircleOutlined /></Tooltip></span><button type="button" aria-label="重置" onClick={() => { setRecent([]); try { localStorage.removeItem(recentColorsKey); localStorage.removeItem("drag-visual.table-text-recent-colors"); } catch { /* Optional storage. */ } }}><ReloadOutlined /> 重置</button></div>
      <div className="color-palette__colors">{Array.from({ length: 12 }, (_, index) => recent[index] ? swatch(recent[index]!, index, "最近使用颜色") : <span key={index} className="color-palette__empty" />)}</div>
    </div> : null}>
    <Button aria-label={ariaLabel} data-color={color} disabled={disabled} className={`color-palette-trigger color-palette-trigger--${trigger}`} size="small">{trigger === "text" ? <span className="color-palette-trigger__letter" style={{ borderBottomColor: color }}>A</span> : <span className="color-palette-trigger__swatch"><span style={{ background: color, opacity }} /></span>}<DownOutlined /></Button>
  </ColorPicker>;
};
