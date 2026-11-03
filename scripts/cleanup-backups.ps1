[CmdletBinding()]
param(
  [string]$BackupRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) 'SkillSync-backups\automated'),
  [switch]$DryRun,
  [switch]$ConfirmDeletion
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackupAutomation.Common.ps1')

if ($DryRun -and $ConfirmDeletion) {
  throw 'Choose either -DryRun or -ConfirmDeletion, not both.'
}
if (-not $DryRun -and -not $ConfirmDeletion) {
  throw 'No deletion was performed. Specify -DryRun or explicitly use -ConfirmDeletion.'
}
if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
  throw 'Backup destination is unavailable; no cleanup was performed.'
}

Assert-NoReparsePath -Path $BackupRoot
$resolvedRoot = (Resolve-Path -LiteralPath $BackupRoot).Path
Assert-NoReparsePath -Path $resolvedRoot
$projectPrefix = $script:ProjectRoot + '\'
if (
  [string]::Equals($resolvedRoot, $script:ProjectRoot, [StringComparison]::OrdinalIgnoreCase) -or
  $resolvedRoot.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)
) {
  throw 'The automated backup root must be outside the project directory.'
}

$mutex = Enter-BackupMutex -BackupRoot $resolvedRoot
try {
  $runsDirectory = Join-Path $resolvedRoot 'runs'
  if (-not (Test-Path -LiteralPath $runsDirectory -PathType Container)) {
    Write-Output 'No automated backup runs exist; nothing to clean.'
    exit 0
  }
  Assert-NoReparsePath -Path $runsDirectory

  $verifiedRuns = @()
  foreach ($runDirectory in Get-ChildItem -LiteralPath $runsDirectory -Directory -Force) {
    Assert-NoReparseTree -Path $runDirectory.FullName
    $metadataPath = Join-Path $runDirectory.FullName 'run.json'
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
      continue
    }

    try {
      $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    } catch {
      throw "Invalid backup metadata found in run directory '$($runDirectory.Name)'; cleanup refused."
    }
    if (($metadataPathItem = Get-Item -LiteralPath $metadataPath -Force) -and
        ($metadataPathItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Run metadata for '$($runDirectory.Name)' is a reparse point; cleanup refused."
    }
    if ($metadata.version -ne 1 -or $metadata.runId -ne $runDirectory.Name -or
        $metadata.status -notin @('running', 'complete', 'partial', 'failed')) {
      throw "Invalid backup metadata found in run directory '$($runDirectory.Name)'; cleanup refused."
    }
    if ($metadata.status -eq 'running') {
      throw 'A backup run is currently marked as running; cleanup refused.'
    }
    if ($metadata.status -ne 'complete') {
      continue
    }

    foreach ($componentName in @('source', 'database', 'uploads', 'configuration')) {
      $component = $metadata.components.$componentName
      if (-not $component -or -not $component.location) {
        throw "Completed run '$($runDirectory.Name)' has invalid component metadata; cleanup refused."
      }
      try {
        Test-BackupComponentArtifacts -RunDirectory $runDirectory.FullName `
          -ComponentName $componentName -Component $component | Out-Null
      } catch {
        throw "Completed run '$($runDirectory.Name)' failed $componentName artifact validation; cleanup refused."
      }
    }

    $startedAt = [DateTime]::Parse([string]$metadata.startedAtUtc).ToUniversalTime()
    $verifiedRuns += [pscustomobject]@{
      Id = $runDirectory.Name
      Path = $runDirectory.FullName
      StartedAtUtc = $startedAt
    }
  }

  $keepIds = @{}
  $ordered = @($verifiedRuns | Sort-Object StartedAtUtc -Descending)
  $dayBuckets = @{}
  foreach ($run in $ordered) {
    $key = $run.StartedAtUtc.ToString('yyyy-MM-dd')
    if (-not $dayBuckets.ContainsKey($key)) { $dayBuckets[$key] = $run }
  }
  foreach ($run in @($dayBuckets.Values | Sort-Object StartedAtUtc -Descending | Select-Object -First 7)) {
    $keepIds[$run.Id] = $true
  }

  $weekBuckets = @{}
  foreach ($run in $ordered) {
    $daysSinceMonday = ([int]$run.StartedAtUtc.DayOfWeek + 6) % 7
    $weekKey = $run.StartedAtUtc.Date.AddDays(-$daysSinceMonday).ToString('yyyy-MM-dd')
    if (-not $weekBuckets.ContainsKey($weekKey)) { $weekBuckets[$weekKey] = $run }
  }
  foreach ($run in @($weekBuckets.Values | Sort-Object StartedAtUtc -Descending | Select-Object -First 4)) {
    $keepIds[$run.Id] = $true
  }

  $monthBuckets = @{}
  foreach ($run in $ordered) {
    $monthKey = $run.StartedAtUtc.ToString('yyyy-MM')
    if (-not $monthBuckets.ContainsKey($monthKey)) { $monthBuckets[$monthKey] = $run }
  }
  foreach ($run in @($monthBuckets.Values | Sort-Object StartedAtUtc -Descending | Select-Object -First 3)) {
    $keepIds[$run.Id] = $true
  }

  if ($ordered.Count -gt 0) {
    $keepIds[$ordered[0].Id] = $true
  }

  $deleteRuns = @($ordered | Where-Object { -not $keepIds.ContainsKey($_.Id) })
  if ($DryRun) {
    Write-Output "Dry run only. Complete verified runs found: $($verifiedRuns.Count)."
    if ($deleteRuns.Count -eq 0) {
      Write-Output 'No complete verified runs qualify for deletion.'
    } else {
      foreach ($run in $deleteRuns) {
        Write-Output "Would delete verified run $($run.Id): $($run.Path)"
      }
    }
    Write-Output 'Partial, failed, running, and unrecognized directories are never selected for deletion.'
    exit 0
  }

  $deletionLogDirectory = Join-Path $script:StatusRoot 'logs'
  New-Item -ItemType Directory -Path $deletionLogDirectory -Force | Out-Null
  $deletionLogPath = Join-Path $deletionLogDirectory 'retention.log'
  foreach ($run in $deleteRuns) {
    $fullPath = [System.IO.Path]::GetFullPath($run.Path)
    if (-not [string]::Equals([System.IO.Path]::GetDirectoryName($fullPath), $runsDirectory, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'A retention candidate resolved outside the configured run directory; cleanup stopped.'
    }
    Assert-NoReparseTree -Path $fullPath
    $item = Get-Item -LiteralPath $fullPath -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'A retention candidate is a reparse point; cleanup stopped.'
    }
    Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction Stop
    Add-Content -LiteralPath $deletionLogPath -Value "[$((Get-Date).ToUniversalTime().ToString('o'))] Deleted verified backup run $($run.Id)." -Encoding UTF8
    Write-Output "Deleted verified backup run $($run.Id)."
  }
} finally {
  if ($mutex) {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
  }
}
