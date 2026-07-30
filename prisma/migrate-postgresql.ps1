[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$PsqlPath,
  [string]$DatabaseHost = "127.0.0.1",
  [int]$Port = 5432,
  [string]$Database = "zhbi",
  [string]$Username = "postgres"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PsqlPath -PathType Leaf)) {
  throw "psql.exe was not found at: $PsqlPath"
}

function Invoke-Psql {
  param([string[]]$Arguments)

  & $PsqlPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL command failed with exit code $LASTEXITCODE."
  }
}

$createdPasswordEnvironment = $false
if (-not $env:PGPASSWORD) {
  $securePassword = Read-Host "PostgreSQL password for $Username" -AsSecureString
  $env:PGPASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
  $createdPasswordEnvironment = $true
}

try {
  $connectionArguments = @("-X", "-v", "ON_ERROR_STOP=1", "-U", $Username, "-h", $DatabaseHost, "-p", $Port, "-d", $Database)
  Invoke-Psql -Arguments ($connectionArguments + @("-c", 'CREATE TABLE IF NOT EXISTS "ZhbiDeploymentMigration" ("name" TEXT PRIMARY KEY, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);'))

  Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot "migrations") -Directory |
    Sort-Object Name |
    ForEach-Object {
      $migrationName = $_.Name
      $migrationPath = Join-Path $_.FullName "migration.sql"
      if (-not (Test-Path -LiteralPath $migrationPath -PathType Leaf)) { return }

      $quotedName = $migrationName.Replace("'", "''")
      $historyArguments = $connectionArguments + @("-t", "-A", "-c", ('SELECT 1 FROM "ZhbiDeploymentMigration" WHERE "name" = ''' + $quotedName + ''';'))
      $historyResult = & $PsqlPath @historyArguments
      if ($LASTEXITCODE -ne 0) { throw "Unable to read deployment migration history." }
      $applied = ($historyResult -join "").Trim()
      if ($applied -eq "1") {
        Write-Host "Already applied: $migrationName"
        return
      }

      Write-Host "Applying: $migrationName"
      Invoke-Psql -Arguments ($connectionArguments + @("-1", "-f", $migrationPath))
      $insertSql = 'INSERT INTO "ZhbiDeploymentMigration" ("name") VALUES (''' + $quotedName + ''');'
      Invoke-Psql -Arguments ($connectionArguments + @("-c", $insertSql))
    }
}
finally {
  if ($createdPasswordEnvironment) {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}
