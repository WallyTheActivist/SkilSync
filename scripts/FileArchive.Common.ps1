$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$script:FileArchiveHelperPath = Join-Path $PSScriptRoot 'file_archives.py'
$script:ConfigCryptoHelperPath = Join-Path $PSScriptRoot 'config_crypto.js'

function Assert-FileArchivePathOutsideProject {
  param([Parameter(Mandatory = $true)][string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
  $projectPrefix = $script:ProjectRoot + '\'
  if (
    [string]::Equals($fullPath, $script:ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $fullPath.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)
  ) {
    throw 'Backups and restore destinations must be outside the project directory.'
  }
}

function Assert-FileArchiveNoReparsePoints {
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

function Get-FileArchivePython {
  $python = Get-Command python.exe -ErrorAction Stop
  return $python.Source
}

function Invoke-FileArchiveHelper {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $python = Get-FileArchivePython
  & $python $script:FileArchiveHelperPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw 'File archive validation or extraction failed; see the safe error reported above.'
  }
}

function Convert-SecureStringToInputBase64 {
  param([Parameter(Mandatory = $true)][System.Security.SecureString]$SecureValue)

  $pointer = [IntPtr]::Zero
  $bytes = $null
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
    return [Convert]::ToBase64String($bytes)
  } finally {
    if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    if ($pointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $plain = $null
  }
}

function Invoke-ConfigCryptoHelper {
  param(
    [Parameter(Mandatory = $true)][string]$Operation,
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][System.Security.SecureString]$SecurePassphrase
  )

  $base64 = Convert-SecureStringToInputBase64 -SecureValue $SecurePassphrase
  try {
    $python = Get-FileArchivePython
    $result = $base64 | & node.exe $script:ConfigCryptoHelperPath `
      $Operation $python $script:FileArchiveHelperPath $SourcePath $OutputPath
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      throw 'Configuration backup authentication or archive validation failed.'
    }
    if ($result) { $result }
  } finally {
    $base64 = $null
  }
}

function New-ConfirmedConfigPassphrase {
  $first = Read-Host 'Enter a portable backup passphrase (minimum 16 UTF-8 bytes)' -AsSecureString
  $second = Read-Host 'Confirm the portable backup passphrase' -AsSecureString
  $firstBytes = Convert-SecureStringToInputBase64 -SecureValue $first
  $secondBytes = Convert-SecureStringToInputBase64 -SecureValue $second
  $confirmed = $false
  try {
    if (-not [string]::Equals($firstBytes, $secondBytes, [StringComparison]::Ordinal)) {
      throw 'Passphrase confirmation did not match; no backup was created.'
    }
    if ($firstBytes.Length -lt 24) {
      throw 'The passphrase must contain at least 16 UTF-8 bytes; no backup was created.'
    }
    $confirmed = $true
    return $first
  } finally {
    $firstBytes = $null
    $secondBytes = $null
    $second.Dispose()
    if (-not $confirmed) { $first.Dispose() }
  }
}
