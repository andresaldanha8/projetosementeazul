<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Método não permitido']);
    exit;
}

$senha = $_POST['senha'] ?? '';

if (empty($senha)) {
    http_response_code(400);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Senha não informada']);
    exit;
}

require_once __DIR__ . '/config.php';

if (password_verify($senha, $admin_password_hash)) {
    $_SESSION['admin_autenticado'] = true;
    $_SESSION['admin_login_time'] = time();
    $_SESSION['admin_expires'] = time() + (30 * 60); // 30 minutos

    echo json_encode(['sucesso' => true]);
} else {
    http_response_code(401);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Senha incorreta']);
}
