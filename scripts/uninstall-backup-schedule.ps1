[CmdletBinding()]
param(
  [string]$TaskName = 'SkillSync Daily Backups',
  [switch]$ConfirmRemoval,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($TaskName) -or
    [System.Management.Automation.WildcardPattern]::ContainsWildcardCharacters($TaskName) -or
    $TaskName.Contains('\') -or $TaskName.Contains('/')) {
  throw 'TaskName must identify one task in the root Task Scheduler folder.'
}
Import-Module ScheduledTasks -ErrorAction Stop
$task = Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Output "Scheduled task '$TaskName' is not installed."
  exit 0
}
if (-not $WhatIf -and -not $ConfirmRemoval) {
  throw 'No task was removed. Use -WhatIf to preview or -ConfirmRemoval to explicitly unregister it.'
}
if ($WhatIf) {
  Write-Output "WhatIf: would unregister '$TaskName'. Backup files and logs would not be deleted."
  exit 0
}
Unregister-ScheduledTask -TaskName $TaskName -TaskPath '\' -Confirm:$false -ErrorAction Stop
Write-Output "Unregistered '$TaskName'. Existing backups and logs were not deleted."
