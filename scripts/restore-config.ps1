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
$passphrase = $null
try {
  if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
    throw 'The specified encrypted configuration backup does not exist.'
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
  $stagingPath = Join-Path $parentPath ".$([guid]::NewGuid().ToString('N')).config-restore.tmp"

  $passphrase = Read-Host 'Enter the configuration backup passphrase' -AsSecureString
  Invoke-ConfigCryptoHelper -Operation 'extract' `
    -SourcePath $resolvedBackupPath `
    -OutputPath $stagingPath `
    -SecurePassphrase $passphrase

  if (-not (Test-Path -LiteralPath $stagingPath -PathType Container)) {
    throw 'Configuration extraction did not produce the expected staging directory.'
  }
  if (Test-Path -LiteralPath $destinationFullPath) {
    throw 'The restore destination appeared during extraction; refusing to overwrite it.'
  }
  [System.IO.Directory]::Move($stagingPath, $destinationFullPath)
  $stagingPath = $null
  Write-Host "Configuration files restored to separate destination: $destinationFullPath"
  Write-Host 'Decryption, archive, manifest, and file hashes validated. No live .env file was changed.'
} catch {
  Write-Error "Configuration restore failed: $($_.Exception.Message)"
  exit 1
} finally {
  if ($passphrase) { $passphrase.Dispose() }
  if ($stagingPath -and (Test-Path -LiteralPath $stagingPath)) {
    Remove-Item -LiteralPath $stagingPath -Recurse -Force
  }
}
