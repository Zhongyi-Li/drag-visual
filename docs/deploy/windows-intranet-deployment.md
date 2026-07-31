# ZHBI Windows 内网初始部署说明

本文记录当前 ZHBI 的部署方式：Windows + IIS + Node.js + PostgreSQL，不使用 Docker、不使用 HTTPS，应用以 IIS 子应用的形式部署在 `/ZHBI` 下。

> 根站点 `http://<服务器IP>/` 由原有 Default Web Site 继续提供服务；ZHBI 的入口固定为 `http://<服务器IP>/ZHBI/`。

## 1. 当前环境与目录约定

| 项目 | 当前路径/配置 | 说明 |
| --- | --- | --- |
| ZHBI 运行包 | `C:\zhbi` | GitHub Actions 制品解压位置 |
| 后端程序 | `C:\zhbi\apps\api` | NestJS 编译产物与离线运行依赖 |
| 前端静态文件 | `C:\zhbi\apps\web\dist` | IIS 中 `/ZHBI` 应用的物理路径 |
| 生产配置 | `C:\zhbi\.env` | 仅保留在服务器，严禁提交 Git |
| PostgreSQL 程序 | `D:\zhbi-data-postgres` | 当前服务器的 PostgreSQL 18 安装路径 |
| PostgreSQL 命令行 | `D:\zhbi-data-postgres\bin\psql.exe` | 执行建库、迁移和排障 |
| PostgreSQL 服务 | `postgresql-x64-18` | 应保持 `Running`，设置为自动启动 |
| Node API 端口 | `3000` | 仅由本机 IIS 反向代理访问；不应额外放行防火墙端口 |
| IIS 前端入口 | `http://<服务器IP>/ZHBI/` | Default Web Site 下的应用 `/ZHBI` |

制品中的主要内容如下：

```text
C:\zhbi
├─ .env                         # 服务器配置；更新时必须保留
├─ .env.example                 # 配置模板，可被制品覆盖
├─ apps
│  ├─ api
│  │  ├─ dist\main.js           # Node 后端启动入口
│  │  └─ node_modules           # 已打包好的离线运行依赖
│  └─ web
│     └─ dist                   # Vite 前端构建结果与 web.config
└─ prisma
   ├─ migrations                # 数据库迁移 SQL
   └─ migrate-postgresql.ps1    # 使用 psql 执行迁移的脚本
```

## 2. 一次性安装与 IIS 配置

### 2.1 软件

服务器已安装的运行环境：

- Node.js 24（项目要求 Node.js `>=22.12`）；
- pnpm 10；仅用于排查或本地维护，运行制品不需要在服务器执行 `pnpm install`；
- PostgreSQL 18，安装在 `D:\zhbi-data-postgres`；
- IIS、URL Rewrite 和 Application Request Routing（ARR）。

不要在 `C:\zhbi` 内重新安装 Node.js、pnpm 或 PostgreSQL；这里是应用运行目录，不是软件安装目录。

### 2.2 IIS

IIS 保留 **Default Web Site** 的原有物理路径：

```text
%SystemDrive%\inetpub\wwwroot
```

在 Default Web Site 下创建应用，而不是创建一个占用 80 端口的新站点：

| 配置项 | 值 |
| --- | --- |
| 应用别名 | `ZHBI` |
| 物理路径 | `C:\zhbi\apps\web\dist` |
| 完整访问地址 | `http://<服务器IP>/ZHBI/` |

ARR 必须启用 **Enable Proxy**。前端构建包自带 `C:\zhbi\apps\web\dist\web.config`，其中已经包含：

1. `/ZHBI/api/auth/*`、`/ZHBI/dashboards/*`、`/ZHBI/datasets/*` 与 `/ZHBI/published-dashboards/*` 到 `http://127.0.0.1:3000` 的反向代理；
2. React 单页应用的回退规则，确保 `/ZHBI/preview/<id>`、`/ZHBI/view/<id>` 等深层链接能正常打开。

因此，**每次更新制品后不需要再手工创建或粘贴 `web.config`**。如发现文件不存在，说明使用了旧制品，应重新构建并更新。

若尚未放行 HTTP 端口，以管理员 PowerShell 执行一次：

```powershell
New-NetFirewallRule `
  -DisplayName "ZHBI HTTP" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 80 `
  -Action Allow
```

## 3. 生产配置与数据库

`C:\zhbi\.env` 是服务器私有文件。创建或检查时使用：

```powershell
notepad C:\zhbi\.env
```

配置示例（请使用真实值，勿把密码提交到 Git 或发送到聊天）：

```dotenv
DATABASE_URL=postgresql://postgres:<URL编码后的PostgreSQL密码>@127.0.0.1:5432/zhbi
PORT=3000
NODE_ENV=production
COOKIE_SECURE=false
WEB_ORIGIN=http://<Windows服务器内网IP>
RETAIL_MYSQL_URL=mysql://<用户名>:<URL编码后的密码>@<业务MySQL地址>:3306/os
```

说明：

- `WEB_ORIGIN` 只填写协议、IP 和端口，**不要**填写 `/ZHBI`；浏览器的 Origin 本身不包含路径。
- 密码里如有 `@`、`+`、`#`、`%`、`:`、`/` 等字符，必须进行 URL 编码。例如 `@` 写成 `%40`，`+` 写成 `%2B`。
- 当前为受信任内网 HTTP 部署，故 `COOKIE_SECURE=false`。迁移至 HTTPS 后应改为 `COOKIE_SECURE=true`。
- `RETAIL_MYSQL_URL` 是业务数据源，和本机 ZHBI PostgreSQL 数据库不是同一个库。

检查 PostgreSQL 服务：

```powershell
Get-Service postgresql-x64-18
```

首次建库（数据库已存在时的报错可以忽略）：

```powershell
& "D:\zhbi-data-postgres\bin\psql.exe" `
  -U postgres -h 127.0.0.1 -p 5432 `
  -c "CREATE DATABASE zhbi WITH ENCODING 'UTF8';"
```

执行迁移：

```powershell
Set-Location C:\zhbi

powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\prisma\migrate-postgresql.ps1 `
  -PsqlPath "D:\zhbi-data-postgres\bin\psql.exe"
```

该脚本会在数据库内记录已执行的迁移，可重复执行。生产服务器**不要**执行 `prisma migrate dev`，也不要再执行 `prisma.cmd migrate deploy`。

## 4. 启动、停止与验证

### 4.1 后端服务

当前后端启动命令：

```powershell
Set-Location C:\zhbi
node .\apps\api\dist\main.js
```

这是一种前台启动方式：**关闭该 PowerShell 窗口，Node 后端就会停止**。PostgreSQL 不受此影响，它是 Windows 服务。

验证 API：

```powershell
Invoke-WebRequest http://127.0.0.1:3000/health
```

期望返回状态码 `200`。

建议在稳定运行后使用“任务计划程序”将上面的 Node 命令配置为“计算机启动时”自动启动，并设置失败自动重启；或者由运维统一使用已有的 Windows 服务管理工具。无论采用哪种守护方式，工作目录应为 `C:\zhbi`，启动程序应为 `node.exe`，参数为：

```text
C:\zhbi\apps\api\dist\main.js
```

### 4.2 IIS 与浏览器

验证前端及反向代理：

```text
http://127.0.0.1/ZHBI/
http://<服务器内网IP>/ZHBI/
```

以下地址应保持为原网站，而不是 ZHBI：

```text
http://127.0.0.1/
http://<服务器内网IP>/
```

如果刚更新前端仍显示旧页面，先用浏览器 `Ctrl + F5` 强制刷新或无痕窗口访问；必要时在 IIS 中回收 `/ZHBI` 所属应用程序池。

## 5. 后续更新

本地开发、GitHub Actions 构建、Windows 前后端资源更新与数据库迁移，请见：[Windows 制品更新说明](windows-artifact-update.md)。

## 6. 常见故障检查

| 现象 | 优先检查 |
| --- | --- |
| IIS 返回 502 | `Invoke-WebRequest http://127.0.0.1:3000/health`；检查 Node 进程是否仍在运行 |
| `/ZHBI/` 打开 404 | IIS 应用物理路径是否为 `C:\zhbi\apps\web\dist`；检查该目录是否存在 `web.config` 和 `index.html` |
| 点击预览打开根路径 `/preview/...` | 使用旧前端制品；重新运行 Actions 并更新 `apps\web\dist` |
| 数据集接口失败 | 检查 `.env` 的 `RETAIL_MYSQL_URL`、Windows 到业务 MySQL 的网络连通性和账号权限 |
| 数据库迁移失败 | 检查 PostgreSQL 服务、`DATABASE_URL`、`psql.exe` 路径；用迁移脚本而不是 Prisma CLI |
| 关闭终端后页面接口失败 | Node 后端以前台方式启动，需重新运行启动命令或配置任务计划程序/服务守护 |

## 7. 安全与备份

- `.env`、数据库密码、业务 MySQL 密码只保留在服务器安全位置；不得提交到 GitHub、Actions 日志或聊天记录。
- PostgreSQL 应定期备份；至少在重大更新前导出 `zhbi` 数据库。
- 当前 HTTP/IP 部署适用于受控内网。开放到更大网络范围前，应先部署 HTTPS，并将 `COOKIE_SECURE` 改为 `true`。
