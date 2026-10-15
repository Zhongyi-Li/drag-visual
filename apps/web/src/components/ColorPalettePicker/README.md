# ColorPalettePicker

统一颜色选择器：基础色、连续深浅色阶、透明度、屏幕取色（浏览器支持时）、自定义 HEX/RGB/HSB 输入和跨控件共享的最近使用颜色。

受控用法：

```tsx
<ColorPalettePicker
  label="背景"
  color={settings.color}
  opacity={settings.opacity ?? 1}
  onChange={({ color, opacity }) => update({ color, opacity })}
/>
```

`color` 为六位 HEX RGB，`opacity` 为 0–1，默认 1。调用方负责保存两个值并应用到渲染样式；不要用整个容器的 opacity 代替颜色透明度。
`trigger="text"` 显示带颜色下划线的 A，默认 `swatch` 显示色块。纯色配置可传 `disabledAlpha`，隐藏透明度控制，并在复用最近颜色时恢复为不透明。支持 `disabled`、`ariaLabel`、`opacityLabel`。
最近使用保存在当前浏览器 localStorage 中，最多 12 项，同时记录颜色和透明度；重置只清空历史，不修改当前颜色。色阶/透明度拖动时实时更新，在结束或键盘调整后记录历史。
