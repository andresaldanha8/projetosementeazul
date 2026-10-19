<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

/** KIDS-only connection. Missing/invalid configuration always fails closed. */
function kids_database(): PDO
{
    try {
        $file=dirname(__DIR__).'/config/database.local.php';
        if (!is_file($file)) throw new RuntimeException();
        $config=require $file;
        if (!is_array($config)) throw new RuntimeException();
        foreach (['host','database','username','password'] as $key) {
            if (!isset($config[$key]) || !is_string($config[$key]) || $config[$key]==='') throw new RuntimeException();
        }
        $port=$config['port']??3306;
        if (!is_int($port) || $port<1 || $port>65535
            || !preg_match('/^[a-zA-Z0-9.:-]+$/D',$config['host'])
            || !preg_match('/^[a-zA-Z0-9_]+$/D',$config['database'])) throw new RuntimeException();
        return new PDO('mysql:host='.$config['host'].';port='.$port.';dbname='.$config['database'].';charset=utf8mb4',
            $config['username'],$config['password'],[
                PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES=>false,
            ]);
    } catch (Throwable $e) {
        // Never expose DSN, credentials, driver diagnostics or a previous exception.
        if (PHP_SAPI==='cli') throw new RuntimeException('Conexão KIDS indisponível. Confira a configuração privada.');
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['sucesso'=>false,'ok'=>false,'mensagem'=>'Serviço KIDS indisponível. Tente novamente.']);
        exit;
    }
}

$pdo=kids_database();
