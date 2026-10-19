<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }
// Copy locally to database.local.php. Never commit, share or package the filled file.
return [
    'host' => 'PREENCHA_HOST_MYSQL',
    'port' => 3306,
    'database' => 'PREENCHA_BANCO_KIDS',
    'username' => 'PREENCHA_USUARIO_KIDS',
    'password' => '',
];
