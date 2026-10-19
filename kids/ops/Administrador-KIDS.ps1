param(
 [Parameter(Mandatory=$true)][string]$Php,
 [string]$Raiz='',
 [string]$Banco='',
 [Parameter(Mandatory=$true)][string]$Login,
 [ValidateSet('create-first','reset-password','prepare-first-sql')][string]$Modo='create-first',
 [string]$Nome='',
 [string]$ArquivoSql=''
)
# Windows PowerShell 5.1 or PowerShell 7; never start a shell for the PHP child.
$ErrorActionPreference='Stop'
function ConvertTo-WindowsArgument([string]$value){
 $quoted='"';$slashes=0
 foreach($character in $value.ToCharArray()){
  if($character -eq '\'){$slashes++;continue}
  if($character -eq '"'){$quoted+=('\'*($slashes*2+1))+'"'}
  else{$quoted+=('\'*$slashes)+$character}
  $slashes=0
 }
 return $quoted+('\'*($slashes*2))+'"'
}
if($Modo -ne 'reset-password' -and [string]::IsNullOrWhiteSpace($Nome)){throw 'Informe -Nome para o primeiro administrador KIDS.'}
if($Modo -eq 'prepare-first-sql'){
 if([string]::IsNullOrWhiteSpace($ArquivoSql)){throw 'Informe -ArquivoSql fora de pastas públicas e sincronizadas.'}
 $arguments=@((Join-Path $PSScriptRoot 'prepare-first-admin.php'),$ArquivoSql,$Login,$Nome)
}else{
 if([string]::IsNullOrWhiteSpace($Raiz) -or [string]::IsNullOrWhiteSpace($Banco)){throw 'Informe -Raiz e -Banco para operação conectada KIDS.'}
 $arguments=@((Join-Path $PSScriptRoot 'admin-account.php'),$Raiz,$Banco,$Modo,$Login,$Nome)
}
$first=Read-Host 'Senha inicial KIDS (12 a 72 bytes)' -AsSecureString
$second=Read-Host 'Repita a senha' -AsSecureString
$a=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
try {
 $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($a)
 if($plain -cne [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)){throw 'Senhas diferentes'}
 $start=[Diagnostics.ProcessStartInfo]::new()
 $start.FileName=$Php
 $start.UseShellExecute=$false
 $start.RedirectStandardInput=$true
 $start.CreateNoWindow=$true
 if($PSVersionTable.PSVersion.Major -ge 7){
  foreach($arg in $arguments){$start.ArgumentList.Add($arg)}
 }else{
  $start.Arguments=($arguments | ForEach-Object {ConvertTo-WindowsArgument $_}) -join ' '
 }
 $process=[Diagnostics.Process]::Start($start)
 $payload=[Text.Encoding]::UTF8.GetBytes((@{password=$plain}|ConvertTo-Json -Compress))
 $process.StandardInput.BaseStream.Write($payload,0,$payload.Length)
 $process.StandardInput.BaseStream.Flush()
 $process.StandardInput.Close()
 $process.WaitForExit()
 if($process.ExitCode -ne 0){throw 'Operação KIDS não concluída'}
}finally{
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a)
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)
 $plain=$null
 if($null -ne $payload){[Array]::Clear($payload,0,$payload.Length)}
 $first.Dispose()
 $second.Dispose()
}
