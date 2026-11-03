[CmdletBinding()]
param(
  [string]$DestinationDirectory
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'FileArchive.Common.ps1')

$temporaryBackupPath = $null
$passphrase = $null
try {
  if ([string]::IsNullOrWhiteSpace($DestinationDirectory)) {
    $DestinationDirectory = Join-Path (Split-Path $script:ProjectRoot -Parent) 'SkillSync-backups\configuration'
  }

  $destinationPath = [System.IO.Path]::GetFullPath($DestinationDirectory)
  Assert-FileArchivePathOutsideProject -Path $destinationPath
  if (-not (Test-Path -LiteralPath $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
  }
  $destinationPath = (Resolve-Path -LiteralPath $destinationPath).Path
  Assert-FileArchiveNoReparsePoints -Path $destinationPath

  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  $backupPath = Join-Path $destinationPath "skillsync-config-$timestamp.sscfg"
  $temporaryBackupPath = Join-Path $destinationPath ".skillsync-config-$timestamp-$([guid]::NewGuid().ToString('N')).tmp"
  if (Test-Path -LiteralPath $backupPath) {
    throw 'A configuration backup with this timestamp already exists; refusing to overwrite it.'
  }

  $passphrase = New-ConfirmedConfigPassphrase
  Invoke-ConfigCryptoHelper -Operation 'encrypt' `
    -SourcePath $script:ProjectRoot `
    -OutputPath $temporaryBackupPath `
    -SecurePassphrase $passphrase

  if (-not (Test-Path -LiteralPath $temporaryBackupPath -PathType Leaf) -or
      (Get-Item -LiteralPath $temporaryBackupPath).Length -eq 0) {
    throw 'The encrypted configuration backup is missing or empty.'
  }
  [System.IO.File]::Move($temporaryBackupPath, $backupPath)
  $temporaryBackupPath = $null
  Write-Host "Encrypted configuration backup created and validated: $backupPath"
} catch {
  Write-Error "Configuration backup failed: $($_.Exception.Message)"
  exit 1
} finally {
  if ($passphrase) { $passphrase.Dispose() }
  if ($temporaryBackupPath -and (Test-Path -LiteralPath $temporaryBackupPath)) {
    Remove-Item -LiteralPath $temporaryBackupPath -Force
  }
}
