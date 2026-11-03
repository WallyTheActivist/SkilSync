[CmdletBinding()]
param(
  [string]$DestinationDirectory
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
if ([string]::IsNullOrWhiteSpace($DestinationDirectory)) {
  $DestinationDirectory = Join-Path (Split-Path $projectRoot -Parent) 'SkillSync-backups'
}

$destinationPath = [System.IO.Path]::GetFullPath($DestinationDirectory)
$projectPrefix = $projectRoot + '\'
if (
  [string]::Equals($destinationPath, $projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
  $destinationPath.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)
) {
  throw 'The backup destination must be outside the project directory.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivePath = Join-Path $destinationPath "skillsync-source-$timestamp.zip"
$temporaryArchivePath = Join-Path $destinationPath ".skillsync-source-$timestamp-$([guid]::NewGuid().ToString('N')).tmp.zip"

$excludedDirectories = @(
  '.git', '.sixth', '.idea', '.vscode',
  'node_modules', 'dist', 'build', 'coverage',
  '.vite', '.cache', '.turbo', '.next',
  '__pycache__', '.pytest_cache',
  'uploads', 'backup', 'backups'
)

function Test-ExcludedFile {
  param([System.IO.FileInfo]$File)

  $name = $File.Name
  if ($name -eq '.env.example') { return $false }
  if ($name -match '^\.env(?:\.|$)') { return $true }
  if ($name -match '(?i)\.(?:db(?:-|$)|sqlite(?:3)?(?:-|$))') { return $true }
  if ($name -match '(?i)\.(?:bak|backup)(?:\.|$)') { return $true }
  if ($name -match '(?i)\.(?:log|tmp|temp|swp|swo)$' -or $name -eq 'out.txt') { return $true }
  if ($name -match '(?i)\.(?:pem|key|pfx|p12)$' -or $name -match '^(?:id_rsa|id_ed25519)') { return $true }
  if ($name -match '(?i)^skillsync-source-.*\.zip$') { return $true }
  if ($name -in @('Thumbs.db', '.DS_Store', '.npmrc')) { return $true }
  return $false
}

function Get-SourceFiles {
  param([string]$Directory)

  foreach ($file in Get-ChildItem -LiteralPath $Directory -File -Force) {
    if (($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0 -and -not (Test-ExcludedFile $file)) {
      $file.FullName
    }
  }

  foreach ($childDirectory in Get-ChildItem -LiteralPath $Directory -Directory -Force) {
    if (
      ($childDirectory.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0 -and
      $excludedDirectories -notcontains $childDirectory.Name
    ) {
      Get-SourceFiles -Directory $childDirectory.FullName
    }
  }
}

try {
  if (Test-Path -LiteralPath $archivePath) {
    throw "A backup already exists at '$archivePath'; refusing to overwrite it."
  }

  if (-not (Test-Path -LiteralPath $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath | Out-Null
  }

  $sourceFiles = @(Get-SourceFiles -Directory $projectRoot)
  if ($sourceFiles.Count -eq 0) {
    throw 'No source files were found to archive.'
  }

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $archive = [System.IO.Compression.ZipFile]::Open(
    $temporaryArchivePath,
    [System.IO.Compression.ZipArchiveMode]::Create
  )
  try {
    foreach ($sourceFile in $sourceFiles) {
      $entryName = $sourceFile.Substring($projectRoot.Length).TrimStart('\') -replace '\\', '/'
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $sourceFile,
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  } finally {
    $archive.Dispose()
  }

  $readArchive = [System.IO.Compression.ZipFile]::OpenRead($temporaryArchivePath)
  try {
    $entryNames = @($readArchive.Entries | ForEach-Object { $_.FullName })
    $requiredEntries = @(
      '.gitignore',
      'BACKUP_AND_RECOVERY.md',
      'server/.env.example',
      'client/package.json',
      'client/package-lock.json',
      'client/src/App.tsx',
      'server/package.json',
      'server/package-lock.json',
      'server/prisma/schema.prisma',
      'server/prisma/migrations/20260609231532_init/migration.sql',
      'docs/technical/README.md'
    )

    foreach ($requiredEntry in $requiredEntries) {
      if ($entryNames -notcontains $requiredEntry) {
        throw "The archive is missing required project file '$requiredEntry'."
      }
    }

    foreach ($entry in $readArchive.Entries) {
      if (
        $entry.FullName -match '(^|/)(?:node_modules|dist|build|uploads|backups?|\.git|\.sixth)/' -or
        ($entry.FullName -match '(^|/)\.env(?:\.|$)' -and $entry.FullName -notmatch '(^|/)\.env\.example$') -or
        $entry.FullName -match '(?i)\.(?:db(?:-|$)|sqlite(?:3)?(?:-|$))'
      ) {
        throw "The archive contains an excluded path: '$($entry.FullName)'."
      }

      $entryStream = $entry.Open()
      try {
        $entryStream.CopyTo([System.IO.Stream]::Null)
      } finally {
        $entryStream.Dispose()
      }
    }
  } finally {
    $readArchive.Dispose()
  }

  if ((Get-Item -LiteralPath $temporaryArchivePath).Length -eq 0) {
    throw 'The generated archive is empty.'
  }

  [System.IO.File]::Move($temporaryArchivePath, $archivePath)
  Write-Host "Source backup created and validated: $archivePath"
  Write-Host "Files archived: $($sourceFiles.Count)"
} catch {
  if (Test-Path -LiteralPath $temporaryArchivePath) {
    Remove-Item -LiteralPath $temporaryArchivePath
  }
  Write-Error "Source backup failed: $($_.Exception.Message)"
  exit 1
}
