[CmdletBinding()]
param(
  [string]$DestinationDirectory
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'FileArchive.Common.ps1')

$temporaryArchivePath = $null
try {
  if ([string]::IsNullOrWhiteSpace($DestinationDirectory)) {
    $DestinationDirectory = Join-Path (Split-Path $script:ProjectRoot -Parent) 'SkillSync-backups\uploads'
  }

  $destinationPath = [System.IO.Path]::GetFullPath($DestinationDirectory)
  Assert-FileArchivePathOutsideProject -Path $destinationPath
  if (-not (Test-Path -LiteralPath $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
  }
  $destinationPath = (Resolve-Path -LiteralPath $destinationPath).Path
  Assert-FileArchiveNoReparsePoints -Path $destinationPath

  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  $archivePath = Join-Path $destinationPath "skillsync-uploads-$timestamp.zip"
  $temporaryArchivePath = Join-Path $destinationPath ".skillsync-uploads-$timestamp-$([guid]::NewGuid().ToString('N')).tmp"
  if (Test-Path -LiteralPath $archivePath) {
    throw 'An upload backup with this timestamp already exists; refusing to overwrite it.'
  }

  Invoke-FileArchiveHelper -Arguments @(
    'backup-uploads',
    '--project-root', $script:ProjectRoot,
    '--output', $temporaryArchivePath
  )
  if (-not (Test-Path -LiteralPath $temporaryArchivePath -PathType Leaf) -or
      (Get-Item -LiteralPath $temporaryArchivePath).Length -eq 0) {
    throw 'The upload archive is missing or empty.'
  }
  Invoke-FileArchiveHelper -Arguments @('validate-uploads', '--archive', $temporaryArchivePath)
  [System.IO.File]::Move($temporaryArchivePath, $archivePath)
  $temporaryArchivePath = $null
  Write-Host "Upload backup created and validated: $archivePath"
} catch {
  Write-Error "Upload backup failed: $($_.Exception.Message)"
  exit 1
} finally {
  if ($temporaryArchivePath -and (Test-Path -LiteralPath $temporaryArchivePath)) {
    Remove-Item -LiteralPath $temporaryArchivePath -Force
  }
}
