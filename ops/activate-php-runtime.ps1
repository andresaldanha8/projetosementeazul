param([Parameter(Mandatory=$true)][string]$Stage,[Parameter(Mandatory=$true)][string]$MaintenanceRoot)
$ErrorActionPreference='Stop'
$target=[IO.Path]::GetFullPath('C:\xampp\php').TrimEnd('\')
$staged=(Resolve-Path -LiteralPath $Stage).Path.TrimEnd('\')
$maintenance=(Resolve-Path -LiteralPath $MaintenanceRoot).Path.TrimEnd('\')
if($target -ne 'C:\xampp\php' -or -not $staged.StartsWith($maintenance+'\',[StringComparison]::OrdinalIgnoreCase)) {throw 'Unexpected runtime paths'}
if(Get-Process httpd,php,php-cgi -ErrorAction SilentlyContinue){throw 'PHP or Apache is running; no files changed'}
$rollback='C:\xampp\php-8.2.12-rollback-20261021'
if(Test-Path -LiteralPath $rollback){throw 'Rollback path already exists; inspect before continuing'}
$originalIniHash=(Get-FileHash -LiteralPath (Join-Path $target 'php.ini')).Hash
$verifiedBackup=Join-Path $maintenance 'rollback/php-8.2.12'
if((Get-FileHash -LiteralPath (Join-Path $verifiedBackup 'php.ini')).Hash -ne $originalIniHash){throw 'Configuration backup differs'}
if((& (Join-Path $staged 'php.exe') -r 'echo PHP_VERSION;') -ne '8.2.35'){throw 'Unexpected staged PHP'}
$conf='C:\xampp\apache\conf\extra\httpd-xampp.conf'
$oldConf=[IO.File]::ReadAllText($conf)
$originalConfCopy=Join-Path $maintenance 'httpd-xampp-before-activation.conf'
[IO.File]::WriteAllText($originalConfCopy,$oldConf,[Text.UTF8Encoding]::new($false))
$iniPath=Join-Path $staged 'php.ini'
$ini=[IO.File]::ReadAllText($iniPath)
$ini=$ini.Replace($staged.Replace('\','/')+'/ext','C:/xampp/php/ext')
[IO.File]::WriteAllText($iniPath,$ini,[Text.UTF8Encoding]::new($false))
$load=@'
# Dependencies shipped with the official PHP 8.2.35 package; Apache binaries are unchanged.
LoadFile "C:/xampp/php/brotlicommon.dll"
LoadFile "C:/xampp/php/brotlidec.dll"
LoadFile "C:/xampp/php/libssh2.dll"
LoadFile "C:/xampp/php/nghttp2.dll"
'@
$needle='LoadFile "C:/xampp/php/php8ts.dll"'
if(-not $oldConf.Contains($needle)){throw 'Unexpected Apache PHP configuration'}
$newConf=$oldConf.Replace($needle,$load+"`r`n"+$needle)
$oldMoved=$false;$newMoved=$false
try {
    # Both absolute move targets are explicitly checked above and remain inside C:/xampp.
    Move-Item -LiteralPath $target -Destination $rollback; $oldMoved=$true
    Move-Item -LiteralPath $staged -Destination $target; $newMoved=$true
    [IO.File]::WriteAllText($conf,$newConf,[Text.UTF8Encoding]::new($false))
    & C:/xampp/apache/bin/httpd.exe -t
    if($LASTEXITCODE -ne 0){throw 'Full Apache configuration rejected'}
    & powershell -NoProfile -File (Join-Path $PSScriptRoot 'verify-apache-runtime.ps1') -PhpRoot $target -OutputRoot $maintenance
    if($LASTEXITCODE -ne 0){throw 'Activated Apache runtime probe failed'}
    $oldModules=& (Join-Path $rollback 'php.exe') -d ('extension_dir='+$rollback+'/ext') -r 'echo json_encode(get_loaded_extensions());' | ConvertFrom-Json
    $newModules=& (Join-Path $target 'php.exe') -r 'echo json_encode(get_loaded_extensions());' | ConvertFrom-Json
    if(@($oldModules | Where-Object {$_ -notin $newModules}).Count){throw 'An active extension was lost'}
    [pscustomobject]@{version='8.2.35';target=$target;rollback=$rollback;oldApacheConfig=$originalConfCopy;activeExtensions=$newModules.Count} | ConvertTo-Json | Set-Content (Join-Path $maintenance 'php-activation.json') -Encoding UTF8
    Write-Output 'PHP 8.2.35 activated; full Apache configuration and private web probe passed.'
} catch {
    [IO.File]::WriteAllText($conf,$oldConf,[Text.UTF8Encoding]::new($false))
    if($newMoved){Move-Item -LiteralPath $target -Destination 'C:\xampp\php-8.2.35-failed-20261021'}
    if($oldMoved){Move-Item -LiteralPath $rollback -Destination $target}
    throw
}
