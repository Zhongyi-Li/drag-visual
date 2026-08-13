# ZHBI Windows 制品更新说明

本文用于已完成初始部署后的日常更新：在 Mac 本地开发，使用 GitHub Actions 构建 Windows 离线制品，再更新 Windows 服务器上的前端、后端和数据库迁移。

初次安装 IIS、Node.js、PostgreSQL 与创建数据库，请先阅读：[Windows 内网初始部署说明](windows-intranet-deployment.md)。

## 1. 更新原则

- 生产运行目录是 `C:\zhbi`，生产配置是 `C:\zhbi\.env`。
- 待更新制品统一存放在 `C:\zhbi-update`；每次发布前，目录中只能保留本次下载并完整解压的一个制品。
- **绝不删除** `C:\zhbi\apps`、`C:\zhbi\apps\web` 或 `C:\zhbi\apps\web\dist`。
- 不要在资源管理器中使用“授予访问权限 → 删除访问/停止共享”。这会变更 IIS 所需的 NTFS 权限，可能导致 `500.19` 或 `401`。
- 使用 `robocopy /MIR` 将新制品镜像到既有目录；它会删除过期文件，但保留目标目录本身及其 IIS 权限。
- `.env` 不在制品中，更新时也不得覆盖、删除或上传到 GitHub。

## 2. Mac 本地开发与提交

在项目根目录完成开发和基本验证：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build

git add <本次修改的文件>
git commit -m "feat: 简述本次功能"
git push
```

本地启动前后端：

```bash
pnpm --filter @drag-visual/api dev
pnpm --dir apps/web exec vite -- --port 5173
```

不要提交生产 `.env`、数据库密码、内网 IP 或业务 MySQL 密码。

## 3. GitHub Actions 构建 Windows 制品

1. 打开仓库的 **Actions**。
2. 选择 **Build Windows deployment package**。
3. 点击 **Run workflow**，选择 `main` 分支。
4. 等待任务绿色成功。
5. 下载 Artifact：`zhbi-windows-x64`。

工作流已按 `/ZHBI/` 子路径构建前端，因此预览、发布页、分享链接和继续编辑等浏览器地址都会使用 `/ZHBI/...`。

## 4. Windows：准备待更新文件夹

不要直接在 `C:\zhbi` 解压下载文件。待更新制品固定解压到：

```text
C:\zhbi-update
```

发布前先确认 `C:\zhbi-update` 中没有上一次制品的残留文件，再解压 GitHub 下载的 Artifact。如果其中还有内层 `zhbi-windows-x64.zip`，继续将它解压到 `C:\zhbi-update`。

继续前，确认 `C:\zhbi-update` 直接包含：

```text
apps
prisma
.env.example
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
prisma.config.ts
```

## 5. 仅更新前端

适用场景：页面、样式、浏览器兼容性、前端路由或图表编辑交互变更，且没有后端代码和数据库迁移变更。

以管理员身份打开 PowerShell，执行：

```powershell
robocopy "C:\zhbi-update\apps\web\dist" "C:\zhbi\apps\web\dist" /MIR /COPY:DAT /DCOPY:DAT /R:2 /W:2
if ($LASTEXITCODE -ge 8) {
  throw "前端文件同步失败，停止发布。"
}
```

`robocopy` 返回码 `0` 到 `7` 均表示成功或正常完成文件同步；只有 `8` 或更大才是失败。

随后：

1. 不需要停止或重启 Node 后端；
2. 不需要执行数据库迁移；
3. 用无痕窗口访问 `http://<服务器IP>/ZHBI/`，或在浏览器按 `Ctrl + F5` 强制刷新；
4. 若仍显示旧静态资源，在 IIS 中回收 `/ZHBI` 所属的应用程序池后重试。

## 6. 更新后端，或包含数据库迁移的完整更新

适用场景：`apps/api` 有修改、`.env` 的配置项需要生效，或 `prisma/migrations` 新增迁移。

### 6.1 更新前检查与停止后端

在管理员 PowerShell 中检查后端健康：

```powershell
Invoke-WebRequest http://127.0.0.1:3000/health
```

若 Node 以前台 PowerShell 启动，在它所在窗口按 `Ctrl + C` 停止。若使用任务计划程序或其他守护服务，则停止对应任务/服务。

### 6.2 镜像复制新制品

以管理员 PowerShell 依次执行：

```powershell
robocopy "C:\zhbi-update\apps\api" "C:\zhbi\apps\api" /MIR /COPY:DAT /DCOPY:DAT /R:2 /W:2
if ($LASTEXITCODE -ge 8) {
  throw "后端文件同步失败，停止发布。"
}
```

```powershell
robocopy "C:\zhbi-update\apps\web\dist" "C:\zhbi\apps\web\dist" /MIR /COPY:DAT /DCOPY:DAT /R:2 /W:2
if ($LASTEXITCODE -ge 8) {
  throw "前端文件同步失败，停止发布。"
}
```

```powershell
robocopy "C:\zhbi-update\prisma" "C:\zhbi\prisma" /MIR /COPY:DAT /DCOPY:DAT /R:2 /W:2
if ($LASTEXITCODE -ge 8) {
  throw "迁移文件同步失败，停止发布。"
}
```

再更新制品中的根目录元数据，但不要碰 `.env`：

```powershell
Copy-Item C:\zhbi-update\package.json,C:\zhbi-update\pnpm-lock.yaml,`
  C:\zhbi-update\pnpm-workspace.yaml,C:\zhbi-update\prisma.config.ts,`
  C:\zhbi-update\.env.example -Destination C:\zhbi -Force
```

### 6.3 执行迁移并启动后端

每次完整更新都可安全执行迁移脚本；它会跳过已经执行过的迁移：

```powershell
Set-Location C:\zhbi

powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\prisma\migrate-postgresql.ps1 `
  -PsqlPath "D:\zhbi-data-postgres\bin\psql.exe"
```

生产环境不要运行 `prisma migrate dev` 或 `prisma.cmd migrate deploy`。

启动新版后端：

```powershell
Set-Location C:\zhbi
node .\apps\api\dist\main.js
```

如果由任务计划程序或服务守护，改为启动对应任务/服务，不要额外开一个重复的 Node 进程。

### 6.4 验证

在另一个 PowerShell 窗口验证 API：

```powershell
Invoke-WebRequest http://127.0.0.1:3000/health
```

再用无痕窗口访问：

```text
http://<服务器IP>/ZHBI/
```

确认发布完成后，清理 `C:\zhbi-update` 中本次已使用的制品，避免下次发布混入旧文件。不要删除 `C:\zhbi` 或其中的 `.env`。

## 7. 变更类型与操作对照

| 变更类型 | 更新内容 | 数据库迁移 | 重启 Node | 浏览器强刷 |
| --- | --- | --- | --- | --- |
| 仅前端页面、样式、图表编辑交互、路由 | `apps\web\dist` | 否 | 否 | 是 |
| 后端接口、后端逻辑、后端依赖 | `apps\api`，通常也同步前端与根目录元数据 | 否 | 是 | 建议 |
| 新增 `prisma/migrations` | 完整更新 | 是 | 是 | 建议 |
| `web.config` 或 IIS 配置 | `apps\web\dist`，必要时调整 IIS | 否 | 否 | 是；必要时回收应用程序池 |

## 8. 常见问题

| 现象 | 处理方式 |
| --- | --- |
| `robocopy` 退出码为 1 | 正常，表示有文件已复制；仅 `8` 及以上需要按失败排查 |
| IIS 返回 500.19 或 401 | 不要删除或更改共享权限；检查 `C:\zhbi\apps\web\dist` 的 IIS 应用程序池读取权限 |
| IIS 返回 502 | 运行 `Invoke-WebRequest http://127.0.0.1:3000/health`，确认 Node 后端正在运行 |
| 更新后仍是旧页面 | 使用无痕窗口或 `Ctrl + F5`；必要时回收 IIS 应用程序池 |
| 迁移失败 | 检查 PostgreSQL 服务、`DATABASE_URL`、`D:\zhbi-data-postgres\bin\psql.exe` 路径，并使用迁移脚本 |
