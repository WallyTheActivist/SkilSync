[CmdletBinding()]
param(
  [string]$DestinationDirectory,
  [string]$TemporaryDatabasePath
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
  if ([string]::IsNullOrWhiteSpace($TemporaryDatabasePath)) {
    $candidateTemporaryPath = Join-Path $destinationPath ".skillsync-database-$timestamp-$([guid]::NewGuid().ToString('N')).tmp"
    $temporaryHandle = $null
    try {
      $temporaryHandle = [System.IO.File]::Open(
        $candidateTemporaryPath,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
      )
      $temporaryDatabasePath = $candidateTemporaryPath
    } finally {
      if ($temporaryHandle) { $temporaryHandle.Dispose() }
    }
  } else {
    $candidateTemporaryPath = [System.IO.Path]::GetFullPath($TemporaryDatabasePath)
    if (
      -not [string]::Equals(
        (Split-Path -Parent $candidateTemporaryPath),
        $destinationPath,
        [System.StringComparison]::OrdinalIgnoreCase
      ) -or
      (Split-Path -Leaf $candidateTemporaryPath) -notmatch '^\.skillsync-database-\d{8}-\d{6}-\d{3}-[0-9a-f]{32}\.tmp$'
    ) {
      throw 'The operation-owned temporary backup path is invalid.'
    }
    if (-not (Test-Path -LiteralPath $candidateTemporaryPath -PathType Leaf)) {
      throw 'The operation-owned temporary backup file is missing.'
    }
    $temporaryItem = Get-Item -LiteralPath $candidateTemporaryPath -Force
    if (
      ($temporaryItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      $temporaryItem.Length -ne 0
    ) {
      throw 'The operation-owned temporary backup file is not an empty regular file.'
    }
    $temporaryDatabasePath = $candidateTemporaryPath
  }

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
