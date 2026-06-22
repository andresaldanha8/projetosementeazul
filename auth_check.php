<?php
// auth_check.php - Incluir no início de endpoints que precisam de autenticação
session_start();

if (
    empty($_SESSION['admin_autenticado']) ||
    empty($_SESSION['admin_expires']) ||
    time() > $_SESSION['admin_expires']
) {
    // Limpar sessão expirada
    session_destroy();
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['sucesso' => false, 'mensagem' => 'Não autenticado. Faça login novamente.']);
    exit;
}

// Renovar expiração a cada requisição autenticada
$_SESSION['admin_expires'] = time() + (30 * 60);
