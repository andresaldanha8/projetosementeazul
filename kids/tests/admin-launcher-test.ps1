$ErrorActionPreference='Stop'
$project=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$global:kidsLauncherSecret=[Guid]::NewGuid().ToString('N')
$global:kidsLauncherPrompts=0
$testDir=Join-Path $project ('tmp/admin-launcher-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDir | Out-Null
$outputSql=Join-Path $testDir 'private first admin.sql'
function Read-Host {
 param([string]$Prompt,[switch]$AsSecureString)
 if(-not $AsSecureString){throw 'Secret input must be hidden'}
 $global:kidsLauncherPrompts++
 return ConvertTo-SecureString $global:kidsLauncherSecret -AsPlainText -Force
}
try{
 $name='Admin '+[char]0x00e1+' "local"'
 & (Join-Path $project 'kids/ops/Administrador-KIDS.ps1') -Php 'C:/xampp/php/php.exe' -Modo prepare-first-sql -ArquivoSql $outputSql -Login 'admin.launcher' -Nome $name
 $sql=[IO.File]::ReadAllText($outputSql)
 $hexName=([BitConverter]::ToString([Text.Encoding]::UTF8.GetBytes($name))).Replace('-','').ToLowerInvariant()
 if($global:kidsLauncherPrompts -ne 2 -or $sql.Contains($global:kidsLauncherSecret) -or -not $sql.Contains('0x'+$hexName)){throw 'Launcher payload mismatch'}
 Write-Host 'PASS hidden input twice; UTF-8 stdin; paths with spaces; quoted name; no plaintext password in generated SQL.'
}finally{
 $global:kidsLauncherSecret=$null
 # Delete only the newly-created private SQL, never an existing directory or wildcard.
 if(Test-Path -LiteralPath $outputSql){Remove-Item -LiteralPath $outputSql}
}
