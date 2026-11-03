[CmdletBinding()]
param(
  [string]$DestinationDirectory
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'SqliteDatabase.Common.ps1')

$temporaryDatabasePath = $null
try {
  $databasePath = Get-ConfiguredDatabasePath
  Assert-NoReparsePointInExistingPath -Path $databasePath

  if ([string]::IsNullOrWhiteSpace($DestinationDirectory)) {
    $DestinationDirectory = Join-Path (Split-Path $script:ProjectRoot -Parent) 'SkillSync-backups\database'
  }

  $destinationPath = [System.IO.Path]::GetFullPath($DestinationDirectory)
  Assert-OutsideProject -Path $destinationPath
  if (-not (Test-Path -LiteralPath $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
  }
  $destinationPath = (Resolve-Path -LiteralPath $destinationPath).Path
  Assert-NoReparsePointInExistingPath -Path $destinationPath

  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  $backupPath = Join-Path $destinationPath "skillsync-database-$timestamp.sqlite"
  $temporaryDatabasePath = Join-Path $destinationPath ".skillsync-database-$timestamp-$([guid]::NewGuid().ToString('N')).tmp"

  if (Test-Path -LiteralPath $backupPath) {
    throw 'A database backup with this timestamp already exists; refusing to overwrite it.'
  }

  Invoke-SqliteDatabaseHelper -Arguments @(
    'backup',
    '--source', $databasePath,
    '--destination', $temporaryDatabasePath,
    '--schema', $script:PrismaSchemaPath
  )

  if (-not (Test-Path -LiteralPath $temporaryDatabasePath -PathType Leaf)) {
    throw 'SQLite backup validation succeeded but the temporary backup file is missing.'
  }
  [System.IO.File]::Move($temporaryDatabasePath, $backupPath)
  $temporaryDatabasePath = $null

  Write-Host "Database backup created: $backupPath"
  Write-Host 'Validation: SQLite integrity passed; expected Prisma tables and all checked-in migrations present; foreign keys valid.'
} catch {
  Write-Error "Database backup failed: $($_.Exception.Message)"
  exit 1
} finally {
  if ($temporaryDatabasePath -and (Test-Path -LiteralPath $temporaryDatabasePath)) {
    Remove-Item -LiteralPath $temporaryDatabasePath -Force
  }
}
