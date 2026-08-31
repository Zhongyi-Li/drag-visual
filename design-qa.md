# 图表跳转设置弹窗：设计 QA

**Comparison target**

- Source visual truth: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-ce5f08e1-4823-4d0d-9a1f-d713fb8267b6.png`（用户提供的目标交互参考）。
- Implementation: `apps/web/src/features/editor/ChartJumpConfigurationPanel.tsx` 的居中 `Modal` 实现。
- Intended viewport/state: 桌面端，打开“图表跳转设置”并编辑一条跳转规则。

**Evidence**

- The component test opens the dialog, verifies the `chart-jump-modal` class, chooses a target dashboard, and saves the rule successfully.
- `pnpm --filter @drag-visual/web typecheck` passes.
- A browser-rendered implementation capture is unavailable: the local application redirects to its login screen, and no authenticated local session was supplied. Therefore the target configuration flow cannot be entered for a like-for-like visual capture.

**Findings**

- No code-level P0/P1/P2 findings. The implementation replaces the bottom drawer with a centered 860px modal, retains the rule sidebar, and keeps the form controls and confirmation workflow intact.
- [P3] The exact in-product backdrop, type rendering, and vertical crop still need an authenticated browser pass.

**Required fidelity surfaces**

- Fonts and typography: inherited from the existing Ant Design/editor typography; browser rendering not captured.
- Spacing and layout rhythm: modal header 52px, rule rail 196px, content padding 24–28px, and one footer action row were reviewed from implementation.
- Colors and visual tokens: existing editor neutrals and primary blue selection state are preserved.
- Image quality and asset fidelity: no raster or custom visual assets are used in this modal.
- Copy and content: labels, helper copy, empty states, and confirmation text are preserved.

**Implementation checklist**

1. Open an authenticated editor with a chart that has a numeric metric.
2. Open “图表跳转设置”; verify the centered modal at the target desktop viewport.
3. Switch rules, select a target dashboard, set an open mode, and confirm save.

**Comparison history**

- Iteration 1: code and component-test verification completed; browser comparison is blocked by the authentication gate.

final result: blocked

---

# Latest QA — 单图表日期筛选配置

- Source visual truth: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-c7ec65f3-50a1-4c59-b5a6-fd92a7064238.png` 与 `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-a6eb8eeb-2348-4d00-bd68-7524f77b8fd9.png`。
- Implementation route: 本地预览 `http://127.0.0.1:4174/editor/d49e1d9a-876d-4d6b-811a-4a7a7ab7027b`，选中“月度收入”后进入「分析」。

**Findings**

- [P1] 已修复：日期默认展示范围在右侧直接配置。绑定“业务日期”后，显示字段摘要、当前默认范围和“全部 / 本月 / 上月 / 自定义”四项预设，不再打开底部大抽屉，也没有“完成”按钮。
- [P1] 已验证：点击“自定义”只在该按钮旁展开紧凑的日期范围选择器；选择完成后即时写入配置。
- [P2] 已补齐：未绑定日期字段时显示直接操作引导，避免用户误以为需先打开配置弹窗。

**Required fidelity surfaces**

- Typography: 预设、字段摘要和辅助说明保持右侧配置面板的 11–12px 信息层级。
- Spacing and layout rhythm: 默认范围组合为单张紧凑卡片，四个预设等宽排列；自定义内容采用约 286px 宽浮层。
- Colors and visual tokens: 选中态使用浅蓝和主蓝，字段绑定状态复用既有绿色状态标签。
- Copy and content: “默认展示”明确表意，未配置态明确指出下一步操作。

**Verification**

- `DateFilterConfigurationPanel.test.tsx`: 6/6 passed。
- `@drag-visual/web typecheck`: passed。
- 本地预览中已验证“业务日期”绑定、预设直配、紧凑自定义浮层三种状态。

final result: passed

---

# Latest QA — 单图表筛选器紧凑化

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-81421776-96a6-4f3c-acba-f0f0aa00ef16.png`（831 × 980 px）。
- Implementation capture: `/private/tmp/query-filters-compact-implementation.png`（1280 × 720 px，CSS viewport 1280 × 720，device scale factor 1）。
- State: 单个柱图，已打开“图表筛选器配置”，包含一条“月份”文本筛选条件；该状态与参考图的“渠道”条件使用同一配置结构。

**Evidence and comparison**

- 在同一轮视觉输入中比较参考图和本地浏览器截图。实施抽屉为 680px 宽，较原 820px 规格收窄约 17%；左侧条件轨道实测 216px，右侧编辑区 464px。
- 编辑区下拉控件实测高度 34px；新增条件、切换“下拉选择／输入框”、筛选值控件切换均在浏览器中完成。
- `QueryFiltersPanel.test.tsx` 4/4、Web 类型检查与 `git diff --check` 均通过。控制台只见项目已有的 Ant Design Drawer 弃用提示，未见本次改动引入的运行时错误。

**Findings**

- No actionable P0/P1/P2 differences. 单图表场景的边界更紧凑，左侧新增按钮和条件卡片去除重阴影，右侧字段、控件类型、匹配方式和筛选值采用更低的视觉重量；复合分析筛选器仍保留原有较宽工作区。
- [P3] 在很窄的桌面窗口中，标题说明会按既有响应式规则隐藏；主标题和完成按钮保留，不影响任务完成。

**Required fidelity surfaces**

- Fonts and typography: 主标题调整为 18px；区块标签 12px，条件卡标题 12px，辅助文案 10–12px，保持清晰但不抢占编辑面积。
- Spacing and layout rhythm: 68px 头部、216px 条件轨道、20–24px 编辑内边距；控件与区块间距由 18px 收敛为 14px。
- Colors and visual tokens: 沿用产品蓝 `#1677ff`；选中项使用低饱和浅蓝底，分隔线采用中性浅灰，移除强投影。
- Image quality and asset fidelity: 无新增图像资产；使用现有 Ant Design 图标。
- Copy and content: 保留“新增筛选条件”“控件类型”“匹配方式”“筛选值”等现有业务文案与筛选行为。

**Comparison history**

- Iteration 1: 参考状态中 820px 宽抽屉及 70px 控件选择卡，对单图表场景显得过于宽松。
- Iteration 2: 单图表抽屉收窄至 680px，控件统一为 34px／54px 紧凑节奏，并完成浏览器截图和交互核验；无 P0/P1/P2 遗留。

final result: passed

---

# Latest QA — 图表筛选器条件卡片图标

- Source visual truth: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-f4059f0e-8772-4666-8780-47dbc3782c1a.png`（单图表筛选器配置抽屉左侧条件列表）。
- Implementation route: `http://127.0.0.1:5173/`；浏览器实际捕获到登录页，无法进入含筛选条件卡片的同一交互状态。
- Implemented change: `QueryFiltersPanel.tsx` 将条件卡片中代表条件操作的 `FormOutlined` 替换为 Ant Design 的 `FilterOutlined`；拖拽、卡片选中和更多操作保持不变。

**Findings**

- [P1] 视觉比较受登录态阻断：当前本地预览无法进入筛选器配置抽屉，不能与参考截图进行同屏核验。

**Required fidelity surfaces**

- Fonts and typography: 未改动。
- Spacing and layout rhythm: 未改动图标槽位尺寸或卡片结构。
- Colors and visual tokens: 复用现有 Ant Design 图标颜色和激活态。
- Image quality and asset fidelity: 无图像资产变更；采用现有 Ant Design 图标库。
- Copy and content: 未改动。

**Implementation Checklist**

1. 登录本地预览后，打开任一图表的“筛选条件”配置抽屉。
2. 核对左侧条件列表展示漏斗图标，并确认选中态和更多操作正常。
3. `pnpm exec vitest run apps/web/src/features/editor/QueryFiltersPanel.test.tsx` 已通过（4/4）。

final result: blocked

---

# Latest QA — 大盘任务进度看板背景层级收敛

- Source visual truth: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-f0f87253-d05a-4d17-a568-383789a8ed80.png`（用户提供的设计稿）。目标为一个统一的白色图表画布，仅由细分隔线区分表头、行和说明区域。
- Before-change evidence: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-937c2697-d5a0-4240-b9cd-6ee742a48234.png`（用户提供的当前实现）。可见组件浅蓝底、白色表格、浅蓝表头和浅蓝页脚叠加，造成多层卡片感。
- Implementation capture: `/private/tmp/drag-visual-goal-background-qa.png`（CSS viewport 600 × 776）。刷新后的真实预览停留在“正在加载目标任务进度”，无法获得更新后的完整数据态截图。

**Findings**

- [P1] 已修复：组件根层、表头、行和权重栏统一为白色；移除表格阴影，分隔线统一为中性 `#e8eef6`。指标标签与进度色仍保留为语义色，不再作为大面积背景层。
- [P2] 最终真实数据态的浏览器视觉对比受预览持续加载阻断，无法完成设计稿与更新后截图的同屏比较。

**Required fidelity surfaces**

- Fonts and typography: 标题、表头和数值层级未改动。
- Spacing and layout rhythm: 行高、列距与圆角未改动；移除阴影后表格不再形成额外卡片边界。
- Colors and visual tokens: 大面积背景收敛为白色；浅蓝仅保留给信息芯片、进度轨道和选中行等语义状态。
- Image quality and asset fidelity: 未新增或替换图像资产；继续使用现有 Ant Design 图标。
- Copy and content: 指标、筛选和权重文案未改动。

**Comparison history**

- Iteration 1: 当前实现存在浅蓝根层、白表格、浅蓝表头与页脚共四类大面积底色，判为 P1 层级噪音。
- Iteration 2: 合并为单一白色图表画布并降低分隔线对比；自动化渲染测试通过。真实预览因加载态未能完成最终同屏验证。

**Implementation Checklist**

1. 在预览能够加载数据后，检查表头、行、权重栏与图表空白区域是否为统一白底。
2. 验证只保留行分隔线与状态芯片的浅色，不再出现额外蓝色卡片底。

final result: blocked

---

# Latest QA — 全局筛选器配置工作台

**Comparison target**

- Selected visual direction: `/Users/ethan/.codex/generated_images/01a032ff-b827-7181-8d6e-93bd10dced40/exec-3961dae6-3ed3-4080-9486-ffd524122944.png`（方案 1：筛选条件集合、条件配置、联动图表三段式工作台）。
- Implementation: `apps/web/src/features/editor/DashboardHeaderPanel.tsx` 的全局筛选器配置抽屉与 `apps/web/src/features/editor/editor.css`。
- Tested state: 本地 mock 编辑器，已绑定销售数据的柱图；从“月份”字段创建全局筛选条件，并检查控件与联动清单。

**Evidence**

- 浏览器实际打开抽屉，确认“新增筛选条件”会列出来自已绑定图表数据源的“月份”和“业务日期”；选择“月份”后立即出现下拉／输入框控件选择、匹配方式和“柱图”联动复选项。
- 窄屏浏览器实测：空状态由占满工作区的引导态替代原先的大面积空白；已配置状态按单列顺序展示，未发生文字溢出或布局位移。
- `pnpm vitest run apps/web/src/features/editor/DashboardHeaderPanel.test.tsx`、`pnpm --filter @drag-visual/web typecheck` 与 `git diff --check` 均通过。

**Findings**

- No actionable P0/P1/P2 differences. 已保留 SloganBi 的蓝色信号色，同时以轻分隔线、信息层级和配置卡替代传统的大表单布局。
- 交互改进：新增字段可搜索、重复字段不会再次出现；日期字段固定为日期范围，普通维度可在“下拉选择／输入框”间切换；删除与已关联数量直接反馈在当前工作区。

**Required fidelity surfaces**

- Typography and hierarchy: “筛选条件／配置筛选条件／联动图表”三段标题区以深靛主层级和 12px 辅助信息区分。
- Spacing and layout: 桌面端为三列工作流；920px 以下将联动区转入第二列下方，680px 以下转为单列流式布局。
- Colors and tokens: 主操作使用既有 `#1677ff`，选中状态为浅蓝底与蓝色左侧信号条，分隔面使用低对比中性色。
- Copy and content: 空状态明确下一步；字段来源、匹配方式、控件行为和联动数量均为真实配置数据。

**Comparison history**

- Iteration 1: 空状态只显示左侧栏，剩余区域留白过多。
- Iteration 2: 加入全工作区引导态；发现窄屏正文因 flex intrinsic sizing 被逐字折行。
- Iteration 3: 为空态内容及文字设置完整可用宽度，再次浏览器验证后无布局问题。

final result: passed

---

# 图表标题文本样式 QA

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-a2752ea0-7437-4edc-aedb-b1f6ab124cdb.png`（标题可见性、文字、颜色、字号、粗斜体与对齐控制）。
- Intended implementation: 编辑器“展示方式 → 标题与卡片”内的标题设置；应用到编辑器卡片标题及预览/发布看板。
- Browser state: 本地应用已可访问，但重定向至登录页，无法进入已认证编辑器并捕获同一交互状态。

**Evidence**

- `ComponentTitlePanel` 定向测试验证显示开关、18px 字号、粗体、居中对齐会完整保存。
- 编辑器、预览/发布画布共享同一 `titleStyle` 数据，字体样式不会只停留在配置面板。
- `pnpm --filter @drag-visual/web typecheck` 与 `git diff --check` 通过。

**Findings**

- [P2] 最终浏览器视觉对照受本地登录状态阻断，未能捕获已打开“标题与卡片”面板的实施截图。
  Location: Product Design visual QA.
  Evidence: 本地地址显示 SloganBi 登录入口，未提供可登录的本地测试会话。
  Impact: 无法核对截图中的紧凑工具栏密度、Ant Design 控件细节和编辑器即时预览。
  Fix: 在已登录的本地编辑器中打开任一图表的“展示方式 → 标题与卡片”，再进行同视图截图比较。

**Required fidelity surfaces**

- Fonts and typography: 默认保持原有 13px 常规标题；配置可在 12–32px 之间调整，并支持粗体和斜体。
- Spacing and layout rhythm: 控件采用标题行、文本样式行的紧凑排列，避免侧栏形成大表单。
- Colors and visual tokens: 默认标题色为产品既有 `#262626`，可由作者调整。
- Image quality and asset fidelity: 不涉及图像资产；使用项目现有 Ant Design 图标。
- Copy and content: 保留“显示主标题”“标题”“文本”等与参考交互一致的中文语义。

**Comparison history**

- Iteration 1: 数据模型、编辑/查看渲染与定向交互测试完成；真实编辑器截图因认证入口阻断。

final result: blocked

---

# Latest QA — 蓝色大盘任务进度看板

**Comparison target**

- Source visual truth: `/Users/ethan/.codex/generated_images/01a040df-855a-7542-92bd-87626d58804e/exec-913c97e9-32fe-43ac-87e2-c621d7fdbf2e.png`（1983 × 793 px）。用户确认的蓝色宽屏任务进度设计，包含排名、渠道、GMV、毛利、库存周转和综合完成环。
- Implementation capture: `/private/tmp/drag-visual-goal-task-progress-qa.png`（1280 × 720 px，浏览器 CSS viewport 1280 × 720）。状态为编辑器内已绑定 SKU、库存指标和月度目标；组件处于紧凑画布，因此通过横向滚动访问完整的六列任务信息。

**Evidence**

- 实现保留设计稿的浅蓝工作区、白色圆角表面、蓝/绿/橙三组进度语义、排名圆形徽标、状态标签和蓝色综合完成环。
- 宽表在 454 CSS px 编辑器画布中测得 `scrollWidth: 960`、`clientWidth: 454`，横向滚动后可访问“毛利”“库存周转”“综合完成”列；未再裁掉不可达内容。
- 任务周期切换、月份选择、自定义目标、评分权重以及行选中状态均在浏览器中完成实际交互核对。
- 浏览器控制台仅发现项目已有的 Ant Design Drawer `width` 弃用提示；本组件未新增运行时错误。

**Focused-region comparison**

- 已分别打开设计稿与浏览器实施截图，但未能完成同一视觉输入的并排比较：浏览器安全策略拒绝打开本地 data URL 比较页。该策略限制后未再尝试绕过。

**Findings**

- [P2] 最终并排视觉比较受浏览器 URL 策略阻断。
  Location: Product Design visual QA.
  Evidence: 设计稿和实施截图均已捕捉，但浏览器拒绝 data URL 对比页。
  Impact: 无法按设计 QA 流程确认最后一轮视觉差异。
  Fix: 在允许并排本地图片比较的会话中重新打开两份证据，再完成最终 QA 判定。

**Required fidelity surfaces**

- Fonts and typography: 实现使用系统 UI 字体，标题 20px、表头 12px、数据 13–16px；紧凑画布中存在预期的横向滚动，而非缩小或截断文本。
- Spacing and layout rhythm: 宽屏表格使用 20px 列距、14px 行内边距、14px 圆角；紧凑状态将完整表格放入可滚动轨道。
- Colors and visual tokens: 主色 `#2563eb`，毛利绿色 `#10b981`，周转橙色 `#f97316`，背景 `#f5f9ff`，与已选蓝色方向一致。
- Image quality and asset fidelity: 未新增图像资产；使用 Ant Design 图标表达指标含义，避免替代性手绘图形。
- Copy and content: 保留“目标任务进度”、周期、目标、权重等现有业务文案；列名更新为 GMV、毛利、库存周转、综合完成。

**Implementation Checklist**

1. 绑定员工/渠道维度与 GMV、毛利、库存周转等实际指标。
2. 通过“自定义目标”维护目标值，再在宽屏看板查看完整的六列进度。
3. 在支持并排本地图片比较的浏览器会话中重做最终视觉 QA。

**Comparison history**

- Iteration 1: 紧凑编辑器画布中宽表的右侧列被 `overflow: hidden` 裁掉，属于 P2 信息不可达问题。
- Iteration 2: 将任务表最小宽度固定为 920px，并由外层提供横向滚动；浏览器实测右侧列可访问。最终并排比较因浏览器 URL 安全策略受阻。

final result: blocked

---

# Latest QA — 全局筛选器配置抽屉：参考稿一致性修正

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-8ec47e31-5051-4e43-9195-2666938e4980.png`（2163 × 727 px）。
- Implementation capture: `/private/tmp/global-filter-drawer-side-implementation.png`（1920 × 820 px），浏览器 CSS viewport 为 1920 × 820。
- The user explicitly approved the only intentional framing difference: the source's full-width workspace is rendered as a 1380px right-side drawer, keeping the editor visible instead of forcing the configuration view to fill the screen.

**Evidence and comparison**

- The final drawer keeps the reference layout's three-column hierarchy: filter-condition list, active-condition editor, and linked-chart table. The column ratio, header title/subtitle, primary add action, selected-card treatment, condition controls, destructive action, and tabular linkage rows are all represented in the implementation.
- The reference capture is in a date-filter state with eight charts; the verification capture is in a non-date field state with one mock bar chart. Those data-dependent differences appropriately change the visible controls and row count while preserving the same layout and interaction model.
- A full source/implementation visual pair was inspected together after the responsive 1920px verification pass. No misalignment, clipping, or low-fidelity asset substitution was found.

**Functional verification**

- `pnpm vitest run apps/web/src/features/editor/DashboardHeaderPanel.test.tsx` passed, including adding a filter, switching its control type, and linking all eligible charts.
- `pnpm --filter @drag-visual/web typecheck` passed.
- `git diff --check` passed.

**Required fidelity surfaces**

- Fonts and typography: title, secondary explanation, condition labels, table headers, and status labels follow the reference's clear hierarchy.
- Spacing and layout rhythm: the drawer uses the reference's three-panel rhythm while remaining bounded to 1380px as approved.
- Colors and visual tokens: the primary blue action, selected card tint, neutral dividers, restrained red delete action, and linked status remain consistent with the reference.
- Image quality and asset fidelity: this interface has no raster assets; existing vector icons are used consistently.
- Copy and content: source terminology such as “筛选条件”“配置筛选条件”“联动图表”“已表联动” is retained; the supporting drawer subtitle clarifies scope without changing behavior.

**Comparison history**

- Iteration 1: the existing full-screen/bottom-sheet treatment and simplified list did not match the reference's structured three-column workbench; classified as P1.
- Iteration 2: rebuilt the workbench inside an approved right-side drawer, added condition cards and linkage-table structure, then compared at desktop width. No P0/P1/P2 issues remained.

final result: passed

---

# 目标任务进度：业务指标表与配置弹窗 QA

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-f9a664ff-f495-447f-b94a-630b3ec38ec2.png`（业务中的目标进度表）、`/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-4b7ad9e9-42a4-4124-abc8-24376eb9737d.png`（目标配置）与 `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-048c6b87-91cf-4e88-83b2-58f45af34081.png`（评分权重配置）。
- Implementation: `packages/chart-renderer/src/DashboardComponentRenderer.tsx` 的 `GoalTaskProgressSurface`，以及 `packages/chart-renderer/src/options.ts` 的字段识别与目标/权重模型。
- Intended viewport/state: 桌面端，2026 年 8 月，员工数据含 GMV、销量、毛利和周转天数。

**Evidence**

- 定向组件测试验证了完整表头、“自定义目标”弹窗保存，以及“评分权重设置”弹窗打开；自动映射测试验证了无显式指标绑定时能识别 GMV、销量、周转天数、对应目标、毛利和默认 30% / 55% / 15% 权重。
- `pnpm --filter @drag-visual/component-registry typecheck` 与 `pnpm --filter @drag-visual/chart-renderer typecheck` 均通过。
- 本地 API 与 Web 开发服务正在运行，但本轮未获用户指定可用于截图的浏览器会话；因此无法取得实施截图并与三张参考图放入同一视觉比较输入。

**Findings**

- 已完成的业务对齐：月度/年度切换与年/月选择器；员工、评分、GMV 实际/目标、销量实际/目标、毛利、GMV 完成率、销量完成率、周转天数列；按员工配置月度/年度 GMV 与销量目标、周转天数目标；可独立调整评分权重且总和必须为 100% 才能保存。
- [P3] 仍需在已登录的真实看板中确认横向表格在目标画布宽度下的列密度与 Ant Design Modal 的最终视觉细节。

**Comparison history**

- Iteration 1: 完成数据模型、组件交互与定向测试；浏览器并排视觉比较因没有用户指定的浏览器会话而阻塞。

final result: blocked

---

# Latest QA — 指标预警规则：现代化配置卡

**Comparison target**

- Source visual truth: `/Users/ethan/.codex/generated_images/01a017f6-5ced-72e2-ab2f-69552c160c4d/exec-cfadb685-f9e3-418b-9887-c3e57667a60d.png`；实施截图：`/private/tmp/metric-alert-rule-implementation.png`。
- Focused source and implementation captures (`/private/tmp/metric-alert-rule-reference-panel.png` 与 `/private/tmp/metric-alert-rule-implementation-panel.png`) 已在同一比较输入中打开并审阅。源图为 1536 × 1024 px，实施浏览器视口为 1280 × 784 CSS px，device scale factor 为 1。

**Findings**

- No actionable P0/P1/P2 differences. 宽卡概念的色彩、层级、圆角、阴影、字段语义色及暖橙反馈面板，已以两列响应式布局落到真实窄侧栏。
- 预期差异：生产侧栏不展示未经数据查询计算的“待关注”静态数量，改为“预览查看”，避免误导。

**Required fidelity surfaces**

- Fonts and typography: 现有 Inter / PingFang SC 字体栈与 15px 标题、11–13px 辅助/控件层级匹配窄侧栏密度。
- Spacing and layout rhythm: 16px 卡片内边距、12px 圆角、8px 表达式网格与 14px 分区间距均经过浏览器检查。
- Colors and visual tokens: 蓝色维度、绿色指标和橙色预警语义沿用产品现有 token。
- Image quality and asset fidelity: 没有非标准图像资产；图标来自项目已有 Ant Design 图标库。
- Copy and content: 维度、指标、聚合、条件、阈值和单位均为真实配置；条件下拉与阈值输入已完成浏览器交互验证。

**Implementation Checklist**

1. 绑定预警维度和指标。
2. 选择条件并填写阈值。
3. 在预览中确认命中高亮和详情入口。

**Follow-up Polish**

- [P3] 侧栏扩宽时可启用概念稿的一行连线式规则表达。

final result: passed

---

# Latest QA — 商品动销排行

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-021116b8-dda7-49d6-9a99-e32ea6f70846.png`（1849 × 166 px）。目标为商品两行条形排行：销售额／销量使用实色前景条，库存金额／库存数量提供浅色全宽底条，最右侧并列展示“销 / 库”数值。
- Implementation capture: `/private/tmp/product-movement-ranking-implementation-final.png`。浏览器 CSS viewport 为 1512 × 765；状态为真实编辑器画布中的两个商品演示数据项，使用项目实际注册、字段绑定、聚合和渲染链路。

**Evidence**

- 浏览器实测的组件语义内容包含四个图例、商品“小米／创维”、每项“金额／数量”双行，以及销售与库存金额、件数的完整右侧文案。
- 金额与数量分别使用蓝色／绿色前景条和对应浅色库存底条；库存轨道固定为可用全宽，避免库存较低时失去“底色条”识别。
- `pnpm --filter @drag-visual/component-registry test -- registry.test.ts`、`pnpm --filter @drag-visual/contracts test -- dashboard.test.ts`、`pnpm --filter @drag-visual/chart-renderer exec vitest run src/DashboardComponentRenderer.test.tsx`、`pnpm --filter @drag-visual/web exec vitest run src/features/datasets/datasetAggregation.test.ts`、两个包的 build 和 `git diff --check` 均通过。

**Focused-region comparison**

- 参考图和最终实现截图已在同一次视觉检查输入中一并审阅。实现处于编辑器画布，因而可用宽度小于参考图的全页宽度；两者均保持“商品名—双行指标—右侧数值”的三列结构。
- 图例顺序、色彩语义和每行的轻边框圆角容器与参考一致；浅蓝／浅绿库存轨道完整铺满行宽，蓝／绿销售条叠加在上方。

**Findings**

- No actionable P0/P1/P2 differences. 编辑器画布中的宽度收缩属于容器响应式行为，不影响全宽看板与查看页的横向伸展。

**Required fidelity surfaces**

- Fonts and typography: 商品名和右侧数值使用紧凑的正文层级；“金额／数量”使用较小的辅助层级。
- Spacing and layout rhythm: 每个商品项使用 8px 级别内边距与间隔，双行轨道保持紧凑且可扫读。
- Colors and visual tokens: 销售额蓝、库存金额浅蓝、销量绿、库存数量浅绿与参考图保持同一语义配对。
- Image quality and asset fidelity: 无新增栅格或矢量资产。
- Copy and content: 组件名称、字段槽位、图例和“销 / 库”文案均使用中文业务语境。

**Comparison history**

- Iteration 1: 库存条曾按库存数值缩放，第二行会留下明显空白，不符合参考图作为底色轨道的表达。
- Iteration 2: 将库存条固定为全宽轨道，并保留销售条按其指标数据缩放；小额金额改为直接显示货币数值，避免不必要地转换为“万”。最终复查无 P0/P1/P2。

**Implementation Checklist**

1. 在编辑器左侧“柱/条图”分类选择“商品动销排行”。
2. 绑定商品、销售额、库存金额、销量、库存数量五个字段。
3. 确认每个商品出现“金额／数量”两行、库存浅色底条及右侧“销 / 库”数值。

final result: passed

---

# Dashboard home command-center implementation QA

## Comparison target

- Source visual truth: `/Users/ethan/.codex/generated_images/01a03167-eb52-7e52-9d74-128c341996f9/exec-c963bc3e-2987-4839-a146-3881c8d2cb2d.png` (the user-selected third design direction).
- Implementation route: `http://localhost:5173/`.
- Intended viewport/state: desktop dashboard home with an authenticated account and populated board list.

## Verification status

- The implementation updates the existing dashboard home without changing the API contract: a most-recent dashboard band, active status filters, recent/name sorting, compact two-column board directory, real embedded dashboard thumbnails, and the existing create/edit/overflow actions.
- TypeScript check passed.
- Focused `DashboardHome` test suite passed: 10 tests.
- Browser-rendered dashboard-home capture and source/implementation visual comparison are blocked because the available local browser session is at the application login screen and no authenticated session or test credentials were supplied.

## Required fidelity surfaces pending browser validation

- Typography: verify the title, recent-dashboard band, filter labels, and compact row metadata at desktop scale.
- Layout rhythm: verify the recent band and two-column directory fit the viewport without clipping.
- Colors/tokens: verify the restrained SloganBi blue, status tags, and neutral surfaces against the selected visual.
- Image quality: verify the existing live iframe dashboard thumbnails load at the intended crops.
- Copy/content: verify populated dashboard names, dates, counts, and published/draft states.

## Implementation checklist

- [x] Apply the selected command-center hierarchy to the dashboard home.
- [x] Preserve search, create, card navigation, publish controls, and account controls.
- [x] Add working status filter and sort controls.
- [x] Pass static type and focused behavior checks.
- [ ] Capture the authenticated desktop page, compare it with the selected reference, and resolve any P0/P1/P2 visual differences.

final result: blocked

---

# Latest QA — SloganBi 登录页与看板中心

**Comparison target**

- Source visual truth: `/Users/ethan/.codex/generated_images/01a02382-c9b6-72f0-8608-0c5b9fb8ac85/exec-1cb2a0bc-8cea-43f5-b78d-04fbc8bc6d07.png`（用户选择的方案 1）。
- Implementation captures: `/private/tmp/sloganbi-login-implementation.png` 与 `/private/tmp/sloganbi-dashboard-implementation.png`。
- Full-view comparison evidence: `/private/tmp/sloganbi-design-qa-comparison.png`；同一比较输入依次包含选定视觉稿、真实登录页与真实看板中心。
- Viewport and normalization: 源图为 1487 × 1058 px；登录页实施为 1280 × 804 px，看板中心实施为 1280 × 720 px；浏览器密度为 1。源图将两页放在一个展示画布内，实施按真实路由分别呈现，因此按页面结构、品牌、色彩和关键控件层级对照，而非把展示板强行拼成单页。

**Evidence**

- 实际浏览器登录使用本地 mock 账号 `slogan_demo` 后进入看板中心；品牌 Logo、标题、账号/密码输入、记住我、登录按钮、看板搜索和新建仪表板入口均可见且可操作。
- 搜索“不存在的看板”后显示空状态；搜索“未命名”后返回 2 个看板。既有 `DashboardHome` 定向测试及 mock handler 测试共 40 项通过，Web TypeScript 检查和 `git diff --check` 通过。
- 浏览器控制台仅保留既有 Ant Design `Alert.message` 弃用警告；本次页面没有运行时错误。

**Focused-region comparison**

- Logo、登录表单和看板头部在比较图中均以可辨识尺寸呈现。品牌改用真实生成的 `sloganbi-logo.png` 资产；没有以 CSS、字符或手绘 SVG 代替所选的品牌图形。
- 选定稿的看板缩略图来自含真实指标数据的概念内容；本地 mock 中的草稿看板没有组件，因此 iframe 预览为空白。卡片框架、标题、状态、操作和网格关系均由真实产品组件渲染。

**Findings**

- No actionable P0/P1/P2 differences. 登录页沿用方案 1 的冷白、蓝紫数据背景、深靛标题和醒目蓝色主操作；看板中心保留同一 Logo、顶部搜索、宽松标题区和低边界噪声的卡片网格。
- [P3] 如需让本地演示与概念稿的缩略图内容完全一致，可再为 mock 看板预置带图表组件的数据；这不影响生产中 iframe 对真实看板内容的呈现。

**Required fidelity surfaces**

- Fonts and typography: Inter / PingFang SC / Microsoft YaHei 字体栈；登录标题采用高权重深靛层级，表单与帮助信息保持 14–15px 可读密度；看板标题、搜索和卡片元信息的层级清晰。
- Spacing and layout rhythm: 80px 品牌头部、登录页双栏 26px 圆角承载面、看板 72px 顶栏、48px 主内容上边距和 20px 卡片间距与所选方向一致。
- Colors and visual tokens: 冷白与浅蓝背景、`#245af1` 主操作、靛蓝文字、细灰分割线与源图的蓝紫信号系统一致；对比度满足正文与操作可读性。
- Image quality and asset fidelity: 使用生成的透明 SloganBi Logo PNG，尺寸与清晰度适合顶部品牌位置；登录背景复用已有的真实数据网格图，而非 CSS 绘制替代品。
- Copy and content: 所有 ZHBi 对用户可见的品牌文案已改为 SloganBi；登录和看板中心的功能性文案保留中文 BI 语境。

**Comparison history**

- Iteration 1: 登录视觉、看板头部、搜索和卡片网格已浏览器验证；发现本地 mock 登录不具备会话处理，无法进入看板中心。
- Fix: 为现有 MSW mock 补充局部登录、注册、会话恢复和登出响应；重新启动 mock 预览后，登录、搜索和看板访问均通过。
- Iteration 2: 使用真实路由捕获登录页和已登录看板中心，并与所选视觉放入同一比较输入；无 P0/P1/P2 待修复项。

**Implementation checklist**

1. 在登录页输入任意符合规则的 mock 账号与密码并登录。
2. 在看板中心搜索“未命名”，确认结果卡片保留；搜索一个不存在的名称，确认空状态出现。
3. 点击“新建仪表板”，确认进入已有编辑流程。

**Follow-up polish**

- [P3] 为演示数据添加 2–3 个含图表的示例看板，以展示缩略图的完整信息密度。

final result: passed

---

# 指标预警：预览查看文字入口 QA

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-7fe6b2aa-f1ab-42c9-9901-6998c72cd3d5.png`，目标为暖棕色“预览查看”文字入口与右箭头图标。
- Implementation: `packages/chart-renderer/src/DashboardComponentRenderer.tsx` 中的 `MetricAlertSurface`。
- Intended state: 预警已触发，右侧入口可打开原有的风险详情弹窗。

**Evidence**

- 入口已从白底描边的“查看风险”按钮改为透明背景、暖棕色 14px/600 的“预览查看”文字与 Ant Design `RightOutlined` 图标；原有点击与键盘入口不变。
- `pnpm --filter @drag-visual/chart-renderer typecheck` 通过；`MetricAlert.test.tsx` 3/3 通过，包含新文案断言与原有详情打开交互。
- 本轮未得到用户指定的浏览器会话，不能捕获已登录看板中的实施截图并与参考图放入同一视觉比较输入。

**Findings**

- [P3] 需要在真实预警条的最终宽度下确认文字入口与右侧边缘的精确间距；实现已采用与参考相符的轻量文字入口层级。

**Comparison history**

- Iteration 1: 完成代码与交互验证；浏览器并排视觉检查受未指定浏览器会话阻塞。

final result: blocked

---

# Latest QA — 指标预警变量区背景与帮助图标修正

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-373da840-1747-4d87-8fb4-81e8f730fb1b.png`（用户指出：仅移除容器外框，浅色背景必须保留；帮助图标不应紧贴标题）。
- Implementation capture: `/private/tmp/metric-alert-variables-background-restored.png`，来自本地浏览器的真实组件渲染。
- Viewport/state: 窄侧栏变量面板展开；为便于聚焦，本次 QA 隐藏了无关的预览与文案字段。

**Evidence**

- 已确认变量容器计算样式为 `background: rgb(250, 252, 255)`、`border-width: 0px`；浅色承载面恢复，外围边框保持移除。
- 帮助图标的 `margin-inline-start` 为 6px，且保留可访问名称“插入变量说明”。
- `pnpm --filter @drag-visual/web exec vitest run src/features/editor/ComponentStylePanel.test.tsx` 通过（4/4）；`git diff --check` 通过。

**Findings**

- No actionable P0/P1/P2 differences. 变量按钮的蓝色层次、容器的浅色背景和无边框边界已同时满足；问号图标与“插入变量”之间留有稳定的视觉间距。

**Comparison history**

- Iteration 1: 移除变量容器外围边框，并用帮助图标替换长提示。
- Iteration 2: 根据反馈恢复容器浅色背景，并为帮助图标补充 6px 起始间距。

final result: passed

---

# 指标预警规则：现代化配置卡 QA

**Comparison target**

- Source visual truth: `/Users/ethan/.codex/generated_images/01a017f6-5ced-72e2-ab2f-69552c160c4d/exec-cfadb685-f9e3-418b-9887-c3e57667a60d.png`（用户确认的方案）。聚焦裁切：`/private/tmp/metric-alert-rule-reference-panel.png`。
- Implementation screenshot: `/private/tmp/metric-alert-rule-implementation.png`；聚焦裁切：`/private/tmp/metric-alert-rule-implementation-panel.png`。由真实 `ComponentBindingPanel` 加载“商品名称 / 周转天数（求和）”绑定后在浏览器中渲染。
- Viewport and normalization: source 为 1536 × 1024 px，聚焦卡片为 1340 × 608 px；implementation 为 1280 × 784 px，聚焦卡片为 554 × 276 px；浏览器 CSS viewport 为 1280 × 784，device scale factor 1。源图是宽卡概念稿，而生产位置是窄右侧配置栏，因此实现使用同一视觉层级的两列自适应布局；没有把图像缩放后作为 UI 使用。
- State: 已绑定维度和指标，条件为“大于”，阈值为 200 天；预警面板的即时反馈可见。
- Full-view comparison evidence: 同一比较输入中已打开源卡片聚焦图与实现卡片聚焦图；实现全景截图保留在 `/private/tmp/metric-alert-rule-implementation.png`。由于窄侧栏下控件会自动换为两列，聚焦区域已足以检查所有规则控件、反馈面板与交互状态。

**Evidence**

- 浏览器中真实组件显示蓝色维度块、绿色指标块、可操作条件选择器、阈值输入和单位，以及暖橙色预警结果面板。
- Primary interactions tested: 打开“预警条件”下拉；选择“小于等于”；将阈值更新为 180 并失焦确认。DOM 随即反映新的条件和值。
- `pnpm --filter @drag-visual/web typecheck` 通过；`ComponentBindingPanel.test.tsx` 中的指标预警配置与持久化断言通过。

**Findings**

- No actionable P0/P1/P2 differences. 白色卡片、橙色左侧语义标记、深色标题/灰色副标题、蓝绿字段分组、清晰的条件和阈值输入、浅橙反馈面板，均保留了已选方案的层级与色彩关系。
- 预期差异：概念稿在宽画布中使用单行表达式和“8 项待关注”；生产版位于实际窄侧栏，规则折为两列，且不显示未经查询计算的虚构命中数量，改为“预览查看”。这是避免数据误导的响应式产品约束，不是视觉缺陷。

**Required fidelity surfaces**

- Fonts and typography: 使用现有 Inter / PingFang SC / Microsoft YaHei 回退栈；标题 15px/700，副标题 11px，控件 12–13px，保持概念稿的明显层级并适配侧栏密度。
- Spacing and layout rhythm: 12px 卡片圆角、16px 内边距、14px 分区间距、8px 规则栅格间距和 9px 反馈面板圆角，在窄宽度下没有溢出或截断关键信息。
- Colors and visual tokens: 维度使用现有蓝色 `#1677ff`，指标使用绿色 `#16a56b`，预警使用 `#f79009` 与 `#fff9ef`；与参考图的语义分色一致。
- Image quality and asset fidelity: 参考图不含品牌图像、插画或产品照片；可见图标全部使用项目已有 Ant Design 图标库，没有以 SVG、CSS 绘制或占位图替代资产。
- Copy and content: 规则的维度、指标、聚合、条件、阈值和单位均来自真实配置；命中数量只会在可用数据计算后呈现，避免静态假数据。

**Comparison history**

- Iteration 1: 以用户确认的宽卡视觉为源图，对真实窄侧栏实现做浏览器聚焦比较；未发现需要修复的 P0/P1/P2 问题。

**Implementation checklist**

1. 选择预警维度与预警指标。
2. 在“预警规则”卡中选择比较条件并输入阈值。
3. 预览看板，确认命中的指标块高亮，并点击查看预警详情。

**Follow-up Polish**

- [P3] 当编辑器侧栏未来扩至宽布局时，可把规则表达式提升为单行连线式排版；现有两列布局应继续作为窄栏默认。

final result: passed

---

# 指标预警组件：设计 QA

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-df074eb1-a2b4-44c3-bb8f-c5bf4d8a93c4.png`（用户提供的横向指标预警条）。
- Implementation screenshot: `/private/tmp/metric-alert-preview-cropped.png`，由实际 `DashboardComponentRenderer` 的 `metricAlert` 组件渲染。
- Full-view comparison evidence: `/private/tmp/metric-alert-comparison-final.png`；同一浏览器画面中，上方为参考图，下方为实现图。
- Viewport and normalization: source 1917 × 109 px；implementation crop 1917 × 109 px；browser viewport 1920 × 111 CSS px，device scale factor 1；没有缩放或密度换算。
- State: 预警已触发；标签、标题、范围文案与“查看风险”操作可见。

**Evidence**

- Browser DOM confirms the rendered bar contains the real-time模板变量值：指标名称、当前值、阈值、条件与范围。
- Primary interaction was tested in the browser: clicking the entire warning block opens “库存风险 12 项详情”, displaying the configured detail copy and the resolved current value/condition/range. Console errors: none.
- `MetricAlert.test.tsx` passes 2/2: trigger highlighting + detail dialog, and the normal non-trigger state.
- `pnpm --filter @drag-visual/web typecheck` passes.

**Findings**

- No actionable P0/P1/P2 differences. The implementation matches the reference’s full-width warm warning surface, slim orange label pill, two-line content hierarchy, pale orange border, and right-aligned white action button.
- [P3] The exact caller-supplied wording is intentionally configurable; the preview uses the reference-style inventory copy, while saved dashboards may use their own scope and detail message.

**Required fidelity surfaces**

- Fonts and typography: existing Inter / PingFang SC stack, matching compact 12px auxiliary copy, 12px tag/action copy, and 15px semibold title hierarchy.
- Spacing and layout rhythm: 16px horizontal internal padding, 7px surface radius, 8px tag-to-title gap, and one concise second line match the reference density.
- Colors and visual tokens: `#fff9f0` surface, `#ffd8a8` border, and `#ff721b` warning tag preserve the source’s low-noise orange semantic state; the non-trigger state switches to green.
- Image quality and asset fidelity: no raster artwork, logo, decorative mark, or non-standard icon appears in the source; no visual asset substitution was required.
- Copy and content: all visible copy is author-configurable; `{{metric}}`, `{{value}}`, `{{threshold}}`, `{{operator}}`, `{{label}}`, and `{{scope}}` resolve live.

**Comparison history**

- Iteration 1: browser comparison exposed a shorter preview scope line than the reference.
- Fix: used the configurable `{{scope}}` token in the preview’s source-style second line.
- Post-fix: recaptured `/private/tmp/metric-alert-comparison-final.png`; no P0/P1/P2 visual mismatch remains.

**Implementation checklist**

1. Drag “指标预警” into a dashboard.
2. Bind one numeric field under “预警指标”; choose its aggregation in the binding control.
3. In “显示”, set the condition, threshold, templates, and scope; use the listed variables in copy.
4. Preview or publish the dashboard; only matched conditions render the orange risk state and open the detail dialog.

final result: passed

---

# 复合分析筛选条件配置：设计 QA

**Comparison target**

- Source visual truth: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-c1d53014-fbd1-4f8a-994c-e3deea6ab29c.png`（复合分析配置）与 `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-41cb8215-3669-4352-861e-d05617708dc3.png`（普通图表的目标层级）。
- Implementation: `AnalysisGroupPanel` 中的“筛选条件配置”卡片。
- Intended viewport/state: 编辑器右侧面板，复合分析已配置多项共享筛选条件。

**Evidence**

- 已通过 `pnpm --filter @drag-visual/web typecheck`。
- 复合分析的查询条件现置于与日期筛选相同的 `#f6f7f9` 灰色圆角容器；状态行和每条条件保持白色承载层，标题为“筛选条件配置”。
- 本地应用在未认证状态只能显示登录页，且没有已配置复合分析的可用看板数据，因此无法捕获同状态的实施画面并完成并排比较。

**Findings**

- [P1] 已修复：原“已配置”状态和条件明细直接悬浮在白色面板上，缺少与日期筛选一致的父级层次。现在二者被收纳至灰色容器，形成“模块标题 → 白色状态行 → 白色条件行”的稳定节奏。
- [P3] 真实窄侧栏中五条及以上条件的最终纵向密度仍需在已登录看板中目测确认。

**Required fidelity surfaces**

- Fonts and typography: 保持既有 11–12px 配置层级与编辑图标尺寸；新增标题采用现有卡片标题字重。
- Spacing and layout rhythm: 灰色容器沿用日期筛选的圆角与内边距，状态与条件行维持 6px 纵向间距。
- Colors and visual tokens: 父级使用既有 `#f6f7f9` 灰色分层，内部状态和明细使用白色表面，条件标签继续使用绿色语义色。
- Image quality and asset fidelity: 此区域没有图片或新增视觉资产。
- Copy and content: 新增分组标签“筛选条件配置”，已有“已配置”、条件和编辑入口保持不变。

**Implementation checklist**

1. 在已登录状态打开配置了复合分析筛选条件的看板。
2. 确认日期筛选和筛选条件配置均为独立灰色卡片。
3. 确认编辑筛选条件后抽屉和既有保存行为不变。

**Comparison history**

- Iteration 1: 完成代码级层级调整与类型检查；浏览器已打开本地应用，但登录态阻止进入目标配置状态。

final result: blocked

---

# 复合分析预览筛选区：设计 QA

**Comparison target**

- Source visual truth: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-d3cf3d85-5007-47f9-b756-5d90388df04d.png`（用户提供的预览页截图，1663 × 515）。
- Implementation: 复合分析预览中的 `ChartQueryFilterBar`，以 `chart-query-filter-bar--analysis-group` 呈现。
- Intended viewport/state: 桌面端，五个选择器、重置与查询操作可见，明细表紧随筛选区下方。

**Evidence**

- 已通过 `ChartQueryFilterBar` 与 `DashboardViewer` 的 22 个定向测试，以及 Web TypeScript 检查。
- 实现使用白色、细边框、8px 圆角的独立筛选面板；表单与下方图表网格之间保留 16px 空隙。
- 浏览器中的实际预览捕获受登录页阻塞；未提供可用的本地认证会话，因此无法在相同数据与视口下完成实施截图捕获和并排视觉比较。

**Findings**

- [P1] 已修复：原筛选条紧贴图表网格，且 #f8fafc 灰底与预览白底形成不必要的色带。现在筛选区作为白色工具面板单独呈现，使用轻边框区分区域，并以 16px 间距连接下方图表。
- [P3] 操作按钮在极窄桌面宽度下的换行状态仍需在真实数据看板中目测确认。

**Required fidelity surfaces**

- Fonts and typography: 沿用现有 Ant Design 控件和 12px 辅助文字层级；未改动字号、字体或文案。
- Spacing and layout rhythm: 新增 16px 筛选区—图表区间隔；筛选面板内边距为 12px × 14px。
- Colors and visual tokens: 移除复合分析筛选区的灰色底，替换为白底与 `#e5ebf2` 轻边框；保留现有主按钮蓝色。
- Image quality and asset fidelity: 本区域没有图片或新增视觉资产。
- Copy and content: 字段、运算符、重置和查询文案保持不变。

**Implementation checklist**

1. 在已登录状态打开包含复合分析的预览页。
2. 确认筛选区为白色独立面板，且与第一张图表卡片之间有清晰留白。
3. 在当前桌面分辨率检查五个筛选项与两个操作按钮的单行与换行表现。

**Comparison history**

- Iteration 1: 根据用户提供截图修复贴边与灰色工具条问题；代码级验证完成，浏览器同状态视觉比较被本地登录门槛阻塞。

final result: blocked

---

# Latest QA — 指标预警规则：现代化配置卡

**Comparison target**

- Source visual truth: `/Users/ethan/.codex/generated_images/01a017f6-5ced-72e2-ab2f-69552c160c4d/exec-cfadb685-f9e3-418b-9887-c3e57667a60d.png`；实施截图：`/private/tmp/metric-alert-rule-implementation.png`。
- Focused source and implementation captures (`/private/tmp/metric-alert-rule-reference-panel.png` 与 `/private/tmp/metric-alert-rule-implementation-panel.png`) 已在同一比较输入中打开并审阅。源图为 1536 × 1024 px，实施浏览器视口为 1280 × 784 CSS px，device scale factor 为 1。

**Findings**

- No actionable P0/P1/P2 differences. 宽卡概念的色彩、层级、圆角、阴影、字段语义色及暖橙反馈面板，已以两列响应式布局落到真实窄侧栏。
- 预期差异：生产侧栏不展示未经数据查询计算的“待关注”静态数量，改为“预览查看”，避免误导。

**Required fidelity surfaces**

- Fonts and typography: 现有 Inter / PingFang SC 字体栈与 15px 标题、11–13px 辅助/控件层级匹配窄侧栏密度。
- Spacing and layout rhythm: 16px 卡片内边距、12px 圆角、8px 表达式网格与 14px 分区间距均经过浏览器检查。
- Colors and visual tokens: 蓝色维度、绿色指标和橙色预警语义沿用产品现有 token。
- Image quality and asset fidelity: 没有非标准图像资产；图标来自项目已有 Ant Design 图标库。
- Copy and content: 维度、指标、聚合、条件、阈值和单位均为真实配置；条件下拉与阈值输入已完成浏览器交互验证。

**Implementation Checklist**

1. 绑定预警维度和指标。
2. 选择条件并填写阈值。
3. 在预览中确认命中高亮和详情入口。

**Follow-up Polish**

- [P3] 侧栏扩宽时可启用概念稿的一行连线式规则表达。

final result: passed

---

# Latest QA — 指标预警显示配置工作台

**Comparison target**

- Source visual truth: `/Users/ethan/.codex/generated_images/01a017f6-5ced-72e2-ab2f-69552c160c4d/exec-57cb2508-0057-441d-8404-e650f9bc1089.png`。
- Implementation capture: `/private/tmp/metric-alert-style-panel.png`。源图与实施截图已在同一比较输入中并排审阅。
- Intended viewport/state: 桌面端编辑器右侧的“图表样式”区域；摘要文案为默认状态，变量面板展开。

**Evidence**

- 已通过 `pnpm --filter @drag-visual/web typecheck` 与 `pnpm --filter @drag-visual/web exec vitest run src/features/editor/ComponentStylePanel.test.tsx`（4/4）。
- 浏览器实测了摘要／弹窗切换、预览详情展开、文案编辑、小数位增减和变量插入；变量被插入后会进入真实模板值并更新示例预览。
- 实施沿用 Ant Design 图标库和现有蓝色、橙色语义色；没有使用新增位图、占位图或自绘 SVG。

**Findings**

- No actionable P0/P1/P2 differences. 选中方案的关键层级已落地：效果预览、摘要／弹窗切换、小数位步进、可读变量 Token 和变量库都在真实编辑器状态中可操作。
- 有意适配：概念稿的整页抽屉标题与底部保存栏由现有编辑器外壳提供，因此组件内部不重复渲染；在窄侧栏中保留完整信息密度，而不是压缩成一列超长字段说明。

**Required fidelity surfaces**

- Fonts and typography: 标题、字段与 11–13px 辅助层级保持现有编辑器字体与密度；变量 Token 使用相同蓝色语义。
- Spacing and layout rhythm: 预览卡、分段切换、两段文案区和变量面板之间采用 14–16px 稳定间距；字段编辑态只在当前项提供轻蓝反馈。
- Colors and visual tokens: 普通配置使用产品主蓝，预警摘要使用低饱和暖橙与细边框；不引入突兀的渐变或大面积色块。
- Image quality and asset fidelity: 无需外部图像资源，图标均来自已有库。
- Copy and content: 模板原值仍然保存为 `{{metric}}` 等机器可解析标识；静态态以“指标名称／当前值／阈值”等可读 Token 呈现，点击后即可编辑原始模板。

**Comparison history**

- Iteration 1: 落地预览、摘要／弹窗分组、步进器和变量库，并验证核心交互。
- Iteration 2: 对照选中参考稿后，将静态模板升级为可读 Token 编辑面，保留真实文本编辑与变量插入能力。

final result: passed

---

# Latest QA — 指标预警变量区去边框与提示收敛

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-3cda4bc7-c477-47ac-83bf-db1d2677b879.png`（332 × 360 px）。
- Implementation capture: `/private/tmp/metric-alert-variable-refined-focus.png`（1280 × 778 px），来自浏览器渲染的变量区聚焦 QA 状态。
- Viewport/state: 800 × 900 CSS px 的本地编辑器 QA；配置列 380px、数据列 140px。源图为窄侧栏裁切，实施图包含编辑器外壳，因此比较聚焦变量区本身，未把外壳比例作为差异。

**Evidence**

- 源图与实施聚焦截图已在同一比较输入中审阅。
- `插入变量说明` 可访问名称存在，旧提示文本“点击添加到当前文案”不再渲染；折叠面板继续保持展开与变量按钮可操作。
- 浏览器控制台无 warning/error；Web TypeScript 检查与 `ComponentStylePanel` 定向测试均通过（4/4）。

**Findings**

- No actionable P0/P1/P2 differences. 外层四周边框已移除，变量项的蓝色承载层、间距和折叠分隔仍保持清晰层级。
- 文本提示已替换为 Ant Design 问号图标，并通过悬停提示说明插入行为；不再占用窄栏的水平空间。

**Required fidelity surfaces**

- Fonts and typography: “插入变量”保留既有 13px 半粗层级；问号图标与其他说明图标同为细灰色。
- Spacing and layout rhythm: 外框移除后，标题、变量列表和外部配置区保持原有 10–12px 间距，未新增空白或压缩按钮。
- Colors and visual tokens: 保留浅蓝变量按钮与灰色帮助图标；移除的是无语义的 `#e8edf5` 外围描边。
- Image quality and asset fidelity: 无图片资产变化；问号来自现有 Ant Design 图标库。
- Copy and content: 隐藏冗余提示文案，完整说明移入图标 Tooltip；变量名称和解释保持不变。

**Comparison history**

- Iteration 1: 用户指出外框与长提示文字占用空间。
- Iteration 2: 移除外框并用问号 Tooltip 替代文字；浏览器聚焦截图与 DOM 状态确认无边框、无旧提示，且变量区仍可展开。

final result: passed

---

# Latest QA — 指标组件入口图标区分

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-580ebcad-dd73-4179-889b-03c69fc11a29.png`（169 × 108 px）。该截图只覆盖“指标”分类，状态为默认未选中。
- Implementation capture: `/private/tmp/palette-metric-icons.png`（1280 × 720 px，浏览器 CSS viewport 同为 1280 × 720，device scale factor 1）。完整组件库截图与源图已在同一比较输入中审阅；比较聚焦左侧“指标”分类，未将其余分类的画布空白计入差异。
- Focused state: 三个入口均为默认可点击态；“指标趋势”等相邻项目保留原状。

**Evidence**

- 组件库现在使用已有 Ant Design 图标：指标看板为四宫格、指标预警为告警器、指标洞察为灯泡；三者的运行时图标标识均不同。
- 浏览器确认三个入口均可用，且图标的运行时颜色沿用组件库蓝色；控制台 error/warn 为空。
- `pnpm --filter @drag-visual/web typecheck` 通过；`git diff --check` 通过。定向 `EditorShell` 运行出现项目既有 CSS 解析警告，未作为本次图标变更通过依据。

**Findings**

- No actionable P0/P1/P2 differences. 原截图的紧凑网格、标题和蓝色视觉层级均保留，重复的“231”标记已被三个语义清晰、同一图标系统的图形替换。

**Required fidelity surfaces**

- Fonts and typography: 图标下方的 11px 图表名称、字重和截断方式保持不变。
- Spacing and layout rhythm: 保留 28 × 24 px 图标占位与原有四列网格，未改变相邻卡片间距。
- Colors and visual tokens: 复用 `#4c8ffb` 蓝色，避免为同一分类引入额外语义色。
- Image quality and asset fidelity: 使用现有 Ant Design 矢量图标库，不新增图片、CSS 绘制图形或自制 SVG。
- Copy and content: “指标看板／指标预警／指标洞察”名称及添加行为保持不变。

**Comparison history**

- Iteration 1: 识别三个入口共用“231”指标块，导致用途不可区分。
- Iteration 2: 为三个入口分别落地网格、告警器与洞察灯泡，并以浏览器渲染检查可读性与可用态。

final result: passed

---

# Latest QA — 图表跳转设置现代化弹窗

**Comparison target**

- Source visual truth: `/Users/ethan/.codex/generated_images/01a017f6-5ced-72e2-ab2f-69552c160c4d/exec-57bc2633-8843-4c1c-be35-91fb5f8729c4.png`（1604 × 981 px，用户选定的方案）。
- Implementation capture: `/private/tmp/chart-jump-modal-modern.png`（1280 × 720 px；浏览器 CSS viewport 1280 × 720，device scale factor 1）。完整实施截图与源图已在同一比较输入中审阅。源图的展示画布更宽更高，因此比较聚焦弹窗内容区的层级、控件密度与关系表达，而非外侧遮罩面积。
- State: 已有一条“供货价 → 义神的看板A”规则，目标看板没有可接收的全局筛选器，新标签页打开为选中状态。

**Evidence**

- 实施以真实的触发指标、目标看板、打开方式、规则导航与筛选参数映射逻辑渲染；顶部关系区使用既有 Ant Design 图标库表达柱状指标、连接和目标看板。
- 浏览器确认在 1280 × 720 桌面视口下，关系摘要、两个选择器、打开方式、参数空状态与底部动作完整可见，主体无需滚动；规则新增后列表数量变为 2，切换“当前页打开”后 radio 状态正确。
- 浏览器控制台 error/warn 为空；`ChartJumpConfigurationPanel.test.tsx` 通过（1/1），Web TypeScript 检查及 `git diff --check` 通过。

**Findings**

- No actionable P0/P1/P2 differences. 左侧规则导航、分离的源/目标关系卡、蓝绿图标语义、表单层级、参数空状态和底部保存动作都与所选方向一致。
- 可接受适配：源图的虚构字段为 `supplyPrice`，实施 QA 使用项目真实示例字段 `revenue`；文本值不同，但不影响层级或交互模式。源图的点划连接装饰以现有连接图标替代，避免引入非标准图形资产。

**Required fidelity surfaces**

- Fonts and typography: 18px 弹窗标题、13px 字段标签、12px 辅助说明和 15px 关系卡标题形成清晰层级；窄高视口下没有截断或挤压。
- Spacing and layout rhythm: 230px 规则导航、60px 表单横向留白、分离关系卡和 18px 分区间距延续源图的通透感；720px 高度下自动收紧但保持可读。
- Colors and visual tokens: 产品蓝用于选中规则、源指标和主按钮，青绿色用于目标看板；其余为低对比中性色与细分割线。
- Image quality and asset fidelity: 无新增位图或自绘 SVG；图标均来自已有 Ant Design 库并保持统一线条与清晰度。
- Copy and content: 原有规则、字段选择、打开方式、筛选映射和保存文案保留；无筛选器时明确说明“可直接跳转”。

**Comparison history**

- Iteration 1: 将传统的规则列表与纵向表单重构为现代双栏工作台，新增源→目标关系摘要与参数空状态。
- Iteration 2: 浏览器检查发现 720px 高度下参数区接近页脚；已压缩窄高视口的间距和高度，复查后内容完整可见。

final result: passed

---

# Latest QA — 图表跳转设置（选定关系线方案）

**Comparison target**

- Source visual truth: `/Users/ethan/.codex/generated_images/01a017f6-5ced-72e2-ab2f-69552c160c4d/exec-142637d5-d7ff-4824-9db5-8ff54abb186f.png`（1604 × 981 px，用户本轮选定方案）。
- Implementation capture: `/private/tmp/chart-jump-modal-quiet.png`（1280 × 720 px；浏览器 CSS viewport 1280 × 720，device scale factor 1）。源图与实施截图已在同一比较输入中并排审阅；视口比例不同，因此评估聚焦弹窗内部层级、两栏栅格和控件状态。
- State: 已有“供货价 → 义神的看板A”规则，目标看板没有可接收的全局筛选器，新标签页打开。

**Evidence**

- 已执行 `pnpm --filter @drag-visual/web typecheck`、`pnpm --filter @drag-visual/web exec vitest run src/features/editor/ChartJumpConfigurationPanel.test.tsx`（1/1）和 `git diff --check`，均通过。
- 浏览器实测“当前页打开”单选切换、添加跳转规则（列表由 1 条变为 2 条）和触发指标选择器展开；控制台 error/warn 为空。
- 选择器展开时外层为 `ant-select-focused`，浏览器截图确认其边框仍为中性灰色、无蓝色描边；下拉选项的蓝色仅用于当前选项，不承担输入框边框语义。

**Findings**

- No actionable P0/P1/P2 differences. 已按本轮选择的方案将顶部改为单行“触发指标 → 目标看板”关系线，取消源／目标卡片与插画式空状态；表单按标签左置、控件右置排列，参数区退回安静的说明容器。
- 右侧两枚选择控件的默认、悬停和聚焦状态均使用中性灰边框与无阴影处理，不再出现蓝色边框。
- 可接受适配：参考图的箭头线更长；实施使用现有 Ant Design 的 `ArrowRightOutlined`，避免增加自绘图形资产，同时保留同一方向关系。

**Required fidelity surfaces**

- Fonts and typography: 18px 弹窗标题、14px 表单标签和关系说明、13px 辅助文案形成与参考稿一致的主次层级。
- Spacing and layout rhythm: 250px 左侧规则栏、80px 内容留白、20px 表单节奏和细分割线让弹窗保持宽松；720px 高度下主体无需产生不必要的滚动。
- Colors and visual tokens: 蓝色仅用于关系值、当前规则、单选状态和主操作；右侧选择器及参数容器使用低对比灰色边线。
- Image quality and asset fidelity: 无新增图片、渐变或自绘 SVG；箭头及操作图标均来自项目已有 Ant Design 图标库。
- Copy and content: 原有触发指标、目标看板、打开方式、筛选参数和确认动作均保留；无可接收筛选器时明确说明可直接跳转。

**Comparison history**

- Iteration 1: 以用户选定的简洁关系线方案替换原有图标卡片式关系区，并将参数说明收敛为纯文本空状态。
- Iteration 2: 浏览器聚焦态发现新版 Select 的真实边框位于外层元素；将中性灰规则移至该元素，复核后聚焦态不再出现蓝色描边。

final result: passed

---

# Latest QA — 图表跳转弹窗宽度与规则选中态

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-02e7e265-8ed2-48ad-b599-9cb5ae6950f3.png`（1920 × 960 px，用户标注了全宽弹窗和规则项左侧蓝色强调条）。
- Implementation capture: `/private/tmp/chart-jump-modal-width.png`（1280 × 720 px；浏览器 CSS viewport 1280 × 720，device scale factor 1）。源图与实施截图已在同一比较输入中并排审阅；验证重点为宽度约束和当前规则的左边缘。

**Evidence**

- 浏览器测得弹窗实际宽度约为 1152 CSS px（1180px 配置在当前比例下的渲染结果），小于 1280px 视口宽度；在 1920px 桌面视口中会保持 1180px 上限并居中。
- 当前规则项的运行时 `box-shadow` 为 `none`，截图确认左侧蓝色条已移除，同时保留浅色背景和文字颜色区分选中态。
- `pnpm --filter @drag-visual/web typecheck`、`ChartJumpConfigurationPanel.test.tsx`（1/1）与 `git diff --check` 均通过；浏览器控制台 error/warn 为空。

**Findings**

- No actionable P0/P1/P2 differences. 弹窗不再随屏幕宽度扩张，宽屏下保持紧凑的 1180px 内容宽度，窄屏则维持至少 16px 的两侧安全边距。
- 已去除用户标注的蓝色侧边块；当前项仍通过低饱和背景、细边线和蓝色文字表达可识别的激活状态。

**Required fidelity surfaces**

- Fonts and typography: 保持既有标题、标签、关系线与操作按钮字号，不通过缩小字体换取宽度。
- Spacing and layout rhythm: 固定宽度后，250px 规则栏和表单栅格保持稳定；内容区有足够空间容纳两枚选择器和参数说明。
- Colors and visual tokens: 仅移除无必要的蓝色左侧强调，保留产品蓝用于规则文字、关系值、选中单选和主按钮。
- Image quality and asset fidelity: 无图片或图标资产变化。
- Copy and content: 规则内容、筛选参数说明和保存操作不变。

**Comparison history**

- Iteration 1: 宽度使用视口计算，宽屏编辑器中导致弹窗近乎铺满屏幕。
- Iteration 2: 改为 1180px 最大内容宽度并补上窄屏最大宽度限制；移除选中规则的 inset 蓝色阴影，浏览器复查尺寸与边缘均符合预期。

final result: passed

---

# Latest QA — 图表跳转字段对齐与控件宽度

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-f908725b-62cc-4832-8294-caf9aed3ff6f.png`（809 × 318 px，字段区域局部）。
- Implementation capture: `/private/tmp/chart-jump-modal-alignment.png`（1280 × 720 px）。源图与实施截图已在同一比较输入中审阅；视口不同，比较聚焦表单行的垂直中心线和选择器的相对宽度。

**Evidence**

- 浏览器几何测量：两行标签中心与对应选择器中心分别相同（237.7566px 与 237.7566px；300.5747px 与 300.5747px），实现像素级垂直居中。
- 每枚选择器的实际渲染宽度约为 463.9px，对应 480px 的受限控件列；不会继续填满表单可用空间。
- `pnpm --filter @drag-visual/web typecheck`、`ChartJumpConfigurationPanel.test.tsx`（1/1）和 `git diff --check` 均通过，浏览器控制台 error/warn 为空。

**Findings**

- No actionable P0/P1/P2 differences. 标签已独立为可垂直居中的字段元素，消除了文本基线带来的视觉偏移。
- 触发指标、目标看板和打开方式共享 130px 标签列与 480px 控件列，形成稳定且更紧凑的表单栅格。

**Required fidelity surfaces**

- Fonts and typography: 保持 14px 标签与选择器文本层级不变。
- Spacing and layout rhythm: 标签列与控件列使用 20px 间距；三行字段的中心轴一致。
- Colors and visual tokens: 无颜色语义变更，继续沿用中性灰选择器边框与产品蓝选中态。
- Image quality and asset fidelity: 无资产变化。
- Copy and content: 字段名称、可选项和打开方式均保持不变。

**Comparison history**

- Iteration 1: 选择器占据了整个剩余列宽，且匿名文本节点使标签的视觉中心不够稳定。
- Iteration 2: 标签改为独立居中元素，控件列限制为 480px；浏览器测量与截图均确认对齐和宽度。

final result: passed

---

# Latest QA — 图表跳转选择器紧凑密度

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-ce76b690-8d2c-49a1-af01-d7f9ba79f453.png`（839 × 284 px，用户认为两个选择器偏高）。
- Implementation capture: `/private/tmp/chart-jump-modal-density.png`（1280 × 720 px）。源图与实施截图已在同一比较输入中审阅；比较聚焦字段控件高度及其与标签的中心对齐。

**Evidence**

- 两个选择器已从 42px 规格收紧至 36px；在当前浏览器设备缩放下，实际渲染高度约为 42.9px。
- 浏览器测得两行标签与选择器中心仍然对齐，误差小于 0.0001px。
- 浏览器控制台 error/warn 为空；`git diff --check` 通过。

**Findings**

- No actionable P0/P1/P2 differences. 更紧凑的 36px 规格明显减少了两行字段的纵向占用，同时没有将控件压缩到影响文字可读性或点击区的程度。

**Required fidelity surfaces**

- Fonts and typography: 维持原有 14px 文本和字重，不以缩小文字实现紧凑化。
- Spacing and layout rhythm: 标签、控件与打开方式均同步到 36px 行高体系，保持稳定的视觉节奏。
- Colors and visual tokens: 无颜色或状态行为改动。
- Image quality and asset fidelity: 无资产变化。
- Copy and content: 字段内容与交互保持不变。

**Comparison history**

- Iteration 1: 用户反馈 42px 选择器在当前配置表单中显得偏高。
- Iteration 2: 选择器、标签与打开方式行同步调整为 36px，浏览器截图和几何测量确认紧凑且仍对齐。

final result: passed

---

# Latest QA — 图表跳转进一步紧凑化

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-815c9cec-99d6-4c35-83ec-bbf55e9059f3.png`（1186 × 623 px；用户指出弹窗和两个选择器仍然偏大）。
- Implementation capture: `/private/tmp/chart-jump-modal-compact.png`（1280 × 720 px，CSS viewport 1280 × 720，device scale factor 1）。两个图已在同一比较输入中审阅；源图为现有实现的宽屏状态，因此比较确认本轮缩窄后的结果。
- State: 已有一条“供货价 → 义神的看板A”规则，目标看板未配置可接收的全局筛选器，新标签页打开。

**Evidence**

- 浏览器实测弹窗约为 979.5px 宽，取代原来的约 1180px；在窄屏下仍由 `max-width: calc(100vw - 32px)` 保留安全边距。
- 两枚选择器的实际高度约为 37.2px、宽度约为 391.8px，对应 30px／400px 的紧凑控件规格；标签与控件中心仍然对齐（误差小于 0.0001px）。
- 浏览器实测切换“当前页打开”与新增跳转规则（列表由 1 条变为 2 条）；控制台 error/warn 为空。
- `pnpm --filter @drag-visual/web typecheck`、`ChartJumpConfigurationPanel.test.tsx`（1/1）和 `git diff --check` 均通过。

**Focused-region comparison**

- 字段区是本次唯一需要放大的区域：参考图的选择器视觉高度约 44px、整体弹窗接近视口宽度；实施截图的控件降至约 37px，弹窗两侧出现明确留白。该差异是用户指定的修正，而非设计漂移。

**Findings**

- No actionable P0/P1/P2 differences. 选择器现为信息密度更合适的 30px 规格，弹窗收敛为 1000px 配置宽度，仍能完整容纳规则列表、字段、打开方式和参数空状态。
- 可接受适配：由于截图设备缩放，30px CSS 控件呈现为约 37px 位图高度；视觉密度已较源图进一步降低，文本与选择箭头仍清晰可点。

**Required fidelity surfaces**

- Fonts and typography: 14px 标签与控件文本未缩小，保持当前产品字体层级和可读性。
- Spacing and layout rhythm: 左栏调整至 220px，内容区使用 50px 内边距；120px 标签列、400px 控件列和 20px 间距形成稳定紧凑的栅格。
- Colors and visual tokens: 延续中性灰边框、浅色当前规则背景、产品蓝关系值／单选／主按钮；没有新增颜色或渐变。
- Image quality and asset fidelity: 没有图片资产或图标资产变化；焦点仅为原生表单控件密度。
- Copy and content: 触发指标、目标看板、筛选参数与操作文案均未改动。

**Comparison history**

- Iteration 1: 控件从 42px 收紧到 36px，但用户在真实宽屏编辑器中仍感到选择器和弹窗偏大。
- Iteration 2: 将弹窗配置宽度收窄到 1000px，选择器进一步降到 30px，并同步收窄规则栏、表单内边距及控件列；浏览器截图和测量确认尺寸与对齐。

**Implementation Checklist**

1. 打开任一图表的“图表跳转设置”。
2. 确认 30px 选择器、30px 对齐行和 1000px 弹窗宽度。
3. 选择目标看板、切换打开方式并保存规则。

final result: passed

---

# Latest QA — 图表跳转配置工作台

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-f9e051ec-6477-431a-9708-07c202f89315.png`（942 × 751 px）。参考图强调“当前图表／当前数据集”上下文、紧凑规则栏、浅色跳转配置组和独立参数区域。
- Baseline: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-65d3a7f7-3537-4351-99da-e5050385837f.png`（958 × 592 px）。原实现缺少来源上下文，目标选择、打开方式和参数说明的分区较弱。
- Implementation capture: `/private/tmp/chart-jump-modal-workbench.png`（1280 × 720 px；浏览器 CSS viewport 1280 × 720，device scale factor 1）。参考图与实施截图已在同一比较输入中审阅；评估聚焦工作台结构、信息层级、控件密度和状态表达。
- State: 两条“供货价 → 义神的看板A”规则；当前页打开；目标看板未配置可接收的全局筛选器。

**Evidence**

- 标题下已显示“当前图表 供货价｜当前数据集 订单明细数据集”；图表和数据集采用既有图标库的蓝色、紫色语义图标与细分隔线，匹配参考图的上下文阅读顺序。
- 左侧规则栏保持 220px 宽，当前项仅用浅蓝底、细边线和蓝色文字表达选中状态，不存在蓝色侧边块。
- “跳转目标”和“打开方式”被组织到同一浅灰目标组；筛选参数独立成区并保留真实的全局筛选器映射／空状态逻辑。
- 浏览器几何测量：弹窗 1000px × 629px，上下文条 43px，目标配置组 632px × 97px；两枚选择器均为 400px × 30px，标签与控件垂直居中。
- 交互回归：切换“当前页打开”后状态为 `current`；新增规则从 2 条到 3 条，删除后回到 2 条；浏览器 console error/warn 为空。
- `pnpm --filter @drag-visual/web typecheck`、`ChartJumpConfigurationPanel.test.tsx`（1/1）和 `git diff --check` 均通过。

**Focused-region comparison**

- Context strip: 实施保留参考图的配置对象来源说明，但没有展示当前产品尚未支持的外部跳转、页面组件跳转或跳转文案，避免出现不能保存的伪功能。
- Destination group: 参考图中的跳转内容／位置／打开方式工作区，对应为产品已支持的目标看板与当前／新标签打开方式；边框、圆角与背景继续使用编辑器中性的设计系统。
- Density: 首次复查发现 Ant Design 6 的外层选择器仍为 38px；调整外层高度和内边距后复测为 30px，同时保持 14px 文本可读性和交互可点性。

**Findings**

- No actionable P0/P1/P2 differences. 弹窗已成为有清晰上下文、规则管理和目标决策层级的配置工作台，且既有跳转数据结构、保存方式和参数映射行为均未改变。
- 可接受差异：未添加参考图中的帮助文档入口与额外跳转类型，因为当前产品只支持目标看板和两种打开方式。

**Required fidelity surfaces**

- Fonts and typography: 标题 18px，字段标签和规则标题 14px，来源上下文与说明 13px。
- Spacing and layout rhythm: 43px 来源条、220px 规则栏、50px 表单横向内边距及 30px 控件建立紧凑工作台节奏。
- Colors and visual tokens: 中性边框／灰底配合产品蓝选中态，数据集图标使用柔和紫色；未新增装饰性颜色或渐变。
- Image quality and asset fidelity: 使用项目既有图标库中的真实图标；没有新增或伪造位图资产。
- Copy and content: 保留“触发指标”“目标看板”“打开方式”“筛选参数”及既有说明，新增上下文只展示真实图表标题和数据集名称。

**Comparison history**

- Iteration 1: 原弹窗只有规则栏、表单行和参数空状态，缺少配置对象上下文，也没有将跳转目标与打开方式成组。
- Iteration 2: 引入上下文条、工作台栅格和浅灰目标组；初次浏览器测量发现选择器实际高度仍为 38px。
- Iteration 3: 覆盖 Ant Design 6 外层选择器高度和内边距，复测两枚选择器均为 30px，规则与打开方式交互正常。

**Implementation Checklist**

1. 打开任一绑定了数值指标的图表的“图表跳转设置”。
2. 确认标题下显示当前图表和数据集，左侧规则项可切换、新增和删除。
3. 选择目标看板、切换打开方式；若目标看板配置了可接收的全局筛选器，则在“筛选参数”中完成字段映射并保存。

final result: passed

---

# Latest QA — 图表跳转选择器精简样式

**Comparison target**

- Current-state evidence: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-f1305ddf-4e45-4337-9f0c-26e3a3a0a89c.png`（678 × 111 px）。原选择器使用较重文字、6px 圆角和偏蓝灰边框，视觉更像定制输入框而非轻量选择控件。
- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-7653fc11-cfc3-4edc-bd65-99fe1ac281d1.png`（685 × 129 px）。目标是紧凑、近直角、常规字重、细中性边框的选择器；蓝色仅用于获得焦点的控件。
- Implementation capture: `/private/tmp/chart-jump-select-refined.png`（1280 × 720 px；浏览器 CSS viewport 1280 × 720，device scale factor 1）。源图与实施截图已在同一比较输入中审阅；两者的表单字段不同，因此对比聚焦选择器的高度、边框、圆角、箭头、字重与焦点状态。
- State: 已选择触发指标、目标看板和一组“商品名称 → 商品名称”筛选参数；当前页打开。

**Evidence**

- 所有图表跳转选择器继续使用 Ant Design `Select`，但统一添加了本模块的样式类：30px 高、2px 圆角、`#d9d9d9` 细边框、白色背景和 13px／400 字重正文。
- 浏览器实测四枚选择器均为 30px 高；触发指标和目标看板宽度为 400px，筛选参数的两个选择器各为 272px；内容文字的计算字重为 400，圆角为 2px。
- 打开“目标看板”选择器可显示当前目标选项；关闭后切换“当前页打开”正常生效，console error/warn 为空。
- `pnpm --filter @drag-visual/web typecheck`、`ChartJumpConfigurationPanel.test.tsx`（1/1）和 `git diff --check` 均通过。

**Focused-region comparison**

- 图 2 的选择器保持低对比度边框和近直角轮廓；实施已移除原来的 6px 圆角、较深的蓝灰边框与 500 字重，阅读密度和轮廓更接近参考。
- 图 2 中仅活跃选择器出现蓝色焦点边框；实施仅在实际 focus 状态下使用 `#4096ff` 和低强度焦点环，静止状态保持中性，不把整组选择器染蓝。

**Findings**

- No actionable P0/P1/P2 differences. 选择器已从“压缩的定制输入框”回到轻量、可扫描的下拉控件，且保留原有的可访问标签、下拉选项和参数映射行为。
- 可接受差异：参考图有额外的跳转类型和三级目标选择，而当前产品只支持目标看板和两种打开方式；该差异属于产品能力范围，不应以静态控件填充。

**Required fidelity surfaces**

- Fonts and typography: 内容使用 13px、400 字重；字段标签仍保持 14px 的现有层级。
- Spacing and layout rhythm: 30px 控件高度、10px 横向内边距和 2px 圆角形成紧凑表单节奏。
- Colors and visual tokens: 静止态为中性灰边框与白底；hover 仅轻微加深边框，focus 才使用产品蓝。
- Image quality and asset fidelity: 没有图像资产变化；下拉箭头继续使用 Ant Design 图标。
- Copy and content: 指标、目标看板、参数映射与打开方式文案均未改变。

**Comparison history**

- Iteration 1: 原控件为 30px，但字体偏重、圆角偏大、边框带蓝灰色，和图 2 的轻量选择器差异明显，判定为 P1 视觉不一致。
- Iteration 2: 将样式收敛为 2px 圆角、中性 `#d9d9d9` 边框、400 字重和仅焦点态产品蓝；浏览器复测尺寸、展开状态和打开方式切换后无 P0/P1/P2 问题。

**Implementation Checklist**

1. 打开任意图表的“图表跳转设置”。
2. 检查触发指标、目标看板和筛选参数选择器的静止、悬停与展开状态。
3. 选择目标看板、修改打开方式并保存，确认规则行为不变。

final result: passed

---

# Latest QA — 图表跳转选择器垂直居中与参数操作

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-328ec4e2-13b2-42ec-829f-f3ce7f4784b8.png`（753 × 468 px）。用户指出静止态选择器文字未准确居中，且全宽描边的“添加筛选参数”不够轻量。
- Implementation capture: `/private/tmp/chart-jump-alignment-refined.png`（1280 × 720 px；浏览器 CSS viewport 1280 × 720，device scale factor 1）。该浏览器对 Ant Design 浮层使用独立合成层，因此截图保留底层页面；同一浏览器会话中通过可访问 DOM、实际几何与交互状态检查对话框内四个选择器和添加操作。
- State: 已选触发指标、目标看板与“商品名称 → 商品名称”映射；新标签页打开。

**Findings**

- No actionable P0/P1/P2 differences. 原因是 Ant Design 6 将 `.ant-select-content` 的 `display` 覆盖为 `block`，此前 `align-items` 不生效。现在以模块级 `display: flex !important` 与 `align-items: center` 明确建立内容的垂直居中容器。
- “添加筛选参数”由父级 flex 的拉伸式全宽按钮改为紧凑的次级操作：28px 高、112px 宽、浅蓝底、4px 圆角，且保持产品蓝文字和悬停反馈。

**Evidence**

- 浏览器实测四个选择器均为 30px 高，内容区为 28px 高，`display: flex`、`align-items: center`，内容区中心与控件中心的偏差均为 `0px`。
- 点击“添加筛选参数”后映射行从 1 条增加为 2 条；控制台 error/warn 为空。
- `pnpm --filter @drag-visual/web typecheck`、`ChartJumpConfigurationPanel.test.tsx`（1/1）和 `git diff --check` 均通过。

**Required fidelity surfaces**

- Fonts and typography: 选择器维持 13px／400 字重和 20px 行高；次级操作为 12px／500 字重，避免与字段值争夺层级。
- Spacing and layout rhythm: 30px 输入控件、28px 次级操作和 9px 按钮横向内边距形成紧凑的参数编辑节奏。
- Colors and visual tokens: 选择器静止态保持中性灰边框；添加操作使用 `#f5f9ff` 承载产品蓝，hover 仅提高边框与文字对比。
- Image quality and asset fidelity: 没有新增图像资产；继续使用项目已有的 Ant Design 加号图标。
- Copy and content: “添加筛选参数”、来源字段、目标筛选器及参数传递逻辑均未改变。

**Comparison history**

- Iteration 1: 选择器内容区计算样式为 `display: block`，导致对齐规则无效；添加操作被父级纵向 flex 拉伸成全宽描边按钮。
- Iteration 2: 强制内容区使用 flex 居中，并为按钮添加专属 class 与 `align-self: flex-start`。浏览器复测四个选择器中心偏差为 0px，新增映射交互正常。

**Implementation Checklist**

1. 打开任一图表的“图表跳转设置”。
2. 检查触发指标、目标看板和筛选参数四个选择器中的文字是否居中。
3. 点击“添加筛选参数”，确认新映射行出现且可正常编辑。

final result: passed

---

# Latest QA — 右侧配置面板直角输入控件

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-ef838cb9-18ba-4b72-becb-4500ebf393e9.png`（297 × 272 px）。用户关注右侧「显示」面板的标题输入框和数值输入框，要求去除圆角并改善朴素的 Ant Design 默认观感。
- Implementation capture: 2026-08-20 的 in-app browser 实际编辑器截图（在本次 QA 中与参考图同一输入一并审阅）。浏览器 CSS viewport 为 1280 × 720，device pixel ratio 为 2；右侧配置面板的可用宽度为 319 CSS px。
- State: 选中「明细表」，并打开右侧「显示」页的「标题与卡片」和「图表样式」分组；标题为「明细表」，每页行数为 20。

**Evidence**

- 标题输入框与每页行数的外层控件均为 30px 高、0px 圆角、白底、无阴影；标题输入框实际几何为 194 × 30px，数值输入框外层为 186 × 30px。
- 输入文字收敛为 13px，使用 10px 水平内边距和中性 `#d7dce3` 边框；悬停轻微加深边框，聚焦时才使用克制的产品蓝 1px 外环。
- 数值输入框已隐藏微调箭头，避免在窄侧栏里制造噪点；开关继续保留圆角轨道，维持开／关状态的即时识别，而不把「无圆角」误扩展到状态控件。
- 浏览器实际回归：标题可编辑后恢复为「明细表」；每页行数可从 20 改为 24 再恢复为 20；`aggregateRows` 开关可切换到 `true` 并恢复为 `false`。
- `pnpm --filter @drag-visual/web typecheck`、`ComponentStylePanel.test.tsx`（4/4）和 `git diff --check` 全部通过。

**Focused-region comparison**

- 参考图和实施截图在同一次浏览器视觉检查中并排审阅。参考是 297px 宽的面板局部，实施使用真实 319px 宽侧栏；以侧栏宽度而不是整页截图密度归一化后，两者均保持标签在左、短输入框在右的紧凑属性编辑结构。
- 实施将参考中 6px 左右的圆角输入轮廓明确改为 0px，并移除了默认投影；保留浅灰配置分组底色，确保直角输入框仍清楚地从背景中分离出来。
- 实施截图中数值控件处于真实聚焦状态，蓝色边框仅作用于当前编辑字段；静止态标题控件保持中性，符合「避免整组控件过度发蓝」的层级要求。

**Findings**

- No actionable P0/P1/P2 differences. 右侧配置面板现在以直角、低噪点的属性控件表达编辑关系，同时保持 Ant Design 的可访问输入、数值校验和开关交互。
- 可接受差异：开关未改为直角。它并非文本输入控件，保留圆角轨道能更直观地区分布尔状态，且不会和用户所指的输入框视觉要求冲突。

**Required fidelity surfaces**

- Fonts and typography: 标签 12px／500，输入值 13px／常规字重，保持侧栏信息层级。
- Spacing and layout rhythm: 30px 控件高度、12px 标签—控件间距和 10px 输入内边距，适配约 320px 宽侧栏。
- Colors and visual tokens: 白色控件、浅灰配置底色、中性灰边框；仅 focus 使用产品蓝。
- Image quality and asset fidelity: 没有新增或替换图像资产；继续使用项目现有的 Ant Design 图标与原生可访问控件。
- Copy and content: 「标题」「aggregateRows」「每页行数」「斑马纹」等配置名称与既有业务行为均未改变。

**Comparison history**

- Iteration 1: 参考图显示圆角输入框与默认数值微调器，使窄侧栏的视觉层级偏松散；用户明确要求优化且去除圆角，判定为 P1 视觉一致性问题。
- Iteration 2: 将普通显示配置中的 Input、InputNumber、Select 统一为 30px 直角扁平控件，隐藏数值微调器，并保留开关语义。浏览器几何、实际输入与开关回归均通过，复查无 P0/P1/P2。

**Implementation Checklist**

1. 在编排页选中任意图表，打开右侧「显示」页。
2. 展开「标题与卡片」和「图表样式」，检查输入框为直角、静止态中性、聚焦态浅蓝。
3. 修改标题或每页行数，再切换一次开关，确认属性仍可保存并正常生效。

final result: passed

---

# Latest QA — 双指标对比排行配置分隔与文案

**Comparison target**

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-2227f579-3cf3-489c-9bbc-1979e3e184b1.png`（311 × 644 px）。目标是窄侧栏中的紧凑属性编辑表单；用户要求优化各项之间的分隔效果，并移除所有圆括号形式的补充文案。
- Implementation capture: `/private/tmp/product-movement-style-panel-final.png`（559 × 778 px）。应用内浏览器 CSS viewport 为 559 × 778，device pixel ratio 为 2；验收状态为新建看板、选中“双指标对比排行”、右侧“显示 → 图表样式”展开。

**Evidence**

- 浏览器中配置区的每个属性行使用 `#f6f7f9` 浅灰承载，行间为 4px 连续白色间隙；输入控件保持白底、30px 高和直角边框，不会形成视觉上厚重的卡片堆叠。
- “留空跟随字段”“单位”以及“紧凑显示（万）”中的全角圆括号均已移除，末者改为“万级紧凑显示”。
- 输入“成交额”后内容正常保留；控制台仅有项目已有的 Ant Design Drawer `width` 弃用提示，没有新增 error/warn。
- `ComponentStylePanel.test.tsx`（5/5）、Web build 与 `git diff --check` 均通过。

**Focused-region comparison**

- 参考图和最终实施截图在同一视觉检查输入中审阅。参考为 311px 宽的侧栏局部，实施为真实 559px 窄视口中的约 318px 配置栏；以真实配置栏宽度归一化比较，而非整页浏览器宽度。
- 参考中每项位于同一浅灰表面；实施保留这种紧凑左右对齐结构，同时以白色间隙清晰分组，消除了此前灰底连成一片的密集感。

**Findings**

- No actionable P0/P1/P2 differences. 由于参考图未定义精确的间隔尺寸，4px 白色间隙作为有意的可读性增强，且不改变字段顺序、控件尺寸或业务交互。

**Required fidelity surfaces**

- Fonts and typography: 标签继续使用 12px／500，输入值为 13px；移除括号后标签更短，窄栏不再产生多余噪点。
- Spacing and layout rhythm: 每行 3px 内边距配合 4px 白色间隔，保持高密度但具有可扫读的节奏。
- Colors and visual tokens: 行面为 `#f6f7f9`，控件和分隔为白色，焦点仍使用项目蓝色边框。
- Image quality and asset fidelity: 该区域没有图像资产；继续使用现有 Ant Design 图标和原生输入控件。
- Copy and content: 字段含义、单位和数值格式功能不变，仅清理圆括号样式的辅助文案。

**Comparison history**

- Iteration 1: 早期白色分隔通过边框实现，未形成稳定的行级表面，配置区仍显得连成一片。
- Iteration 2: 将样式面板改为白色容器、浅灰属性行和 4px 行间白带；再次核对后，分隔清晰且圆括号为零。

**Implementation Checklist**

1. 选中“双指标对比排行”，打开右侧“显示 → 图表样式”。
2. 确认每项配置之间有白色间隙，且输入框仍保持直角白底。
3. 检查图例名称、数值后缀和“万级紧凑显示”均不出现圆括号。

final result: passed

---

# Latest QA — 全局筛选器配置抽屉：最终交付记录

- Source: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-8ec47e31-5051-4e43-9195-2666938e4980.png`（2163 × 727）。
- Implementation: `/private/tmp/global-filter-drawer-side-implementation.png`（1920 × 820，CSS viewport 1920 × 820）。二者已在同一视觉检查输入中并排核对。
- The selected implementation is an approved 1380px right-side drawer rather than the source's full-width workspace; it retains the source's three-column hierarchy, selected filter cards, condition editor, linkage table, typography, and action treatment while leaving the editor visible.
- The source uses a date filter with eight charts; the verification fixture uses a regular field with one chart. The resulting control and row-count differences are data-dependent and preserve the same configuration model.
- Verification passed: `DashboardHeaderPanel.test.tsx`, Web typecheck, and `git diff --check`. No actionable P0/P1/P2 visual differences remain.

final result: passed

---

# Latest QA — 蓝色大盘任务进度看板（最终记录）

- Source visual truth: `/Users/ethan/.codex/generated_images/01a040df-855a-7542-92bd-87626d58804e/exec-913c97e9-32fe-43ac-87e2-c621d7fdbf2e.png`（1983 × 793 px）。
- Implementation screenshot: `/private/tmp/drag-visual-goal-task-progress-qa.png`（1280 × 720 px；CSS viewport 1280 × 720，DPR 1）。已在浏览器中验证周期切换、目标配置和评分权重，紧凑画布实测 `scrollWidth: 960`、`clientWidth: 454`，右侧任务列可通过横向滚动到达。
- Full-view evidence: 浅蓝工作区、白色圆角表面、蓝/绿/橙指标进度、排名徽标、状态标签、综合完成环及表头 Ant Design 图标均已在实施中呈现。
- Focused-region evidence: 滚动到右侧后“毛利”“库存周转”“综合完成”均可见，不再有原先被裁掉的不可达列。

**Findings**

- [P2] 浏览器安全策略拒绝 data URL 比较页，无法将设计稿和实施截图置于同一个视觉比较输入中。两份证据均已单独打开；未尝试绕过该策略。

**Required fidelity surfaces**

- Fonts and typography: 20px 标题、12px 表头、13–16px 数值，层级与宽表读数密度匹配。
- Spacing and layout rhythm: 14px 圆角、20px 列距、14px 行内边距；窄画布改用横向浏览保全内容。
- Colors and visual tokens: `#2563eb`、`#10b981`、`#f97316` 与 `#f5f9ff` 对应蓝色设计方向。
- Image quality and asset fidelity: 无新增图像资产；指标图标采用 Ant Design 图标库。
- Copy and content: 采用“GMV”“毛利”“库存周转”“综合完成”等任务进度语义。

**Comparison history**

- Iteration 1: 宽表右侧列在紧凑编辑器画布被裁掉，判定为 P2。
- Iteration 2: 表格最小宽度设为 920px，由外层提供横向滚动；右侧列浏览器实测可访问。最终并排比较受浏览器 URL 策略阻断。

**Implementation Checklist**

1. 绑定渠道/员工维度与实际指标。
2. 用“自定义目标”维护目标，并在宽屏看板查看全列。
3. 在允许并排本地图片比较的会话中重新执行最终视觉 QA。

final result: blocked

---

# Latest QA — 大盘任务进度看板背景层级收敛

- Source visual truth: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-f0f87253-d05a-4d17-a568-383789a8ed80.png`（设计稿）；目标为单一白色图表画布，仅以细分隔线区分内容。
- Before-change evidence: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-937c2697-d5a0-4240-b9cd-6ee742a48234.png`；当前实现存在组件浅蓝底、白表格、浅蓝表头及浅蓝页脚的叠层。
- Implementation capture: `/private/tmp/drag-visual-goal-background-qa.png`（CSS viewport 600 × 776）。真实预览刷新后持续停在加载状态，未能获得更新后的完整数据态截图。

**Findings**

- [P1] 已修复：组件根层、表头、数据行与权重栏统一白色；移除表格阴影，分隔线收敛为中性 `#e8eef6`。进度和状态芯片仍保留语义色。
- [P2] 当前真实预览持续加载，无法完成更新后截图与设计稿的最终同屏比较。

**Required fidelity surfaces**

- Fonts and typography: 未改动标题、表头及数据层级。
- Spacing and layout rhythm: 未改动行高和列距；移除阴影后不再形成额外卡片边界。
- Colors and visual tokens: 大面积背景统一白色，浅蓝只用于进度轨道、信息芯片和选中态。
- Image quality and asset fidelity: 未新增图像资产，指标图标仍来自 Ant Design。
- Copy and content: 未改动指标、筛选和权重文案。

**Comparison history**

- Iteration 1: 四类大面积底色并存，判定为 P1 层级噪音。
- Iteration 2: 合并为单一白色图表画布；渲染测试和类型检查通过。真实预览加载态阻断最终视觉比较。

**Implementation Checklist**

1. 在预览可加载数据后，确认表头、数据行、权重栏和空白区域为统一白底。
2. 确认仅保留行分隔线与状态芯片的浅色。

final result: blocked

---

# Latest QA — 复合分析拖入图表反馈

- Source visual truth: `/private/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-29553894-4b53-49ad-bb99-d03d86b92eb5.png`（复合分析容器的拖入状态）。
- Intended state: 正在把图表从组件库拖入已有子图表的复合分析容器。
- Implementation route: `http://127.0.0.1:5173/auth`。浏览器捕获到登录页，未能进入同一拖拽状态。

**Findings**

- [P1] 已修复：取消覆盖整个组内画布的半透明占位层，改为 210px 宽、88px 高的独立卡片提示“松开添加图表 / 将以默认卡片尺寸放入组内网格”。保留低强调的组容器描边，现有子图表不再被遮挡或暗化。
- [P2] 本地预览受登录态阻断，无法对真实拖入状态执行浏览器同屏视觉比较。

**Required fidelity surfaces**

- Fonts and typography: 提示标题使用 13px/600，说明为 12px，沿用编辑器辅助信息层级。
- Spacing and layout rhythm: 占位提示固定为紧凑卡片，不再使用 `inset` 填满组内容区。
- Colors and visual tokens: 复用 `#1677ff`、`#69b1ff` 和中性说明文本，背景改为近白色以保留既有卡片可见性。
- Image quality and asset fidelity: 无图像资产或自定义图标变更。
- Copy and content: 明确说明以默认卡片尺寸加入组内网格。

**Comparison history**

- Iteration 1: 全区域浅蓝遮罩被理解为新图表将占满复合分析容器。
- Iteration 2: 改为独立默认尺寸卡片提示；`EditorCanvas.integration.test.tsx` 11/11 通过。登录态阻断浏览器视觉比较。

**Implementation Checklist**

1. 登录本地预览，在包含子图表的复合分析中拖入任意图表。
2. 确认现有图表保持可见，且仅出现紧凑的默认尺寸添加提示。

final result: blocked

---

# Latest QA — 条件配置列表无边框层级

- Source visual truth: `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-1061db7d-8e9a-4607-9b07-7b19d5ab8c84.png`（复合分析）与 `/var/folders/1m/3dyrf2k55gdgnv6jl18w2gj00000gn/T/codex-clipboard-f796d37e-6163-43e3-b08e-4cff2ca7352a.png`（单图表）。
- Intended state: 条件列表项不使用外边框；未选中项由中性浅底区分，选中项由浅蓝底和左侧主色标记表达层级。
- Implementation target: 复合分析、单图表与全局筛选器三类配置抽屉的条件列表。

**Findings**

- [P1] 已修复：三类抽屉的条件列表项均去除 `border`，改为 `#f7f9fc` 的平面中性底色；悬停采用更浅蓝底。
- [P1] 已修复：选中项统一使用 `#eaf3ff` 与内嵌 3px 主色左侧标记，不再通过蓝色外框制造卡片感。
- [P2] 本地预览的登录请求返回“账号或密码不正确”，无法捕获与参考图同状态的浏览器渲染截图；功能测试与类型检查已通过，但视觉对照仍待登录态恢复后完成。

**Required fidelity surfaces**

- Fonts and typography: 未调整列表文字层级，继续沿用 12px 条件名称和 10–11px 辅助说明。
- Spacing and layout rhythm: 保持现有紧凑行高与圆角，仅移除重复边界，让列表更像一个连续的选择区域。
- Colors and visual tokens: 中性项使用 `#f7f9fc`，悬停使用 `#f0f6ff`，选中态使用 `#eaf3ff` 与 `#1677ff`。
- Image quality and asset fidelity: 无图像或图标资产变更。
- Copy and content: 未变更任何配置文案。

**Verification**

- `QueryFiltersPanel.test.tsx` 与 `DashboardHeaderPanel.test.tsx`: 5/5 passed。
- `@drag-visual/web typecheck`: passed。
- Browser visual comparison: blocked by local preview authentication.

final result: blocked
