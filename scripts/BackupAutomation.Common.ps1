$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$script:PowerShellExecutable = Join-Path $PSHOME 'powershell.exe'
$script:StatusRoot = Join-Path $env:LOCALAPPDATA 'SkillSync\backup-status'

function Get-BackupRunId {
  $timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
  return "$timestamp-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
}

function Get-BackupMutexName {
  param([Parameter(Mandatory = $true)][string]$BackupRoot)

  $canonicalRoot = [System.IO.Path]::GetFullPath($BackupRoot).TrimEnd('\').ToLowerInvariant()
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($canonicalRoot))
    $mutexHash = [BitConverter]::ToString($hashBytes).Replace('-', '').Substring(0, 24)
    return 'Local\SkillSyncBackup-' + $mutexHash
  } finally {
    $sha256.Dispose()
  }
}

function Assert-NoReparsePath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetPathRoot($fullPath)
  $current = $fullPath
  while ($current) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "A backup path contains a symbolic link or junction: $current"
      }
    }
    if ([string]::Equals($current, $root, [StringComparison]::OrdinalIgnoreCase)) {
      break
    }
    $parent = [System.IO.Directory]::GetParent($current)
    if (-not $parent) {
      break
    }
    $current = $parent.FullName
  }
}

function Assert-NoReparseTree {
  param([Parameter(Mandatory = $true)][string]$Path)

  Assert-NoReparsePath -Path $Path
  $rootItem = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if (-not $rootItem.PSIsContainer) {
    return
  }

  $pendingDirectories = [System.Collections.Generic.Queue[string]]::new()
  $pendingDirectories.Enqueue($rootItem.FullName)
  while ($pendingDirectories.Count -gt 0) {
    $directory = $pendingDirectories.Dequeue()
    foreach ($item in Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop) {
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "A backup tree contains a symbolic link or junction: $($item.FullName)"
      }
      if ($item.PSIsContainer) {
        $pendingDirectories.Enqueue($item.FullName)
      }
    }
  }
}

function Enter-BackupMutex {
  param([Parameter(Mandatory = $true)][string]$BackupRoot)

  $mutex = [System.Threading.Mutex]::new($false, (Get-BackupMutexName -BackupRoot $BackupRoot))
  try {
    $acquired = $mutex.WaitOne(0)
  } catch [System.Threading.AbandonedMutexException] {
    $acquired = $true
  }
  if (-not $acquired) {
    $mutex.Dispose()
    throw 'Another backup or retention operation is already active for this destination.'
  }
  return $mutex
}

function Write-BackupJson {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][object]$Value
  )

  $temporaryPath = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
  $json = $Value | ConvertTo-Json -Depth 12
  try {
    [System.IO.File]::WriteAllText($temporaryPath, $json, [System.Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath $Path) {
      $replaceBackupPath = "$Path.$([guid]::NewGuid().ToString('N')).previous"
      [System.IO.File]::Replace($temporaryPath, $Path, $replaceBackupPath)
      Remove-Item -LiteralPath $replaceBackupPath -Force
    } else {
      [System.IO.File]::Move($temporaryPath, $Path)
    }
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

function Get-DirectoryMetrics {
  param([Parameter(Mandatory = $true)][string]$Path)

  $files = @(Get-ChildItem -LiteralPath $Path -File -Recurse -Force)
  $bytes = [long](($files | Measure-Object -Property Length -Sum).Sum)
  if ($null -eq $bytes) { $bytes = 0 }
  return [pscustomobject]@{ FileCount = $files.Count; TotalBytes = $bytes }
}

function Get-BackupArtifactMetadata {
  param(
    [Parameter(Mandatory = $true)][string]$RunDirectory,
    [Parameter(Mandatory = $true)][string]$ComponentDirectory
  )

  $files = @(Get-ChildItem -LiteralPath $ComponentDirectory -File -Recurse -Force)
  $artifacts = @()
  foreach ($file in $files) {
    if (($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'A generated backup artifact is a reparse point.'
    }
    $relative = $file.FullName.Substring($RunDirectory.Length).TrimStart('\') -replace '\\', '/'
    $artifacts += [pscustomobject]@{
      path = $relative
      size = [long]$file.Length
      sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  return $artifacts
}

function Test-BackupComponentArtifacts {
  param(
    [Parameter(Mandatory = $true)][string]$RunDirectory,
    [Parameter(Mandatory = $true)][string]$ComponentName,
    [Parameter(Mandatory = $true)][object]$Component
  )

  $componentPath = [System.IO.Path]::GetFullPath((Join-Path $RunDirectory $ComponentName))
  if ([System.IO.Path]::GetFullPath([string]$Component.location) -ne $componentPath -or
      $Component.status -ne 'succeeded' -or $Component.validation -ne 'passed' -or
      -not (Test-Path -LiteralPath $componentPath -PathType Container)) {
    throw "The $ComponentName component metadata or directory is invalid."
  }
  Assert-NoReparseTree -Path $componentPath
  $componentItem = Get-Item -LiteralPath $componentPath -Force
  if (($componentItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "The $ComponentName component directory is a reparse point."
  }

  $files = @(Get-ChildItem -LiteralPath $componentPath -File -Recurse -Force)
  $bytes = [long](($files | Measure-Object -Property Length -Sum).Sum)
  if ($files.Count -eq 0 -or $files.Count -ne [int]$Component.fileCount -or
      $bytes -ne [long]$Component.totalBytes -or
      -not $Component.artifacts -or @($Component.artifacts).Count -ne $files.Count) {
    throw "The $ComponentName component file counts or sizes do not match its metadata."
  }

  $seenPaths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $verifiedBytes = 0L
  foreach ($artifact in $Component.artifacts) {
    $relativePath = [string]$artifact.path
    if (-not $relativePath -or $relativePath -match '(^|[\\/])\.\.?([\\/]|$)' -or
        [System.IO.Path]::IsPathRooted($relativePath) -or -not $seenPaths.Add($relativePath)) {
      throw "The $ComponentName component contains an unsafe or duplicate artifact path."
    }
    $artifactPath = [System.IO.Path]::GetFullPath((Join-Path $RunDirectory ($relativePath -replace '/', '\')))
    if (-not $artifactPath.StartsWith($componentPath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) {
      throw "The $ComponentName component has a missing or invalid artifact."
    }
    $artifactItem = Get-Item -LiteralPath $artifactPath -Force
    if (($artifactItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $artifactItem.Length -ne [long]$artifact.size) {
      throw "The $ComponentName component has an invalid artifact size or file type."
    }
    $actualHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne [string]$artifact.sha256) {
      throw "The $ComponentName component artifact hash does not match."
    }
    $verifiedBytes += [long]$artifact.size
  }
  if ($verifiedBytes -ne $bytes) {
    throw "The $ComponentName component artifact sizes do not match its files."
  }
  return $true
}

function Invoke-BackupComponent {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string]$DestinationDirectory,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Component,
    [string[]]$AdditionalArguments = @()
  )

  $Component.status = 'running'
  $Component.startedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  $Component.location = $DestinationDirectory
  Write-BackupAttemptState

  try {
    $arguments = @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', $ScriptPath,
      '-DestinationDirectory', $DestinationDirectory
    ) + $AdditionalArguments
    $output = @(& $script:PowerShellExecutable @arguments 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      throw "Component script returned exit code $exitCode."
    }

    Assert-NoReparseTree -Path $DestinationDirectory
    $metrics = Get-DirectoryMetrics -Path $DestinationDirectory
    if ($metrics.FileCount -eq 0 -or $metrics.TotalBytes -eq 0) {
      throw 'Component script reported success but produced no backup files.'
    }

    $Component.status = 'succeeded'
    $Component.fileCount = $metrics.FileCount
    $Component.totalBytes = $metrics.TotalBytes
    $Component.artifacts = @(Get-BackupArtifactMetadata `
      -RunDirectory $script:BackupRecord.runDirectory `
      -ComponentDirectory $DestinationDirectory)
    $Component.validation = 'passed'
    $Component.errorSummary = $null
    $Component.summary = 'Backup created and component-specific validation passed.'
    Write-BackupLog "$Name succeeded; files=$($metrics.FileCount); bytes=$($metrics.TotalBytes)."
  } catch {
    $Component.status = 'failed'
    $Component.validation = 'failed'
    $Component.errorSummary = $_.Exception.Message
    $Component.summary = 'Backup failed; inspect the local run log for the safe error summary.'
    Write-BackupLog "$Name failed: $($Component.errorSummary)"
  } finally {
    $Component.completedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    Write-BackupAttemptState
  }
}

function Write-BackupLog {
  param([Parameter(Mandatory = $true)][string]$Message)

  if ($script:BackupLogPath) {
    Add-Content -LiteralPath $script:BackupLogPath -Value "[$((Get-Date).ToUniversalTime().ToString('o'))] $Message" -Encoding UTF8
  }
}

function Write-BackupAttemptState {
  if ($script:AttemptStatePath -and $script:BackupRecord) {
    Write-BackupJson -Path $script:AttemptStatePath -Value $script:BackupRecord
  }
  if ($script:RunMetadataPath -and $script:BackupRecord -and (Test-Path -LiteralPath (Split-Path -Parent $script:RunMetadataPath))) {
    Write-BackupJson -Path $script:RunMetadataPath -Value $script:BackupRecord
  }
}

function Get-RunComponentStates {
  param([Parameter(Mandatory = $true)][object]$Record)

  $states = @()
  foreach ($name in @('source', 'database', 'uploads', 'configuration')) {
    $component = $Record.components.$name
    if ($component) {
      $states += [pscustomobject]@{ Name = $name; Status = [string]$component.status }
    }
  }
  return $states
}
