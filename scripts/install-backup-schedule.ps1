[CmdletBinding()]
param(
  [string]$BackupRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) 'SkillSync-backups\automated'),
  [string]$DailyTime = '02:00',
  [string]$TaskName = 'SkillSync Daily Backups',
  [switch]$TestAction,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackupAutomation.Common.ps1')
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$resolvedScript = Join-Path $PSScriptRoot 'run-backup.ps1'

if ([string]::IsNullOrWhiteSpace($TaskName) -or
    [System.Management.Automation.WildcardPattern]::ContainsWildcardCharacters($TaskName) -or
    $TaskName.Contains('\') -or $TaskName.Contains('/')) {
  throw 'TaskName must identify one task in the root Task Scheduler folder.'
}
if ($BackupRoot.Contains('"') -or $resolvedScript.Contains('"')) {
  throw 'Backup root and script paths cannot contain double quotation marks.'
}
if ($TestAction -and $TaskName -eq 'SkillSync Daily Backups') {
  throw 'A harmless test action requires a uniquely named non-production task.'
}
$time = [TimeSpan]::Zero
if (-not [TimeSpan]::TryParse($DailyTime, [ref]$time) -or $time -ge [TimeSpan]::FromDays(1)) {
  throw 'DailyTime must be a valid 24-hour time such as 02:00.'
}

$backupRootFull = [System.IO.Path]::GetFullPath($BackupRoot)
Assert-NoReparsePath -Path $backupRootFull
$projectPrefix = $projectRoot + '\'
if (
  [string]::Equals($backupRootFull.TrimEnd('\'), $projectRoot, [StringComparison]::OrdinalIgnoreCase) -or
  $backupRootFull.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)
) {
  throw 'Scheduled backups must be stored outside the project directory.'
}

Import-Module ScheduledTasks -ErrorAction Stop
if (Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction SilentlyContinue) {
  throw "Scheduled task '$TaskName' already exists; it was not changed."
}

$powerShell = Join-Path $PSHOME 'powershell.exe'
if ($TestAction) {
  $arguments = '-NoProfile -NonInteractive -Command "exit 0"'
  $action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $env:TEMP
} else {
  $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
    $resolvedScript + '" -NonInteractive -BackupRoot "' + $backupRootFull + '"'
  $action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $projectRoot
}
$triggerTime = (Get-Date).Date.Add($time)
if ($triggerTime -le (Get-Date)) {
  $triggerTime = $triggerTime.AddDays(1)
}
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 12) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal `
  -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive `
  -RunLevel Limited
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description $(if ($TestAction) {
    'Harmless temporary SkillSync scheduler verification task; action exits without modifying files.'
  } else {
    'Creates daily SkillSync source, SQLite, and upload backups. Configuration backup remains interactive and is recorded as manual-required.'
  })

if ($WhatIf) {
  Write-Output "WhatIf: would register '$TaskName' for the current user at $DailyTime daily."
  if ($TestAction) {
    Write-Output 'The test action only starts PowerShell with an immediate successful exit.'
  } else {
    Write-Output 'The task runs only while this user is logged in; configuration remains a separate interactive step.'
  }
  Write-Output "Backup root: $backupRootFull"
  exit 0
}

Register-ScheduledTask -TaskName $TaskName -TaskPath '\' -InputObject $task -ErrorAction Stop | Out-Null
Write-Output "Registered '$TaskName' for the current user at $DailyTime daily."
if ($TestAction) {
  Write-Output 'The harmless test action exits without modifying files.'
  exit 0
}
Write-Output 'The task runs only while this user is logged in, skips overlapping runs, and starts missed work when possible.'
Write-Output 'Configuration backups remain manual; scheduled runs are reported as partial until that is addressed.'
Write-Output "Inspect with: Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Output "Run manually with: Start-ScheduledTask -TaskName '$TaskName'"
