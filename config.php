<?php
// config.php - Protegido contra acesso direto via navegador
if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    http_response_code(403);
    exit('Acesso negado.');
}

// Carregar credenciais do arquivo isolado
require_once __DIR__ . '/.env.php';

// Conexão PDO (usada por todos os scripts)
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    exit('Erro de conexão com o banco de dados.');
}

// Hash da senha admin (importado do .env.php)
$admin_password_hash = ADMIN_PASSWORD_HASH;
