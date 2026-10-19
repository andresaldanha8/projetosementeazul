<?php
declare(strict_types=1);
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
$shell = __DIR__ . '/dist/index.html';
if (!is_file($shell)) { http_response_code(503); echo 'Administração KIDS indisponível. Execute o build local da administração KIDS.'; exit; }
// The dedicated shell uses the build in place; no second copied frontend is maintained.
echo file_get_contents($shell);
