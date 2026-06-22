<?php
// excluir_inscricao.php
require_once __DIR__ . '/auth_check.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Método não permitido']);
    exit;
}
if (!isset($_POST['id'])) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'ID não informado']);
    exit;
}
$id = intval($_POST['id']);
require_once __DIR__ . '/config.php';
try {
    $stmt = $pdo->prepare('DELETE FROM inscricoes WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() > 0) {
        echo json_encode(['sucesso' => true]);
    } else {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Inscrição não encontrada']);
    }
} catch (Exception $e) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro ao excluir: ' . $e->getMessage()]);
}
