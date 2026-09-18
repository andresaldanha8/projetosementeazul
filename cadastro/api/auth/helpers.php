<?php
declare(strict_types=1);
// helpers.php — funções reutilizáveis de identidade/autorização para /cadastro/api
// Não inicia sessão, não cria PDO, não inclui .env.php diretamente.

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    http_response_code(403);
    exit('Acesso negado.');
}

/**
 * Buscar usuário por login (normalized login expected by caller)
 * Retorna associative array with keys:
 * id, nome, login, password_hash, perfil, ativo, auth_version, must_change_password
 * or null if not found.
 *
 * @param PDO $pdo
 * @param string $login
 * @return array|null
 */
function get_user_by_login(PDO $pdo, string $login): ?array
{
    $sql = 'SELECT id, nome, login, password_hash, perfil, ativo, auth_version, must_change_password FROM cad_usuarios WHERE login = ? LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$login]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) return null;
    // Normalize numeric fields to int
    if (isset($row['id'])) $row['id'] = (int)$row['id'];
    if (isset($row['ativo'])) $row['ativo'] = (int)$row['ativo'];
    if (isset($row['auth_version'])) $row['auth_version'] = (int)$row['auth_version'];
    if (isset($row['must_change_password'])) $row['must_change_password'] = (int)$row['must_change_password'];
    return $row;
}

/**
 * Buscar usuário por id
 * Retorna associative array with keys:
 * id, nome, login, perfil, ativo, auth_version, must_change_password
 * or null if not found.
 *
 * @param PDO $pdo
 * @param int $id
 * @return array|null
 */
function get_user_by_id(PDO $pdo, int $id): ?array
{
    $sql = 'SELECT id, nome, login, perfil, ativo, auth_version, must_change_password FROM cad_usuarios WHERE id = ? LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) return null;
    if (isset($row['id'])) $row['id'] = (int)$row['id'];
    if (isset($row['ativo'])) $row['ativo'] = (int)$row['ativo'];
    if (isset($row['auth_version'])) $row['auth_version'] = (int)$row['auth_version'];
    if (isset($row['must_change_password'])) $row['must_change_password'] = (int)$row['must_change_password'];
    return $row;
}

/**
 * Transform internal DB record to public user representation
 * Returns array with keys: id (int), nome (string), perfil (string)
 *
 * @param array $internal
 * @return array
 */
function public_user_from_record(array $internal): array
{
    return [
        'id' => isset($internal['id']) ? (int)$internal['id'] : 0,
        'nome' => (string)($internal['nome'] ?? ''),
        'perfil' => (string)($internal['perfil'] ?? ''),
    ];
}

/**
 * Validar sessão atual contra o banco.
 * Recebe PDO, referência para array de sessão (normalmente $_SESSION) e um callback destrutor.
 * Em caso de falha, chama $destroy_session() e retorna null.
 * Em caso de sucesso, sincroniza snapshots (nome/perfil) na sessão e retorna o registro interno do usuário (sem password_hash).
 *
 * @param PDO $pdo
 * @param array& $session
 * @param callable $destroy_session
 * @return array|null
 */
function validate_session_user(PDO $pdo, array & $session, callable $destroy_session): ?array
{
    // Verificar presença e tipos básicos
    if (!isset($session['psa_user_id']) || !isset($session['psa_auth_version'])) {
        $destroy_session();
        return null;
    }
    $userId = $session['psa_user_id'];
    $sessionAuthVersion = $session['psa_auth_version'];
    if (!is_int($userId) && !ctype_digit((string)$userId)) {
        $destroy_session();
        return null;
    }
    if (!is_int($sessionAuthVersion) && !ctype_digit((string)$sessionAuthVersion)) {
        $destroy_session();
        return null;
    }
    $userId = (int)$userId;
    $sessionAuthVersion = (int)$sessionAuthVersion;

    // Buscar usuário no banco
    $user = get_user_by_id($pdo, $userId);
    if ($user === null) {
        $destroy_session();
        return null;
    }

    // Validações
    if (!isset($user['ativo']) || (int)$user['ativo'] !== 1) {
        $destroy_session();
        return null;
    }

    // Perfis permitidos
    $allowedProfiles = ['ADMINISTRADOR', 'CADASTRADOR'];
    if (!isset($user['perfil']) || !in_array($user['perfil'], $allowedProfiles, true)) {
        $destroy_session();
        return null;
    }

    // auth_version must match
    if (!isset($user['auth_version']) || (int)$user['auth_version'] !== $sessionAuthVersion) {
        $destroy_session();
        return null;
    }

    // Synchronize snapshot fields in session (name/profile) without invalidating
    if (!isset($session['psa_user_name']) || $session['psa_user_name'] !== $user['nome']) {
        $session['psa_user_name'] = $user['nome'];
    }
    if (!isset($session['psa_user_profile']) || $session['psa_user_profile'] !== $user['perfil']) {
        $session['psa_user_profile'] = $user['perfil'];
    }

    return $user;
}

/**
 * Verifica se o usuário interno exige troca de senha obrigatória.
 * Recebe registro interno (resultado de get_user_by_id ou similar).
 * Retorna true se must_change_password === 1.
 *
 * @param array $userInternal
 * @return bool
 */
function user_must_change_password(array $userInternal): bool
{
    return isset($userInternal['must_change_password']) && ((int)$userInternal['must_change_password'] === 1);
}

/**
 * Atualizar password_hash de um usuário (recebe o novo hash pronto).
 * Retorna true em sucesso. Pode lançar PDOException em erro de conexão/execução.
 *
 * @param PDO $pdo
 * @param int $userId
 * @param string $newHash
 * @return bool
 */
function update_password_hash(PDO $pdo, int $userId, string $newHash): bool
{
    $sql = 'UPDATE cad_usuarios SET password_hash = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $ok = $stmt->execute([$newHash, $userId]);
    return $ok === true;
}

/**
 * CSRF helpers: store token in session under 'psa_csrf_token'.
 * Tokens are created only for authenticated sessions (caller must ensure session is active and authenticated).
 */

/**
 * Recuperar token CSRF atual da sessão, se existir.
 * @param array $session
 * @return string|null
 */
function csrf_get_token(array $session): ?string
{
    if (!isset($session['psa_csrf_token'])) return null;
    $token = $session['psa_csrf_token'];
    if (!is_string($token)) return null;
    // must be exactly 64 hex chars
    if (strlen($token) !== 64) return null;
    if (!ctype_xdigit($token)) return null;
    return $token;
}

/**
 * Gerar e armazenar um novo token CSRF na sessão.
 * Retorna o token gerado.
 * @param array& $session
 * @return string
 */
function csrf_generate_token(array & $session): string
{
    // Minimally require session markers to avoid accidental generation for anonymous sessions
    if (!isset($session['psa_user_id']) || !isset($session['psa_auth_version'])) {
        throw new LogicException('Sessão inválida para geração de token CSRF.');
    }
    $userId = $session['psa_user_id'];
    $authVer = $session['psa_auth_version'];
    if (!is_int($userId) && !ctype_digit((string)$userId)) {
        throw new LogicException('Sessão inválida para geração de token CSRF.');
    }
    if (!is_int($authVer) && !ctype_digit((string)$authVer)) {
        throw new LogicException('Sessão inválida para geração de token CSRF.');
    }
    if ((int)$userId <= 0 || (int)$authVer <= 0) {
        throw new LogicException('Sessão inválida para geração de token CSRF.');
    }

    $token = bin2hex(random_bytes(32));
    $session['psa_csrf_token'] = $token;
    return $token;
}

/**
 * Validar token CSRF fornecido com o armazenado na sessão usando hash_equals.
 * @param array $session
 * @param string $token
 * @return bool
 */
function csrf_validate_token(array $session, string $token): bool
{
    // Reject empty or malformed incoming token first
    if (!is_string($token) || $token === '') return false;
    if (strlen($token) !== 64) return false;
    if (!ctype_xdigit($token)) return false;

    $stored = csrf_get_token($session);
    if ($stored === null) return false;
    return hash_equals($stored, $token);
}

/**
 * Rotacionar token CSRF: gerar novo e substituir o existente.
 * @param array& $session
 * @return string
 */
function csrf_rotate_token(array & $session): string
{
    return csrf_generate_token($session);
}
