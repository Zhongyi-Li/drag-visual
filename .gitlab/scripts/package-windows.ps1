# GitLab-only copy of the Windows packaging procedure; GitHub Actions is unchanged.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if (-not $env:CI_PROJECT_DIR) { throw "CI_PROJECT_DIR is required." }
Set-Location -LiteralPath $env:CI_PROJECT_DIR
# Shell runners reuse checkouts. Remove only this job's generated release output.
if (Test-Path -LiteralPath "release") { Remove-Item -Recurse -Force -LiteralPath "release" }

$releaseRoot = Join-Path $env:CI_PROJECT_DIR "release\\zhbi"
$apiRoot = Join-Path $releaseRoot "apps\\api"
$standaloneApiRoot = Join-Path $env:CI_PROJECT_DIR "release\\standalone-api"
$archivePath = Join-Path $env:CI_PROJECT_DIR "release\\zhbi-windows-x64.zip"
New-Item -ItemType Directory -Force -Path $standaloneApiRoot | Out-Null

# Build a conventional npm dependency tree. pnpm's Windows junctions
# are not portable through a CI artifact ZIP and Explorer extraction.
Copy-Item -Recurse -Force "apps\\api\\dist" (Join-Path $standaloneApiRoot "dist")
Copy-Item -Force "apps\\api\\package.json" (Join-Path $standaloneApiRoot "package.json")

$contractSourceRoot = Join-Path $standaloneApiRoot "contracts"
New-Item -ItemType Directory -Force -Path $contractSourceRoot | Out-Null
Copy-Item -Recurse -Force "packages\\contracts\\dist" (Join-Path $contractSourceRoot "dist")
Copy-Item -Force "packages\\contracts\\package.json" (Join-Path $contractSourceRoot "package.json")
$contractPackagePath = Join-Path $contractSourceRoot "package.json"
$contractPackage = Get-Content -LiteralPath $contractPackagePath -Raw | ConvertFrom-Json
$contractPackage | Add-Member -NotePropertyName "version" -NotePropertyValue "0.0.0" -Force
$contractPackage | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $contractPackagePath -NoNewline

Push-Location $contractSourceRoot
npm pack --pack-destination $standaloneApiRoot | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Contracts package creation failed." }
Pop-Location
$contractArchive = Get-ChildItem -LiteralPath $standaloneApiRoot -Filter "*.tgz" | Select-Object -First 1
if (-not $contractArchive) { throw "Contracts package archive is missing." }
Rename-Item -LiteralPath $contractArchive.FullName -NewName "contracts.tgz"
Remove-Item -Recurse -Force $contractSourceRoot

$apiPackagePath = Join-Path $standaloneApiRoot "package.json"
$apiPackage = Get-Content -LiteralPath $apiPackagePath -Raw | ConvertFrom-Json
$apiPackage.dependencies.'@drag-visual/contracts' = "file:contracts.tgz"
$apiPackage.devDependencies = [pscustomobject]@{}
$apiPackage | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $apiPackagePath -NoNewline

Push-Location $standaloneApiRoot
npm install --omit=dev --ignore-scripts --no-audit --no-fund | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Offline API dependency installation failed." }
Pop-Location
New-Item -ItemType Directory -Force -Path $apiRoot | Out-Null
Copy-Item -Recurse -Force (Join-Path $standaloneApiRoot "*") $apiRoot

New-Item -ItemType Directory -Force -Path (Join-Path $releaseRoot "apps\\web") | Out-Null
Copy-Item -Recurse -Force "apps\\web\\dist" (Join-Path $releaseRoot "apps\\web\\dist")
Copy-Item -Recurse -Force "prisma" (Join-Path $releaseRoot "prisma")
Copy-Item -Force "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "prisma.config.ts", ".env.example" -Destination $releaseRoot

if (-not (Test-Path (Join-Path $apiRoot "dist\\main.js"))) { throw "API build output is missing." }
if (-not (Test-Path (Join-Path $releaseRoot "prisma\\migrate-postgresql.ps1"))) { throw "PostgreSQL migration script is missing." }
if (-not (Test-Path (Join-Path $releaseRoot "apps\\web\\dist\\index.html"))) { throw "Web build output is missing." }
$runtimeLink = Get-ChildItem -Force -Recurse (Join-Path $apiRoot "node_modules") | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | Select-Object -First 1
if ($runtimeLink) { throw "Portable runtime still contains a link: $($runtimeLink.FullName)" }

Compress-Archive -LiteralPath @(
  (Join-Path $releaseRoot "apps"),
  (Join-Path $releaseRoot "prisma"),
  (Join-Path $releaseRoot "package.json"),
  (Join-Path $releaseRoot "pnpm-lock.yaml"),
  (Join-Path $releaseRoot "pnpm-workspace.yaml"),
  (Join-Path $releaseRoot "prisma.config.ts"),
  (Join-Path $releaseRoot ".env.example")
) -DestinationPath $archivePath -CompressionLevel Optimal -Force

$verificationRoot = Join-Path $env:CI_PROJECT_DIR "release\\archive-verification"
Expand-Archive -LiteralPath $archivePath -DestinationPath $verificationRoot -Force
Push-Location $verificationRoot
node --input-type=module -e "await import('./apps/api/dist/generated/prisma/client.js'); console.log('Prisma client runtime verified');"
if ($LASTEXITCODE -ne 0) { throw "Prisma client runtime verification failed." }
Pop-Location

Get-FileHash -Algorithm SHA256 $archivePath | Format-List
