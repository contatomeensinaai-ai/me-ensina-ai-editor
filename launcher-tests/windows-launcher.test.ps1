$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../launcher/open-editor.ps1')
Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Join-Path ([IO.Path]::GetTempPath()) ('meai-ps-tests-' + [Guid]::NewGuid().ToString())
[IO.Directory]::CreateDirectory($root) | Out-Null
$tests = 0
function Assert-True($value, [string]$message) { if (-not $value) { throw $message } }
function Assert-Throws([scriptblock]$action, [string]$message) { $threw=$false; try { & $action } catch { $threw=$true }; Assert-True $threw $message }
function New-TestZip([string]$name, [string[]]$entries, [bool]$symlink=$false) {
    $path = Join-Path $root ($name + '.zip')
    $zip = [IO.Compression.ZipFile]::Open($path, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($name in $entries) {
            $entry = $zip.CreateEntry($name)
            if ($symlink) { $entry.ExternalAttributes = -1610612736 }
            if (-not $name.EndsWith('/')) { $writer = [IO.StreamWriter]::new($entry.Open()); try { $writer.Write('fixture bytes') } finally { $writer.Dispose() } }
        }
    } finally { $zip.Dispose() }
    return $path
}
try {
    $manifestPath = Join-Path $root 'releases.json'
    $release = @{url='https://github.com/example/editor/releases/download/v0.2.0/editor.zip';sha256=('a'*64);packageDirectory='Me-Ensina-AI-Windows-0.2.0'}
    @{version='0.2.0';platforms=@{'win32-x64'=$release}} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath
    $read = Read-MeaiRelease $manifestPath
    Assert-True ($read.sha256 -ceq ('a'*64)) 'Valid manifest rejected'; $tests++
    foreach ($patch in @(@{sha256='pending'},@{packageDirectory='../escape'},@{url='https://evil.example/editor.zip'},@{url='http://github.com/example/editor/releases/download/v0.2.0/editor.zip'})) {
        $candidate=$release.Clone();foreach($key in $patch.Keys){$candidate[$key]=$patch[$key]}
        @{version='0.2.0';platforms=@{'win32-x64'=$candidate}} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath
        Assert-Throws { Read-MeaiRelease $manifestPath } 'Unsafe manifest accepted'; $tests++
    }
    $validZip=New-TestZip 'valid' @('package/','package/space name.txt')
    $dest=Join-Path $root 'valid-output'
    Expand-MeaiVerifiedZip $validZip $dest
    Assert-True ((Get-Content -LiteralPath (Join-Path $dest 'package/space name.txt') -Raw) -eq 'fixture bytes') 'ZIP byte roundtrip failed'; $tests++
    $cases=@(@('../escape.txt'),@('/absolute.txt'),@('folder\escape.txt'),@('C:/escape.txt'),@('folder/file:stream'),@('folder/NUL.txt'),@('folder/trailing. '),@('folder/Case.txt','folder/case.txt'))
    $index=0
    foreach($entries in $cases){
        $zip=New-TestZip ('unsafe-'+$index) $entries
        $dest=Join-Path $root ('unsafe-output-'+$index)
        Assert-Throws { Expand-MeaiVerifiedZip $zip $dest } 'Unsafe ZIP accepted'
        Assert-True (-not (Test-Path -LiteralPath $dest)) 'Unsafe ZIP wrote files before validation'; $tests++;$index++
    }
    $zip=New-TestZip 'symlink' @('folder/link') $true
    Assert-Throws { Expand-MeaiVerifiedZip $zip (Join-Path $root 'symlink-output') } 'Symlink accepted';$tests++
    Write-Output "$tests native PowerShell assertions passed. No download, account access, process launch or browser mutation."
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
