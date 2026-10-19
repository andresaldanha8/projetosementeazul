<?php
declare(strict_types=1);
// CLI only. Keep this file and its launchers OUTSIDE public_html.
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
ini_set('display_errors','0');
ini_set('log_errors','0');
try {
    [$script,$rootArg,$expected,$mode,$login,$name]=array_pad($argv,6,'');
    $root=realpath($rootArg);
    $login=mb_strtolower(trim($login));
    $name=trim($name);
    if (!$root || $expected==='' || !in_array($mode,['create-first','reset-password'],true)
        || !preg_match('/^[a-z0-9][a-z0-9._-]{2,99}$/D',$login)
        || ($mode==='create-first'&&($name===''||mb_strlen($name)>200))) throw new RuntimeException();
    require $root.'/kids/api/database.php';
    if ((string)$pdo->query('SELECT DATABASE()')->fetchColumn()!==$expected) throw new RuntimeException();
    $input=json_decode(stream_get_contents(STDIN,4096),true,8,JSON_THROW_ON_ERROR);
    $password=$input['password']??null;
    if (!is_string($password) || strlen($password)<12 || strlen($password)>72) throw new RuntimeException();
    $hash=password_hash($password,PASSWORD_DEFAULT);
    unset($password,$input);
    $pdo->beginTransaction();
    // Shared KIDS event lock serializes concurrent first-admin attempts.
    $lock=$pdo->query('SELECT id FROM kids_eventos ORDER BY id LIMIT 1 FOR UPDATE')->fetchColumn();
    if (!$lock) throw new RuntimeException();
    if ($mode==='create-first') {
        if ((int)$pdo->query('SELECT COUNT(*) FROM kids_administradores')->fetchColumn()!==0) throw new RuntimeException();
        $q=$pdo->prepare('INSERT INTO kids_administradores(nome,login,password_hash,must_change_password) VALUES(?,?,?,1)');
        $q->execute([$name,$login,$hash]);
    } else {
        $q=$pdo->prepare('UPDATE kids_administradores SET password_hash=?,must_change_password=1,auth_version=auth_version+1,updated_at=UTC_TIMESTAMP(6) WHERE login=? AND ativo=1');
        $q->execute([$hash,$login]);
        if ($q->rowCount()!==1) throw new RuntimeException();
    }
    $pdo->commit();
    echo "Operação KIDS concluída. Senha armazenada somente como hash; troca obrigatória no primeiro acesso.\n";
} catch (Throwable $e) {
    if (isset($pdo)&&$pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR,"Operação KIDS recusada. Confira destino, modo, conta e requisitos. Nenhum detalhe sensível foi registrado.\n");
    exit(1);
}
