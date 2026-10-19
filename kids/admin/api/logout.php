<?php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
kids_admin_method('POST');
try {
    kids_require_admin($pdo, true, true);
    $destroy_session();
    kids_reply(200, ['sucesso' => true]);
} catch (Throwable $e) { kids_admin_error($e); }
