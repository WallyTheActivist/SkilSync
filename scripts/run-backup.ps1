[CmdletBinding()]
param(
  [string]$BackupRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) 'SkillSync-backups\automated'),
  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackupAutomation.Common.ps1')

$runId = Get-BackupRunId
$startedAt = (Get-Date).ToUniversalTime()
$script:AttemptStatePath = $null
$script:RunMetadataPath = $null
$script:BackupLogPath = $null
$script:BackupRecord = [ordered]@{
  version = 1
  runId = $runId
  startedAtUtc = $startedAt.ToString('o')
  completedAtUtc = $null
  backupRoot = [System.IO.Path]::GetFullPath($BackupRoot)
  status = 'running'
  components = [ordered]@{
    source = [ordered]@{ status = 'pending'; location = $null; fileCount = 0; totalBytes = 0; artifacts = @(); validation = 'not_run'; errorSummary = $null }
    database = [ordered]@{ status = 'pending'; location = $null; fileCount = 0; totalBytes = 0; artifacts = @(); validation = 'not_run'; errorSummary = $null }
    uploads = [ordered]@{ status = 'pending'; location = $null; fileCount = 0; totalBytes = 0; artifacts = @(); validation = 'not_run'; errorSummary = $null }
    configuration = [ordered]@{ status = 'pending'; location = $null; fileCount = 0; totalBytes = 0; artifacts = @(); validation = 'not_run'; errorSummary = $null }
  }
}

$mutex = $null
try {
  New-Item -ItemType Directory -Path $script:StatusRoot -Force | Out-Null
  $attemptDirectory = Join-Path $script:StatusRoot 'attempts'
  $logDirectory = Join-Path $script:StatusRoot 'logs'
  New-Item -ItemType Directory -Path $attemptDirectory -Force | Out-Null
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $script:AttemptStatePath = Join-Path $attemptDirectory "$runId.json"
  $script:BackupLogPath = Join-Path $logDirectory "$runId.log"
  Write-BackupLog "Backup run $runId started."
  Write-BackupAttemptState

  $mutex = Enter-BackupMutex -BackupRoot $BackupRoot

  $requestedRoot = [System.IO.Path]::GetFullPath($BackupRoot)
  $projectPrefix = $script:ProjectRoot + '\'
  if (
    [string]::Equals($requestedRoot.TrimEnd('\'), $script:ProjectRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $requestedRoot.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)
  ) {
    throw 'The automated backup root must be outside the project directory.'
  }
  Assert-NoReparsePath -Path $requestedRoot
  if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
  }
  Assert-NoReparsePath -Path $BackupRoot
  $resolvedRoot = (Resolve-Path -LiteralPath $BackupRoot).Path
  if (
    [string]::Equals($resolvedRoot, $script:ProjectRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $resolvedRoot.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)
  ) {
    throw 'The automated backup root must be outside the project directory.'
  }
  Assert-NoReparsePath -Path $resolvedRoot

  $runsDirectory = Join-Path $resolvedRoot 'runs'
  New-Item -ItemType Directory -Path $runsDirectory -Force | Out-Null
  Assert-NoReparsePath -Path $runsDirectory
  $runDirectory = Join-Path $runsDirectory $runId
  New-Item -ItemType Directory -Path $runDirectory -ErrorAction Stop | Out-Null
  Assert-NoReparseTree -Path $runDirectory
  $script:RunMetadataPath = Join-Path $runDirectory 'run.json'
  $script:BackupRecord.runDirectory = $runDirectory
  Write-BackupAttemptState

  $components = @(
    @{ name = 'source'; script = 'backup-source.ps1' },
    @{ name = 'database'; script = 'backup-database.ps1' },
    @{ name = 'uploads'; script = 'backup-uploads.ps1' }
  )
  foreach ($entry in $components) {
    $componentDirectory = Join-Path $runDirectory $entry.name
    New-Item -ItemType Directory -Path $componentDirectory -Force | Out-Null
    Invoke-BackupComponent `
      -Name $entry.name `
      -ScriptPath (Join-Path $PSScriptRoot $entry.script) `
      -DestinationDirectory $componentDirectory `
      -Component $script:BackupRecord.components[$entry.name]
  }

  $configuration = $script:BackupRecord.components.configuration
  $configurationDirectory = Join-Path $runDirectory 'configuration'
  New-Item -ItemType Directory -Path $configurationDirectory -Force | Out-Null
  if ($NonInteractive) {
    $configuration.status = 'manual_required'
    $configuration.location = $configurationDirectory
    $configuration.validation = 'not_run'
    $configuration.summary = 'Interactive configuration encryption is required; no passphrase was stored or requested.'
  } else {
    Invoke-BackupComponent `
      -Name 'configuration' `
      -ScriptPath (Join-Path $PSScriptRoot 'backup-config.ps1') `
      -DestinationDirectory $configurationDirectory `
      -Component $configuration
  }
  if ($configuration.status -eq 'manual_required') {
    Write-BackupLog 'Configuration component requires a separate interactive backup; this run is incomplete.'
  }

  $states = Get-RunComponentStates -Record $script:BackupRecord
  if (@($states | Where-Object Status -eq 'succeeded').Count -eq 4) {
    $script:BackupRecord.status = 'complete'
  } elseif (@($states | Where-Object { $_.Status -in @('succeeded', 'manual_required') }).Count -gt 0) {
    $script:BackupRecord.status = 'partial'
  } else {
    $script:BackupRecord.status = 'failed'
  }
  if ($configuration.status -eq 'failed') { $script:BackupRecord.status = 'partial' }
} catch {
  $script:BackupRecord.status = if (@((Get-RunComponentStates -Record $script:BackupRecord) | Where-Object Status -eq 'succeeded').Count -gt 0) { 'partial' } else { 'failed' }
  $script:BackupRecord.errorSummary = $_.Exception.Message
  if ($script:BackupRecord.components) {
    foreach ($component in $script:BackupRecord.components.Values) {
      if ($component.status -eq 'pending') {
        $component.status = 'failed'
        $component.validation = 'not_run'
        $component.errorSummary = 'The backup run stopped before this component started.'
      }
    }
  }
  Write-BackupLog "Backup run failed: $($_.Exception.Message)"
} finally {
  $script:BackupRecord.completedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  Write-BackupAttemptState
  if ($mutex) {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
  }
}

if ($script:BackupRecord.status -ne 'complete') {
  Write-Error "Backup run $runId finished with status '$($script:BackupRecord.status)'. Inspect backup status and logs."
  exit 1
}
Write-Host "Backup run $runId completed and verified."
Write-Host "Run metadata: $script:RunMetadataPath"
exit 0
