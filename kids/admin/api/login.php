<?php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
kids_admin_method('POST');
try {
    $body = kids_admin_body();
    $login = $body['login'] ?? null;
    $password = $body['password'] ?? null;
    if (!is_string($login) || trim($login) === '' || mb_strlen($login) > 100 || !is_string($password) || $password === '' || strlen($password) > 1024) kids_reply(400, ['sucesso' => false, 'mensagem' => 'Usuário ou senha inválidos.']);
    // Persistent, bounded windows; rotating cookies cannot bypass these limits.
    // Only SHA-256 fingerprints are stored. No raw IP or login is retained.
    $window = (int)(floor(time() / 900) * 900);
    $limits = [hash('sha256', 'ip:' . ($_SERVER['REMOTE_ADDR'] ?? '')) => 20,
        hash('sha256', 'login:' . mb_strtolower(trim($login))) => 8];
    ksort($limits);
    $pdo->beginTransaction();
    $blocked = false;
    foreach ($limits as $key => $limit) {
        $stmt = $pdo->prepare('INSERT INTO kids_admin_login_limites (origem_hash, janela_inicio, tentativas) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE tentativas=IF(janela_inicio=VALUES(janela_inicio), LEAST(tentativas+1,1000000),1), janela_inicio=VALUES(janela_inicio)');
        $stmt->execute([$key, $window]);
        $stmt = $pdo->prepare('SELECT tentativas FROM kids_admin_login_limites WHERE origem_hash=?');
        $stmt->execute([$key]);
        $blocked = (int)$stmt->fetchColumn() > $limit || $blocked;
    }
    $pdo->commit();
    if ($blocked) { header('Retry-After: ' . ($window + 900 - time())); kids_reply(429, ['sucesso' => false, 'mensagem' => 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.']); }
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site' || !kids_admin_csrf_validate($_SESSION, $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) kids_reply(403, ['sucesso' => false, 'mensagem' => 'Atualize a página e tente novamente.']);
    $user = kids_admin_verify_credentials($pdo, $login, $password);
    if ($user === null || (int)$user['ativo'] !== 1 || $user['perfil'] !== 'ADMINISTRADOR') kids_reply(401, ['sucesso' => false, 'mensagem' => 'Usuário ou senha inválidos.']);
    kids_admin_start_identity($user);
    kids_reply(200, kids_admin_session_payload($user));
} catch (Throwable $e) { kids_admin_error($e); }
