$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$script:SqliteHelperPath = Join-Path $PSScriptRoot 'sqlite_database.py'
$script:PrismaSchemaPath = Join-Path $script:ProjectRoot 'server\prisma\schema.prisma'

function Get-ConfiguredDatabasePath {
  $serverDirectory = Join-Path $script:ProjectRoot 'server'
  $resolver = @'
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const schemaDirectory = path.resolve('prisma');
const envPath = path.resolve('.env');
const fileValues = fs.existsSync(envPath)
  ? dotenv.parse(fs.readFileSync(envPath, 'utf8'))
  : {};
const configuredUrl = Object.prototype.hasOwnProperty.call(process.env, 'DATABASE_URL')
  ? process.env.DATABASE_URL
  : fileValues.DATABASE_URL;

if (!configuredUrl || !/^file:/i.test(configuredUrl)) {
  console.error('A local SQLite DATABASE_URL could not be resolved.');
  process.exit(2);
}

let filename = configuredUrl.slice(5).split('?')[0];
try {
  filename = decodeURIComponent(filename);
} catch {
  console.error('The configured SQLite file path is invalid.');
  process.exit(2);
}

if (/^\/{3}[A-Za-z]:\//.test(filename)) {
  filename = filename.slice(3).replace(/\//g, '\\');
} else if (/^\/{2}/.test(filename)) {
  console.error('Network and UNC SQLite paths are not supported for local backups.');
  process.exit(2);
} else if (/^\/[A-Za-z]:\//.test(filename)) {
  filename = filename.slice(1).replace(/\//g, '\\');
} else if (path.win32.isAbsolute(filename)) {
  filename = path.win32.normalize(filename);
} else {
  filename = path.resolve(schemaDirectory, filename);
}

process.stdout.write(path.win32.resolve(filename));
'@

  Push-Location -LiteralPath $serverDirectory
  try {
    $resolvedPath = & node -e $resolver
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($resolvedPath -join ''))) {
      throw 'Could not resolve the local SQLite database path from the application configuration.'
    }
  } finally {
    Pop-Location
  }

  $databasePath = [System.IO.Path]::GetFullPath(($resolvedPath -join '').Trim())
  if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
    throw 'The configured SQLite database file does not exist.'
  }
  return $databasePath
}

function Assert-NoReparsePointInExistingPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $currentPath = [System.IO.Path]::GetFullPath($Path)
  while (-not [string]::IsNullOrWhiteSpace($currentPath)) {
    if (Test-Path -LiteralPath $currentPath) {
      $item = Get-Item -LiteralPath $currentPath -Force
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Backup and restore paths cannot traverse symbolic links or reparse points.'
      }
    }

    $parentPath = [System.IO.Directory]::GetParent($currentPath)
    if ($null -eq $parentPath) { break }
    $currentPath = $parentPath.FullName
  }
}

function Assert-OutsideProject {
  param([Parameter(Mandatory = $true)][string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
  $projectPrefix = $script:ProjectRoot + '\'
  if (
    [string]::Equals($fullPath, $script:ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $fullPath.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)
  ) {
    throw 'Database backups must be stored outside the project directory.'
  }
}

function Invoke-SqliteDatabaseHelper {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $python = Get-Command python.exe -ErrorAction Stop
  & $python.Source $script:SqliteHelperPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw 'SQLite backup or validation failed; see the error reported above.'
  }
}
