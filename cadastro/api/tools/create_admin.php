<?php
// create_admin.php
// Utilitário CLI para provisionamento inicial do primeiro ADMINISTRADOR.
// Execução apenas via PHP CLI. Nunca por HTTP.

if (PHP_SAPI !== 'cli') {
    // Bloqueio estrito: não permitir execução via navegador
    if (!headers_sent()) header($_SERVER['SERVER_PROTOCOL'] . ' 403 Forbidden');
    echo "Acesso negado. Este script funciona somente via CLI.";
    exit(1);
}

$prog = basename(__FILE__);
// Espera: php create_admin.php "Nome Completo" login
global $argc, $argv;
if ($argc < 3) {
    fwrite(STDERR, "Uso: php $prog \"Nome Completo\" login\n");
    exit(1);
}

$name = trim($argv[1]);
$login = trim($argv[2]);

// Validações básicas de entrada
if ($name === '') {
    fwrite(STDERR, "Nome obrigatório.\n");
    exit(1);
}
if (mb_strlen($name) > 200) {
    fwrite(STDERR, "Nome muito longo (máx 200 caracteres).\n");
    exit(1);
}

if ($login === '') {
    fwrite(STDERR, "Login obrigatório.\n");
    exit(1);
}
if (mb_strlen($login) > 100) {
    fwrite(STDERR, "Login muito longo (máx 100 caracteres).\n");
    exit(1);
}

// Normalizar login de forma previsível
$normalizedLogin = mb_strtolower($login);

// Helper local: executar stty via proc_open com command array
// Retorna array: ['success' => bool, 'stdout' => string, 'exit' => int]
function run_stty_proc(array $args, bool $captureOutput = false)
{
    $tty = '/dev/tty';
    $cmd = array_merge(['stty'], $args);

    // Descritores: stdin ligado ao /dev/tty, stdout pipe se solicitado, stderr pipe
    $descriptors = [
        0 => ['file', $tty, 'r'],
        1 => $captureOutput ? ['pipe', 'w'] : ['file', '/dev/null', 'w'],
        2 => ['file', '/dev/null', 'w'],
    ];

    $pipes = [];
    $proc = @proc_open($cmd, $descriptors, $pipes);
    if (!is_resource($proc)) {
        return ['success' => false, 'stdout' => '', 'exit' => -1];
    }

    $out = '';
    // Ler stdout se foi solicitado
    if ($captureOutput && isset($pipes[1]) && is_resource($pipes[1])) {
        $out = stream_get_contents($pipes[1]);
        @fclose($pipes[1]);
    }

    // stderr está direcionado para /dev/null — não há pipe para fechar

    $exit = @proc_close($proc);
    return ['success' => $exit === 0, 'stdout' => $out === null ? '' : $out, 'exit' => $exit];
}


// Coleta de senha interativa (sem argumento CLI)
// Regras estritas: aceitar a senha SOMENTE se for possível leitura sem eco.
function prompt_silent($prompt = '')
{
    if ($prompt) fwrite(STDOUT, $prompt);

    // A) validações iniciais
    if (stripos(PHP_OS, 'WIN') !== false) {
        return null;
    }
    if (!function_exists('proc_open')) {
        return null;
    }
    $ttyPath = '/dev/tty';
    if (!is_readable($ttyPath)) {
        return null;
    }

    $stty = null;
    $ttyFp = null;
    $echoDisabled = false;
    $restoreOk = false;
    $password = null;

    // B) obter estado original
    $res = run_stty_proc(['-g'], true);
    if (!$res['success']) {
        return null;
    }
    $stty = trim($res['stdout']);
    if ($stty === '') {
        return null;
    }

    // C) abrir /dev/tty para leitura
    $ttyFp = @fopen($ttyPath, 'r');
    if ($ttyFp === false) {
        return null;
    }

    // D) try/finally para garantir restauração
    try {
        // E.1) aplicar stty -echo
        $res = run_stty_proc(['-echo'], false);
        if (!$res['success']) {
            return null;
        }
        $echoDisabled = true;

        // E.2) ler UMA linha do handle /dev/tty
        $line = @fgets($ttyFp);
        if ($line === false) {
            return null;
        }
        $password = rtrim($line, "\r\n");
    } catch (Throwable $t) {
        // Qualquer erro: fail-closed
        $password = null;
    } finally {
        // F) fechar handle /dev/tty se aberto
        if ($ttyFp && is_resource($ttyFp)) {
            @fclose($ttyFp);
        }

        // Restaurar somente se desabilitamos o echo
        if ($echoDisabled) {
            // tentar restaurar exatamente o estado original
            $res = run_stty_proc([$stty], false);
            if ($res['success']) {
                $restoreOk = true;
            } else {
                // tentativa de recuperação mínima: reativar eco
                $recov = run_stty_proc(['echo'], false);
                error_log('create_admin.php: falha ao restaurar stty original durante prompt_silent()');
                $restoreOk = false;
            }
            // imprimir quebra de linha apenas se chegamos a desabilitar echo
            fwrite(STDOUT, "\n");
        }
    }

    // Se não conseguimos restaurar com sucesso, descartar e fail-closed
    if ($echoDisabled && !$restoreOk) {
        return null;
    }

    return $password;
}


// Coletar senha somente se o terminal suportar leitura sem eco
$pwd = null;
$tries = 0;
while ($tries < 5) {
    $pwd = prompt_silent('Senha (mínimo 10 caracteres, não será exibida): ');
    if ($pwd === null) {
        // Ambiente sem suporte à entrada sem eco: abortar conforme política
        fwrite(STDERR, "Erro: o terminal atual não suporta entrada de senha sem eco. Execute o script em um terminal que permita leitura oculta.\n");
        exit(1);
    }
    if (strlen($pwd) >= 10) break;
    fwrite(STDOUT, "Senha muito curta. Tente novamente.\n");
    $tries++;
}
if ($tries >= 5 && strlen($pwd) < 10) {
    fwrite(STDERR, "Falha: senha não atendida após várias tentativas.\n");
    exit(1);
}

// Gerar hash e eliminar a senha em texto claro
$password_hash = password_hash($pwd, PASSWORD_DEFAULT);
// Tentar eliminar conteúdo da variável de senha
$pwd = null;

if ($password_hash === false) {
    fwrite(STDERR, "Falha ao gerar hash da senha.\n");
    exit(1);
}

// Reutilizar o config.php do módulo para obter $pdo
require_once __DIR__ . '/../config/config.php';

try {
    // Verificar duplicidade de login
    $check = $pdo->prepare('SELECT id FROM cad_usuarios WHERE login = ? LIMIT 1');
    $check->execute([$normalizedLogin]);
    if ($check->fetch()) {
        fwrite(STDOUT, "Um usuário com este login já existe. Nenhuma alteração foi feita.\n");
        exit(1);
    }

    // Inserir novo administrador em transação
    $now = (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.u');
    $pdo->beginTransaction();
    $insert = $pdo->prepare('INSERT INTO cad_usuarios (nome, login, password_hash, perfil, ativo, auth_version, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $insert->execute([$name, $normalizedLogin, $password_hash, 'ADMINISTRADOR', 1, 1, 1, $now, $now]);
    $pdo->commit();
    // Limpar hash da variável (não é sensível como a senha, mas limpar por higiene)
    $password_hash = null;
    fwrite(STDOUT, "ADMIN criado com sucesso.\n");
    exit(0);
} catch (PDOException $e) {
    // Tratar condição de corrida ou violação de UNIQUE
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $sqlState = $e->getCode();
    if ($sqlState === '23000') {
        fwrite(STDOUT, "Falha: login já existente ou conflito de concorrência. Nenhuma alteração foi feita.\n");
        exit(1);
    }
    // Registrar detalhes técnicos no log do servidor sem expor segredos
    error_log('create_admin.php: PDOException ao criar admin: ' . $e->getMessage());
    fwrite(STDOUT, "Erro ao criar ADMIN. Verifique os logs do servidor.\n");
    exit(1);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('create_admin.php: Exception: ' . $e->getMessage());
    fwrite(STDOUT, "Erro inesperado. Verifique os logs do servidor.\n");
    exit(1);
}
