
<?php
// Inclui as credenciais protegidas
require_once __DIR__ . '/config.php';

// Receber dados do formulário
$nome = $_POST['nome'] ?? '';
$telefone = $_POST['telefone'] ?? '';
$email = $_POST['email'] ?? '';
$idade = $_POST['idade'] ?? '';
$nomeEquipe = $_POST['nomeEquipe'] ?? ($_POST['nomeDupla'] ?? '');
$valorPago = $_POST['valor'] ?? ($_POST['valor-pago'] ?? '');
$formaPagamento = $_POST['forma_pagamento'] ?? ($_POST['forma-pagamento'] ?? '');
$modalidade = $_POST['modalidade'] ?? '';
$comprovanteInfo = $_POST['comprovante_info'] ?? ($_POST['comprovante-info'] ?? '');
$observacoes = $_POST['observacoes'] ?? '';
$status = $_POST['status'] ?? ($_POST['status-pagamento'] ?? 'Pendente');
$dataInscricao = $_POST['data-inscricao'] ?? date('d/m/Y');
$horarioInscricao = $_POST['horario-inscricao'] ?? date('H:i:s');
$dataConfirmacao = $_POST['data-confirmacao'] ?? date('d/m/Y, H:i:s');

// Prepara e executa o INSERT via PDO
try {
    $stmt = $pdo->prepare('INSERT INTO inscricoes (nome, telefone, email, idade, nome_equipe, valor_pago, forma_pagamento, modalidade, comprovante_info, observacoes, status, data_inscricao, horario_inscricao, data_confirmacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$nome, $telefone, $email, $idade, $nomeEquipe, $valorPago, $formaPagamento, $modalidade, $comprovanteInfo, $observacoes, $status, $dataInscricao, $horarioInscricao, $dataConfirmacao]);

    // Redireciona para página de agradecimento conforme modalidade (aceita todos os formatos)
    $modalidadeLower = strtolower(trim($modalidade));
    if (
        $modalidadeLower === 'futebol de areia' ||
        $modalidadeLower === 'inscricoes-futebolareia'
    ) {
        header('Location: obrigado-futebolareia.html');
        exit;
    } elseif (
        $modalidadeLower === 'beach tennis' ||
        $modalidadeLower === 'inscricoes-beachtenis'
    ) {
        header('Location: obrigado-beachtenis.html');
        exit;
    } elseif (
        $modalidadeLower === 'pênalti' ||
        $modalidadeLower === 'penalti' ||
        $modalidadeLower === 'inscricoes-penalti'
    ) {
        header('Location: obrigado-penalti.html');
        exit;
    } else {
        exit;
    }
} catch (Exception $e) {
    echo 'Erro ao registrar inscrição.';
}
?>
