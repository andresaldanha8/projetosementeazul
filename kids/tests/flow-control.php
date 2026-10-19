<?php
declare(strict_types=1);
// Copied outside the preview webroot. Only the disposable runner supplies $pdo.
if (PHP_SAPI !== 'cli' || !isset($pdo)) { http_response_code(403); exit(1); }
$action=$argv[1]??'snapshot';
if ($action==='rollback-on') $pdo->exec("CREATE TRIGGER flow_fail BEFORE UPDATE ON kids_idempotencia FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_ROLLBACK'");
elseif ($action==='rollback-off') $pdo->exec('DROP TRIGGER IF EXISTS flow_fail');
elseif ($action==='shrink') $pdo->exec("UPDATE kids_inscricoes SET pagamento='CONFIRMADO' WHERE crianca_nome LIKE 'Criança Fictícia %' AND faixa='4-7' AND pagamento='PENDENTE'");
elseif ($action!=='snapshot') throw new RuntimeException('Unknown isolated fixture action');
echo json_encode(['rows'=>$pdo->query('SELECT * FROM kids_inscricoes ORDER BY id')->fetchAll(),'audit'=>$pdo->query('SELECT * FROM kids_auditoria ORDER BY id')->fetchAll(),'events'=>$pdo->query('SELECT id,proximo_numero FROM kids_eventos ORDER BY id')->fetchAll(),'keys'=>$pdo->query('SELECT COUNT(*) FROM kids_idempotencia')->fetchColumn()],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
