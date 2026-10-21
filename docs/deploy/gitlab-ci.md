# GitLab CI 构建

GitLab 使用根目录 `.gitlab-ci.yml`，GitHub 继续使用 `.github/workflows/`。
两套配置独立；本次新增的 GitLab 文件不改变 GitHub Actions 的命令、触发方式或制品。

## Runner 准备

在项目的 **设置 → CI/CD → Runners** 查看可用 Runner。

- `frontend-release-gate`：需要接受无标签任务的 Linux Docker 或 Kubernetes Runner，使用 `node:24-bookworm` 镜像。运行环境需要允许安装 Chromium 的系统依赖，并能访问 npm 和 Playwright 下载源。如果管理员只提供带标签的 Runner，请在该任务增加对应 `tags`。
- `windows-deployment-package`：需要带 `windows` 标签的 Windows x64 Runner，使用 Shell executor、PowerShell Core（`pwsh`）。建议与 GitHub 一致使用 Windows Server 2022，提前安装 Git、Node.js 24 和 pnpm 10.28.0，并确保 Runner 服务账户可以执行它们。可以由管理员执行 `npm install --global pnpm@10.28.0` 后重启 Runner 服务以刷新 PATH。需要访问 npm。

GitLab 不会像 GitHub 的 `windows-2022` 一样，仅凭配置自动分配 Windows 主机。
任务一直显示 pending、提示没有匹配的 Runner 时，需要管理员配置 Runner 或调整标签。

## 自动检查与构建

把这些新增文件提交并推送到 GitLab 的 `main` 分支。推送到 `main`、合并请求，以及网页手动运行流水线时，会执行 `frontend-release-gate`：

1. 安装 pnpm 10.28.0 和锁文件指定的依赖。
2. 安装 Playwright Chromium 及系统依赖。
3. 执行类型检查、单元测试、构建和 OpenAPI 检查。
4. 将 Playwright 场景运行两遍，与 GitHub 的检查一致。

也可以进入 **构建 → 流水线 → 运行流水线**，选择 `main`，变量留空后运行。
构建输出和浏览器测试结果作为任务制品保留 14 天；失败时上传的构建目录可能不完整，不应作为发布包。

## 手动生成 Windows 离线包

1. 进入 **构建 → 流水线 → 运行流水线**，选择要打包的分支，变量留空后运行。
2. 在该流水线中，点击 `windows-deployment-package` 旁的播放按钮，启动手动任务。
3. 等待该任务成功，进入任务详情，下载制品。
4. GitLab 制品压缩包内包含 `release/zhbi-windows-x64.zip`，取出这个内层 ZIP 用于部署。

Windows 打包任务可独立于 Linux 检查运行，与 GitHub 的手动打包流程一致。
它是可选任务，因此流水线总状态不能代替打包结果；必须确认 Windows 任务本身成功。
前端使用 `VITE_PUBLIC_BASE=/ZHBI/`、`VITE_API_BASE_URL=/ZHBI` 构建。
包内包含前后端输出、实际复制的 npm 生产依赖和 Prisma 迁移文件，并检查解压后的 Prisma 客户端能否加载。
不要使用 Linux 检查任务的输出替代 Windows 离线包。

后续部署步骤参见 [Windows 制品更新说明](windows-artifact-update.md)，将其中从 GitHub 下载制品的步骤替换为上述 GitLab 下载步骤即可。

## 验证配置

本地 YAML 解析只能检查文件结构；推送后可在 GitLab 流水线编辑器中使用校验功能检查当前 GitLab 版本的兼容性。
实际构建与 Windows 打包还需要在上述 Runner 上运行验证。
