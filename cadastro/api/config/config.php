<?php
// config.php — inicializa PDO para o backend de /cadastro/
// Regras:
// - Carrega .env.php privado na mesma pasta
// - Valida variáveis obrigatórias
// - Cria PDO com charset utf8mb4 e opções seguras

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    http_response_code(403);
    exit('Acesso negado.');
}

$envFile = __DIR__ . '/.env.php';
if (!file_exists($envFile)) {
    error_log('cadastro/config.php: .env.php não encontrado em ' . $envFile);
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro de configuração.']);
    exit;
}

require_once $envFile;

// Validar presença das constantes esperadas.
$required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
foreach ($required as $const) {
    if (!defined($const)) {
        error_log('cadastro/config.php: variável ausente ' . $const);
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['sucesso' => false, 'mensagem' => 'Erro de configuração.']);
        exit;
    }
}

// Regras adicionais de validação:
// - DB_HOST, DB_NAME e DB_USER obrigatoriamente não podem ser vazios.
// - DB_PASSWORD deve estar definida; pode ser vazia SOMENTE quando
//   DB_HOST === 'localhost' && DB_USER === 'root' && DB_NAME === 'semente_azul_cadastro_dev'.
if (constant('DB_HOST') === '' || constant('DB_NAME') === '' || constant('DB_USER') === '') {
    error_log('cadastro/config.php: variável de configuração vazia (host/name/user)');
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro de configuração.']);
    exit;
}

if (constant('DB_PASSWORD') === '') {
    $allowEmptyLocal = (
        constant('DB_HOST') === 'localhost' &&
        constant('DB_USER') === 'root' &&
        constant('DB_NAME') === 'semente_azul_cadastro_dev'
    );
    if (!$allowEmptyLocal) {
        error_log('cadastro/config.php: DB_PASSWORD vazio não permitido neste ambiente');
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['sucesso' => false, 'mensagem' => 'Erro de configuração.']);
        exit;
    }
}

$dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
try {
    $pdo = new PDO($dsn, DB_USER, DB_PASSWORD, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    // Registrar detalhe técnico apenas no log do servidor
    error_log('cadastro/config.php: erro de conexão PDO: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro de conexão com o banco de dados.']);
    exit;
}

// $pdo está disponível para incluir em endpoints do /cadastro/api
