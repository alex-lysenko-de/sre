<#
.SYNOPSIS
  Ticket 111: manual on-demand backup of the Supabase Postgres database
  (schema + data), using native pg_dump (PostgreSQL 17 client tools).

.DESCRIPTION
  Writes two files under backup/database/:
    - schema.sql       structure only (tables, indexes, constraints, views,
                       functions, triggers, RLS policies) - safe to commit,
                       tracked in git.
    - data.sql         table contents (INSERT statements) - contains real
                       children's names/ages - gitignored, local only.
  Also concatenates both into full_backup.sql for a one-file restore.

.PARAMETER DbUrl
  Postgres connection string (percent-encoded), e.g.
  postgresql://postgres:PASSWORD@HOST:5432/postgres
  If omitted, the script reads DATABASE_URL from backup/.env.local.

.PARAMETER PgBinDir
  Directory containing pg_dump.exe. Defaults to C:\pgclient17\bin (where the
  PostgreSQL 17 client-only tools were installed via winget --extract-only).

.EXAMPLE
  ./backup/backup-database.ps1
  ./backup/backup-database.ps1 -DbUrl "postgresql://postgres:...@...:5432/postgres"
#>
param(
    [string]$DbUrl,
    [string]$PgBinDir = 'C:\pgclient17\bin'
)

$ErrorActionPreference = 'Stop'

$backupDir = Join-Path $PSScriptRoot 'database'
$envLocalPath = Join-Path $PSScriptRoot '.env.local'
$pgDump = Join-Path $PgBinDir 'pg_dump.exe'

if (-not (Test-Path $pgDump)) {
    Write-Error "pg_dump.exe not found at $pgDump. Pass -PgBinDir, or reinstall PostgreSQL 17 client tools (winget install --id PostgreSQL.PostgreSQL.17 --override '--mode unattended --unattendedmodeui minimal --extract-only 1 --installdir C:\pgclient17')."
}

if (-not $DbUrl) {
    if (-not (Test-Path $envLocalPath)) {
        Write-Error "No -DbUrl given and $envLocalPath not found. Copy backup/.env.local.example to backup/.env.local and fill in DATABASE_URL, or pass -DbUrl."
    }

    $line = Get-Content $envLocalPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $line) {
        Write-Error "DATABASE_URL not found in $envLocalPath"
    }
    $DbUrl = ($line -split '=', 2)[1].Trim()
}

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$schemaFile = Join-Path $backupDir 'schema.sql'
$dataFile = Join-Path $backupDir 'data.sql'
$fullFile = Join-Path $backupDir 'full_backup.sql'

Write-Host "Dumping schema -> $schemaFile"
& $pgDump --dbname=$DbUrl --schema-only --no-owner --no-privileges --file=$schemaFile
if ($LASTEXITCODE -ne 0) { Write-Error "Schema dump failed (exit $LASTEXITCODE)" }

Write-Host "Dumping data -> $dataFile"
& $pgDump --dbname=$DbUrl --data-only --no-owner --no-privileges --file=$dataFile
if ($LASTEXITCODE -ne 0) { Write-Error "Data dump failed (exit $LASTEXITCODE)" }

Write-Host "Combining -> $fullFile"
Get-Content $schemaFile, $dataFile | Set-Content -Encoding utf8 $fullFile

$schemaSize = (Get-Item $schemaFile).Length
$dataSize = (Get-Item $dataFile).Length
Write-Host "Done. schema.sql: $schemaSize bytes, data.sql: $dataSize bytes."
Write-Host "Reminder: data.sql and full_backup.sql contain real children's personal data and are gitignored - only schema.sql is meant to be committed."
