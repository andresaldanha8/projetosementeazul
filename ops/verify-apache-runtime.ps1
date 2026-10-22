param(
    [Parameter(Mandatory=$true)][string]$PhpRoot,
    [Parameter(Mandatory=$true)][string]$OutputRoot
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$phpHome=(Resolve-Path -LiteralPath $PhpRoot).Path.Replace('\','/')
$testRoot=Join-Path $OutputRoot ('apache-probe-'+[Guid]::NewGuid().ToString('N'))
$web=Join-Path $testRoot 'web'
New-Item -ItemType Directory -Path $web -Force | Out-Null
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop()
$slashRoot=$testRoot.Replace('\','/')
$slashWeb=$web.Replace('\','/')
$probe=@'
<?php
header('Content-Type: application/json');
$keys=['memory_limit','post_max_size','upload_max_filesize','max_execution_time','date.timezone','session.save_path','upload_tmp_dir','include_path','extension_dir','curl.cainfo','openssl.cafile'];
$settings=[];foreach($keys as $key)$settings[$key]=ini_get($key);
echo json_encode(['version'=>PHP_VERSION,'sapi'=>PHP_SAPI,'zts'=>PHP_ZTS,'bits'=>PHP_INT_SIZE*8,'ini'=>php_ini_loaded_file(),'modules'=>get_loaded_extensions(),'settings'=>$settings]);
'@
[IO.File]::WriteAllText((Join-Path $web 'runtime.php'),$probe,[Text.UTF8Encoding]::new($false))
$conf=@"
ServerRoot "C:/xampp/apache"
Listen 127.0.0.1:$port
ServerName localhost
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule mime_module modules/mod_mime.so
LoadModule socache_shmcb_module modules/mod_socache_shmcb.so
LoadModule ssl_module modules/mod_ssl.so
LoadFile "$phpHome/brotlicommon.dll"
LoadFile "$phpHome/brotlidec.dll"
LoadFile "$phpHome/libssh2.dll"
LoadFile "$phpHome/nghttp2.dll"
LoadFile "$phpHome/php8ts.dll"
LoadFile "$phpHome/libpq.dll"
LoadFile "$phpHome/libsqlite3.dll"
LoadModule php_module "$phpHome/php8apache2_4.dll"
PHPIniDir "$phpHome"
TypesConfig conf/mime.types
DocumentRoot "$slashWeb"
PidFile "$slashRoot/httpd.pid"
ErrorLog "$slashRoot/error.log"
<Directory "$slashWeb">
  AllowOverride None
  Require local
</Directory>
<FilesMatch "\.php$">
  SetHandler application/x-httpd-php
</FilesMatch>
"@
$config=Join-Path $testRoot 'httpd.conf'
[IO.File]::WriteAllText($config,$conf,[Text.UTF8Encoding]::new($false))
& C:/xampp/apache/bin/httpd.exe -f $config -t
if($LASTEXITCODE -ne 0){throw 'Apache configuration rejected'}
$apache=Start-Process -FilePath C:/xampp/apache/bin/httpd.exe -ArgumentList @('-f',('"'+$config+'"'),'-X') -PassThru -WindowStyle Hidden
try {
    $response=$null
    for($attempt=0;$attempt -lt 60;$attempt++){
        if($apache.HasExited){throw 'Apache exited; inspect private error log'}
        try{$response=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$port+'/runtime.php') -TimeoutSec 2;break}catch{Start-Sleep -Milliseconds 100}
    }
    if(-not $response){throw 'Apache HTTP probe timed out'}
    $response | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $testRoot 'result.json') -Encoding UTF8
    if($response.sapi -ne 'apache2handler' -or $response.version -ne '8.2.35'){throw 'Unexpected web PHP runtime'}
    foreach($extension in @('PDO','pdo_mysql','curl','mbstring','dom','mysqli','openssl','zip','fileinfo','pdo_sqlite')){
        if($response.modules -notcontains $extension){throw ('Missing web extension: '+$extension)}
    }
    [pscustomobject]@{Version=$response.version;SAPI=$response.sapi;Bits=$response.bits;ThreadSafe=$response.zts;Modules=$response.modules.Count;Ini=$response.ini;Evidence=(Join-Path $testRoot 'result.json')} | Format-List
} finally {
    if(-not $apache.HasExited){Stop-Process -Id $apache.Id; $apache.WaitForExit()}
}
