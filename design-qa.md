# 登录 / 注册页设计 QA

- 视觉基准：`/Users/ethan/.codex/generated_images/019f68e6-ffb6-7d03-8295-7c22a711eac7/exec-9ede436a-e37e-4252-be17-e3290f218823.png`
- 实现地址：`http://127.0.0.1:5173/auth`
- 对比方式：在 1280 × 720 视口中对照基准图与浏览器实测截图。

## Fidelity surfaces

| Surface | Result |
| --- | --- |
| Header / brand | 白色顶栏与 ZHBi 渐变品牌字保持一致的视觉层级。 |
| Overall composition | 居中的双栏圆角入口卡、左侧价值说明、右侧账号表单均与基准的阅读顺序一致。 |
| Background | 采用独立生成的数据网络背景资产，保留浅蓝紫渐变和右下数据网格氛围。 |
| Typography | 标题、正文、字段标签与操作层级清晰；文本未出现截断。 |
| Components | 账号、密码、显示密码、记住我、登录 / 注册切换均使用标准可访问控件。 |
| Responsive behavior | 在窄屏下折叠为单列表单入口，避免横向溢出。 |

## Validation

- 浏览器实测完成注册并回到工作台。
- 浏览器实测使用新账号登录并回到工作台。
- 未登录访问工作台会跳转到登录页；预览与已发布看板链接仍保持公开访问。
- `pnpm --dir apps/web exec tsc -p tsconfig.json --noEmit` 通过。
- `pnpm --dir apps/api exec tsc -p tsconfig.json --noEmit` 通过。
- `pnpm --dir apps/web exec vitest run src/app/router.test.tsx` 通过（4 项）。
- `git diff --check` 通过。

## Comparison history

- v1：完成视觉比对；未发现需要继续修复的 P0、P1 或 P2 问题。

final result: passed
