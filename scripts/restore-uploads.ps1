[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,

  [Parameter(Mandatory = $true)]
  [string]$DestinationPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'FileArchive.Common.ps1')

$stagingPath = $null
try {
  if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
    throw 'The specified upload backup does not exist.'
  }
  $resolvedBackupPath = (Resolve-Path -LiteralPath $BackupPath).Path
  Assert-FileArchiveNoReparsePoints -Path $resolvedBackupPath

  $destinationFullPath = [System.IO.Path]::GetFullPath($DestinationPath)
  Assert-FileArchivePathOutsideProject -Path $destinationFullPath
  if (Test-Path -LiteralPath $destinationFullPath) {
    throw 'The restore destination already exists; refusing to overwrite it.'
  }
  $parentPath = Split-Path -Parent $destinationFullPath
  if ([string]::IsNullOrWhiteSpace($parentPath) -or
      -not (Test-Path -LiteralPath $parentPath -PathType Container)) {
    throw 'The restore destination parent directory must already exist.'
  }
  $parentPath = (Resolve-Path -LiteralPath $parentPath).Path
  Assert-FileArchiveNoReparsePoints -Path $parentPath
  $destinationFullPath = Join-Path $parentPath (Split-Path -Leaf $destinationFullPath)
  $stagingPath = Join-Path $parentPath ".$([guid]::NewGuid().ToString('N')).uploads-restore.tmp"

  Invoke-FileArchiveHelper -Arguments @('validate-uploads', '--archive', $resolvedBackupPath)
  Invoke-FileArchiveHelper -Arguments @(
    'extract-uploads',
    '--archive', $resolvedBackupPath,
    '--destination', $stagingPath
  )
  if (Test-Path -LiteralPath $destinationFullPath) {
    throw 'The restore destination appeared during extraction; refusing to overwrite it.'
  }
  [System.IO.Directory]::Move($stagingPath, $destinationFullPath)
  $stagingPath = $null
  Write-Host "Upload files restored to separate destination: $destinationFullPath"
  Write-Host 'Manifest, CRC, file sizes, and SHA-256 hashes validated. The live uploads directory was not changed.'
} catch {
  Write-Error "Upload restore failed: $($_.Exception.Message)"
  exit 1
} finally {
  if ($stagingPath -and (Test-Path -LiteralPath $stagingPath)) {
    Remove-Item -LiteralPath $stagingPath -Recurse -Force
  }
}
