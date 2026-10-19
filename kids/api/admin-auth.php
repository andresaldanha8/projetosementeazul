<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

function kids_admin_find(PDO $pdo, string $column, $value): ?array
{
    if (!in_array($column,['id','login'],true)) throw new InvalidArgumentException();
    $stmt=$pdo->prepare('SELECT id,nome,login,password_hash,perfil,ativo,auth_version,must_change_password FROM kids_administradores WHERE '.$column.'=? LIMIT 1');
    $stmt->execute([$value]);
    $user=$stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) return null;
    foreach (['id','ativo','auth_version','must_change_password'] as $key) $user[$key]=(int)$user[$key];
    return $user;
}

function kids_admin_verify_credentials(PDO $pdo, string $login, string $password): ?array
{
    $user=kids_admin_find($pdo,'login',mb_strtolower(trim($login)));
    $dummy='$2y$10$TxigpevQUR49e8owlMkiW.yB.Yl6eZipJ/SsfHbiKYnlAyOc1pGtq';
    $hasHash=is_string($user['password_hash']??null)&&$user['password_hash']!=='';
    $verified=password_verify($password,$hasHash?$user['password_hash']:$dummy);
    return $user!==null&&$hasHash&&$verified?$user:null;
}

function kids_admin_validate_session(PDO $pdo, array &$session, callable $destroy): ?array
{
    $id=$session['kids_user_id']??null;
    $version=$session['kids_auth_version']??null;
    if (($session['kids_admin_scope']??'')!=='KIDS_ADMIN_V2' || !is_int($id) || $id<=0 || !is_int($version) || $version<=0) {
        $destroy(); return null;
    }
    $user=kids_admin_find($pdo,'id',$id);
    if (!$user || $user['ativo']!==1 || $user['perfil']!=='ADMINISTRADOR' || $user['auth_version']!==$version) {
        $destroy(); return null;
    }
    unset($user['password_hash']);
    return $user;
}

function kids_admin_public_user(array $user): array
{
    return ['id'=>(int)$user['id'],'nome'=>(string)$user['nome'],'perfil'=>(string)$user['perfil']];
}

function kids_admin_must_change_password(array $user): bool
{
    return (int)($user['must_change_password']??0)===1;
}

function kids_admin_csrf_get(array $session): ?string
{
    $token=$session['kids_csrf_token']??null;
    return is_string($token)&&preg_match('/^[a-f0-9]{64}$/D',$token)?$token:null;
}

function kids_admin_csrf_generate(array &$session): string
{
    if (!isset($session['kids_user_id'],$session['kids_auth_version'])) throw new LogicException('Sessão KIDS inválida.');
    return $session['kids_csrf_token']=bin2hex(random_bytes(32));
}

function kids_admin_csrf_validate(array $session, string $token): bool
{
    $stored=kids_admin_csrf_get($session);
    return $stored!==null&&preg_match('/^[a-f0-9]{64}$/D',$token)&&hash_equals($stored,$token);
}
