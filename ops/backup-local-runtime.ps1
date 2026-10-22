param([string]$BackupParent = $env:TEMP)
$ErrorActionPreference = 'Stop'
# Backup only. Does not stop services, replace runtimes, copy databases or read app credentials.
$siteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$backupRoot = [IO.Path]::GetFullPath((Join-Path $BackupParent ('sementeazul-runtime-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))))
if ($backupRoot.StartsWith($siteRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'O backup deve ficar fora da raiz publicavel do site.'
}
New-Item -ItemType Directory -Path $backupRoot | Out-Null
$items = @{
    'php.ini' = 'C:\xampp\php\php.ini'
    'apache-conf' = 'C:\xampp\apache\conf'
    'xampp-control.ini' = 'C:\xampp\xampp-control.ini'
    'npm-user-config' = (Join-Path $env:USERPROFILE '.npmrc')
    'npm-global-config' = (Join-Path $env:APPDATA 'npm\etc\npmrc')
}
foreach ($item in $items.GetEnumerator()) {
    if (Test-Path -LiteralPath $item.Value) {
        Copy-Item -LiteralPath $item.Value -Destination (Join-Path $backupRoot $item.Key) -Recurse
    }
}
$inventory = [ordered]@{
    purpose = 'Private runtime configuration backup; may contain secrets; no app .env or database files copied'
    node = (& node --version)
    npm = (& npm.cmd --version)
    php = (& php -r 'echo PHP_VERSION;')
    nodeExecutable = (Get-Command node).Source
    phpExecutable = (Get-Command php).Source
    userPath = [Environment]::GetEnvironmentVariable('Path','User')
    machinePath = [Environment]::GetEnvironmentVariable('Path','Machine')
}
$inventory | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupRoot 'inventory.json') -Encoding UTF8
# Never print configuration contents: npm and Apache configuration may contain credentials.
Write-Output ('Backup privado criado: ' + $backupRoot)
