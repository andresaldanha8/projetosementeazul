<?php
require_once __DIR__ . '/auth_check.php';
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

try {
    $stmt = $pdo->query('SELECT id, nome, telefone, email, idade, nome_equipe, valor_pago, forma_pagamento, modalidade, comprovante_info, observacoes, status, data_inscricao, horario_inscricao, data_confirmacao FROM inscricoes ORDER BY id DESC');
    $inscricoes = $stmt->fetchAll();
    echo json_encode($inscricoes);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao listar inscrições.']);
}
