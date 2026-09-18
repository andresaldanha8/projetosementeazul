<?php
// session.php — centraliza a configuração de sessão para /cadastro/
// - Usa nome de sessão próprio para evitar colisões com o legado
// - Define parâmetros de cookie apropriados
// - Controla timeouts de inatividade e absoluta

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    http_response_code(403);
    exit('Acesso negado.');
}

// Regras recomendadas
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');

// Detectar HTTPS de forma conservadora (não confiar em headers encaminhados)
$isHttps = false;
if (!empty($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === '1')) {
    $isHttps = true;
}
if (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) {
    $isHttps = true;
}

// Cookie params — path isolado em /cadastro/
$cookieParams = [
    'lifetime' => 0,
    'path' => '/cadastro/',
    'domain' => '',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax'
];

session_name('PSA_CADASTRO_SESSION');
session_set_cookie_params($cookieParams);
session_start();

// Timeouts (segundos)
if (!defined('PSA_SESSION_INACTIVITY_TIMEOUT')) define('PSA_SESSION_INACTIVITY_TIMEOUT', 1800); // 30 minutos
if (!defined('PSA_SESSION_ABSOLUTE_TIMEOUT')) define('PSA_SESSION_ABSOLUTE_TIMEOUT', 28800); // 8 horas
// Função para destruir sessão com limpeza de cookie (usa opções incluindo SameSite)
$destroy_session = function () use ($isHttps) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        $cookieOpts = [
            'expires' => time() - 42000,
            'path' => $params['path'] ?? '/cadastro/',
            'domain' => $params['domain'] ?? '',
            'secure' => $params['secure'] ?? $isHttps,
            'httponly' => true,
            'samesite' => 'Lax'
        ];
        setcookie(session_name(), '', $cookieOpts);
    }
    session_destroy();
    return;
};

// Apenas fiscalizar timeouts se houver indicação inequívoca de sessão autenticada
if (isset($_SESSION['psa_user_id'])) {
    // Sessão autenticada deve conter timestamps de controle
    if (!isset($_SESSION['psa_session_created_at']) || !isset($_SESSION['psa_session_last_activity']) || !is_int($_SESSION['psa_session_created_at']) || !is_int($_SESSION['psa_session_last_activity'])) {
        // Sessão inconsistente — destruir com segurança
        $destroy_session();
    } else {
        // Verificar inatividade
        if (time() - $_SESSION['psa_session_last_activity'] > PSA_SESSION_INACTIVITY_TIMEOUT) {
            $destroy_session();
        
        // Verificar timeout absoluto
        } elseif (time() - $_SESSION['psa_session_created_at'] > PSA_SESSION_ABSOLUTE_TIMEOUT) {
            $destroy_session();
        } else {
            // Sessão válida: atualizar last_activity
            $_SESSION['psa_session_last_activity'] = time();
        }
    }
}

// Nota: session_regenerate_id(true) deve ser chamado apenas no momento do login bem-sucedido.
