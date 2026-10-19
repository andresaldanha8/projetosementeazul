<?php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
kids_admin_method('POST');
try {
    $user = kids_require_admin($pdo, true, true);
    $body = kids_admin_body();
    $current = $body['currentPassword'] ?? null;
    $next = $body['newPassword'] ?? null;
    if (!is_string($current) || !is_string($next) || strlen($current) > 1024 || strlen($next) < 10 || strlen($next) > 72) kids_reply(400, ['sucesso' => false, 'mensagem' => 'Use uma nova senha entre 10 e 72 bytes.']);
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT * FROM kids_administradores WHERE id=? FOR UPDATE');
    $stmt->execute([$user['id']]);
    $locked = $stmt->fetch(PDO::FETCH_ASSOC);
    // Recheck authorization/version under lock before changing KIDS credentials.
    if (!$locked || (int)$locked['ativo'] !== 1 || $locked['perfil'] !== 'ADMINISTRADOR' || (int)$locked['auth_version'] !== (int)$user['auth_version']) {
        $pdo->rollBack(); $destroy_session(); kids_reply(401, ['sucesso' => false, 'code' => 'ACCESS_REVOKED']);
    }
    if (!password_verify($current, $locked['password_hash']) || password_verify($next, $locked['password_hash'])) {
        $pdo->rollBack(); kids_reply(400, ['sucesso' => false, 'mensagem' => 'Confira a senha atual e escolha uma nova senha diferente.']);
    }
    $stmt = $pdo->prepare('UPDATE kids_administradores SET password_hash=?, must_change_password=0, auth_version=auth_version+1, updated_at=UTC_TIMESTAMP(6) WHERE id=?');
    $stmt->execute([password_hash($next, PASSWORD_DEFAULT), $user['id']]);
    $locked['auth_version'] = (int)$locked['auth_version'] + 1;
    $locked['must_change_password'] = 0;
    $pdo->commit();
    try { kids_admin_start_identity($locked); } catch (Throwable $e) { $destroy_session(); throw $e; }
    kids_reply(200, kids_admin_session_payload($locked));
} catch (Throwable $e) { kids_admin_error($e); }
