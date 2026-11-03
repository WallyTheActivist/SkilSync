[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,

  [Parameter(Mandatory = $true)]
  [string]$DestinationPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'SqliteDatabase.Common.ps1')

$temporaryDatabasePath = $null
try {
  $databasePath = Get-ConfiguredDatabasePath
  $configuredDatabasePath = (Resolve-Path -LiteralPath $databasePath).Path
  Assert-NoReparsePointInExistingPath -Path $configuredDatabasePath

  if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
    throw 'The specified backup file does not exist.'
  }
  $resolvedBackupPath = (Resolve-Path -LiteralPath $BackupPath).Path
  Assert-NoReparsePointInExistingPath -Path $resolvedBackupPath

  $destinationFullPath = [System.IO.Path]::GetFullPath($DestinationPath)
  $destinationDirectory = Split-Path -Parent $destinationFullPath
  if ([string]::IsNullOrWhiteSpace($destinationDirectory) -or
      -not (Test-Path -LiteralPath $destinationDirectory -PathType Container)) {
    throw 'The restore destination directory must already exist.'
  }
  $destinationDirectory = (Resolve-Path -LiteralPath $destinationDirectory).Path
  Assert-NoReparsePointInExistingPath -Path $destinationDirectory
  $destinationFullPath = Join-Path $destinationDirectory (Split-Path -Leaf $destinationFullPath)

  if ([string]::Equals(
    $destinationFullPath,
    $configuredDatabasePath,
    [System.StringComparison]::OrdinalIgnoreCase
  )) {
    throw 'Refusing to restore over the configured application database.'
  }
  if ([string]::Equals(
    $destinationFullPath,
    $resolvedBackupPath,
    [System.StringComparison]::OrdinalIgnoreCase
  )) {
    throw 'The restore destination cannot be the source backup.'
  }
  if (Test-Path -LiteralPath $destinationFullPath) {
    throw 'The restore destination already exists; refusing to overwrite it.'
  }

  $temporaryDatabasePath = Join-Path $destinationDirectory ".$([guid]::NewGuid().ToString('N')).restore.tmp"
  Invoke-SqliteDatabaseHelper -Arguments @(
    'restore',
    '--source', $resolvedBackupPath,
    '--destination', $temporaryDatabasePath,
    '--configured-database', $configuredDatabasePath,
    '--schema', $script:PrismaSchemaPath
  )

  if (-not (Test-Path -LiteralPath $temporaryDatabasePath -PathType Leaf)) {
    throw 'SQLite restore validation succeeded but the temporary restored file is missing.'
  }
  [System.IO.File]::Move($temporaryDatabasePath, $destinationFullPath)
  $temporaryDatabasePath = $null

  Write-Host "Database restored to separate destination: $destinationFullPath"
  Write-Host 'Validation: SQLite integrity passed; expected Prisma tables and all checked-in migrations present; foreign keys valid; table counts match the backup.'
  Write-Host 'The application database configuration was not changed.'
} catch {
  Write-Error "Database restore failed: $($_.Exception.Message)"
  exit 1
} finally {
  if ($temporaryDatabasePath -and (Test-Path -LiteralPath $temporaryDatabasePath)) {
    Remove-Item -LiteralPath $temporaryDatabasePath -Force
  }
}
