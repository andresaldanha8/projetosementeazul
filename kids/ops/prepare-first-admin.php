<?php
declare(strict_types=1);
// Offline alternative when SSH is unavailable. No database connection is made.
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
ini_set('display_errors','0');ini_set('log_errors','0');
try {
    [$script,$output,$login,$name]=array_pad($argv,4,'');
    $login=mb_strtolower(trim($login));$name=trim($name);
    if ($output==='' || !preg_match('/^[a-z0-9][a-z0-9._-]{2,99}$/D',$login) || $name==='' || mb_strlen($name)>200) throw new RuntimeException();
    $input=json_decode(stream_get_contents(STDIN,4096),true,8,JSON_THROW_ON_ERROR);
    $password=$input['password']??null;
    if (!is_string($password)||strlen($password)<12||strlen($password)>72) throw new RuntimeException();
    $hash=password_hash($password,PASSWORD_DEFAULT);unset($password,$input);
    $literal=static fn(string $s)=>'CONVERT(0x'.bin2hex($s).' USING utf8mb4)';
    $sql="-- PRIVATE: import only into the selected exclusive KIDS database after install-kids-empty.sql.\n";
    $sql.="-- Contains a password HASH, never the plaintext password. Do not upload to public_html or share.\n";
    $sql.="-- Refuses existing admins by inserting no rows; confirm affected rows = 1.\nSTART TRANSACTION;\n";
    $sql.="SELECT id FROM kids_eventos ORDER BY id LIMIT 1 FOR UPDATE;\n";
    $sql.="INSERT INTO kids_administradores (nome,login,password_hash,must_change_password)\nSELECT ".$literal($name).','.$literal($login).','.$literal($hash).",1\nWHERE NOT EXISTS (SELECT 1 FROM kids_administradores);\n";
    $sql.="SELECT ROW_COUNT() AS administradores_criados_deve_ser_1;\nCOMMIT;\n";
    $handle=fopen($output,'x'); // Never overwrite an existing private artifact.
    if ($handle===false) throw new RuntimeException();
    @chmod($output,0600);$written=fwrite($handle,$sql);fclose($handle);
    if ($written!==strlen($sql)) throw new RuntimeException();
    echo "SQL privado do primeiro administrador preparado localmente, somente com hash. Nenhuma conexão de banco foi realizada.\n";
}catch(Throwable $e){fwrite(STDERR,"Preparação recusada. Confira caminho, conta e requisitos da senha.\n");exit(1);}
