<?php
// editar_status_inscricao.php
require_once __DIR__ . '/auth_check.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Método não permitido']);
    exit;
}
if (!isset($_POST['id']) || !isset($_POST['status'])) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Dados incompletos']);
    exit;
}
$id = intval($_POST['id']);
$status = $_POST['status'] === 'PAGO' ? 'PAGO' : 'PENDENTE';
require_once __DIR__ . '/config.php';
try {
    $stmt = $pdo->prepare('UPDATE inscricoes SET status = ? WHERE id = ?');
    $stmt->execute([$status, $id]);
    if ($stmt->rowCount() > 0) {
        echo json_encode(['sucesso' => true]);
    } else {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Inscrição não encontrada ou status já está igual']);
    }
} catch (Exception $e) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro ao atualizar: ' . $e->getMessage()]);
}
