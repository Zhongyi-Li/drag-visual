import type { Dashboard } from "@drag-visual/contracts";

type OfficialTheme = { readonly id: Exclude<NonNullable<Dashboard["theme"]["preset"]>, "custom" | "minimal">; readonly label: string; readonly thumbnail: string; readonly primaryColor: string; readonly backgroundColor: string; readonly mode: "light" | "dark"; readonly chartPalette: readonly string[] };
/** Official presets apply a page palette and light/dark presentation. */
export const dashboardThemePresets: readonly OfficialTheme[] = [
  { id: "default", thumbnail: "default-v2.png", label: "默认", primaryColor: "#1677ff", backgroundColor: "#f0f4fa", mode: "light", chartPalette: ["#1677ff", "#36cfc9", "#9254de", "#fa8c16", "#13c2c2", "#eb2f96"] },
  { id: "deepBlue", thumbnail: "deep-blue-v2.png", label: "深蓝", primaryColor: "#38bdf8", backgroundColor: "#08152f", mode: "dark", chartPalette: ["#38bdf8", "#60a5fa", "#2dd4bf", "#a78bfa", "#fbbf24", "#fb7185"] },
  { id: "technology", thumbnail: "technology-v3.png", label: "科技", primaryColor: "#427be0", backgroundColor: "#2164df", mode: "light", chartPalette: ["#427be0", "#45cfc4", "#379abe", "#66b8c9", "#82cbd1", "#4767a8"] },
  { id: "activity", thumbnail: "activity.png", label: "活动", primaryColor: "#ff7a18", backgroundColor: "#ff8844", mode: "light", chartPalette: ["#ff7a18", "#ffc21c", "#8c86fa", "#66a5f5", "#4ccf92", "#f95d78"] },
];
