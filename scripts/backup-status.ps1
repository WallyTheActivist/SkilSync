[CmdletBinding()]
param(
  [string]$BackupRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) 'SkillSync-backups\automated')
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackupAutomation.Common.ps1')

$backupRootFull = [System.IO.Path]::GetFullPath($BackupRoot)
if (Test-Path -LiteralPath $BackupRoot -PathType Container) {
  Assert-NoReparsePath -Path $BackupRoot
}
$attemptDirectory = Join-Path $script:StatusRoot 'attempts'
$records = @()
if (Test-Path -LiteralPath $attemptDirectory -PathType Container) {
  foreach ($file in Get-ChildItem -LiteralPath $attemptDirectory -File -Filter '*.json') {
    try {
      $record = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
      if ($record.version -ne 1 -or -not $record.runId -or -not $record.startedAtUtc -or
          -not $record.status -or -not $record.backupRoot) {
        throw 'Invalid backup status record.'
      }
      $recordRoot = [System.IO.Path]::GetFullPath([string]$record.backupRoot)
      if ([string]::Equals($recordRoot, $backupRootFull, [StringComparison]::OrdinalIgnoreCase)) {
        $records += $record
      }
    } catch {
      Write-Error "Backup status metadata is invalid: $($file.Name)"
      exit 1
    }
  }
}

$records = @($records | Sort-Object { [DateTime]$_.startedAtUtc } -Descending)
$lastAttempt = $records | Select-Object -First 1
if ($lastAttempt) {
  $succeededComponents = @(
    'source', 'database', 'uploads', 'configuration' |
      Where-Object { $lastAttempt.components.$_.status -eq 'succeeded' }
  )
  if ($succeededComponents.Count -gt 0) {
    if ($lastAttempt.runId -notmatch '^\d{8}T\d{9}Z-[0-9a-f]{8}$' -or -not $lastAttempt.runDirectory) {
      throw 'The latest backup attempt has invalid run-directory metadata.'
    }
    $expectedRunDirectory = Join-Path (Join-Path $backupRootFull 'runs') $lastAttempt.runId
    if ([System.IO.Path]::GetFullPath([string]$lastAttempt.runDirectory) -ne
        [System.IO.Path]::GetFullPath($expectedRunDirectory)) {
      throw 'The latest backup attempt points outside its expected run directory.'
    }
    Assert-NoReparseTree -Path $expectedRunDirectory
    foreach ($componentName in $succeededComponents) {
      Test-BackupComponentArtifacts -RunDirectory $expectedRunDirectory `
        -ComponentName $componentName -Component $lastAttempt.components.$componentName | Out-Null
    }
  }
}
$verifiedRuns = @()
$runsDirectory = Join-Path $backupRootFull 'runs'
if (Test-Path -LiteralPath $runsDirectory -PathType Container) {
  Assert-NoReparsePath -Path $runsDirectory
  foreach ($runDirectory in Get-ChildItem -LiteralPath $runsDirectory -Directory -Force) {
    Assert-NoReparseTree -Path $runDirectory.FullName
    $metadataPath = Join-Path $runDirectory.FullName 'run.json'
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) { continue }
    try {
      $run = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
      if ($run.version -ne 1 -or $run.runId -ne $runDirectory.Name) {
        throw 'Invalid run metadata.'
      }
      if ($run.status -eq 'complete') {
        foreach ($componentName in @('source', 'database', 'uploads', 'configuration')) {
          $component = $run.components.$componentName
          if (-not $component) { throw 'Completed run is missing a component.' }
          Test-BackupComponentArtifacts -RunDirectory $runDirectory.FullName `
            -ComponentName $componentName -Component $component | Out-Null
        }
        $verifiedRuns += [pscustomobject]@{
          runId = $run.runId
          completedAtUtc = $run.completedAtUtc
          startedAtUtc = $run.startedAtUtc
        }
      }
    } catch {
      Write-Error "Backup run metadata or artifacts are invalid: $($runDirectory.Name)"
      exit 1
    }
  }
}
$verifiedRuns = @($verifiedRuns | Sort-Object { [DateTime]$_.startedAtUtc } -Descending)
$lastSuccess = $verifiedRuns | Select-Object -First 1

$destinationAccessible = Test-Path -LiteralPath $BackupRoot -PathType Container
Write-Output "Backup destination: $backupRootFull"
Write-Output "Destination accessible: $destinationAccessible"
Write-Output "Verified complete backup runs: $($verifiedRuns.Count)"
if ($lastSuccess) {
  Write-Output "Last verified complete run: $($lastSuccess.runId) at $($lastSuccess.completedAtUtc)"
} else {
  Write-Output 'Last verified complete run: none.'
}
if ($lastAttempt) {
  Write-Output "Last attempted run: $($lastAttempt.runId) at $($lastAttempt.startedAtUtc); status=$($lastAttempt.status)"
  foreach ($componentName in @('source', 'database', 'uploads', 'configuration')) {
    $component = $lastAttempt.components.$componentName
    Write-Output "  $componentName`: $($component.status); validation=$($component.validation); location=$($component.location)"
  }
  if ($lastAttempt.errorSummary) {
    Write-Output "Run error summary: $($lastAttempt.errorSummary)"
  }
} else {
  Write-Output 'Last attempted run: none recorded.'
}
