<?php
declare(strict_types=1);
require_once __DIR__.'/pix.php';

function kids_confirmation(array $row): array
{
    return [
        'reference' => $row['referencia'],
        'number' => str_pad((string)$row['numero_peito'], 3, '0', STR_PAD_LEFT),
        'child_name' => $row['crianca_nome'], 'age' => (int)$row['idade_inscricao'],
        'category' => $row['faixa'], 'division' => $row['divisao'],
        'shirt_size' => $row['camisa'], 'amount_cents' => (int)$row['valor_centavos'],
        'pix_payload' => $row['pagamento'] === 'PENDENTE' && $row['situacao'] !== 'CANCELADA'
            ? kids_pix_payload((int)$row['valor_centavos'], kids_config()) : null,
        'payment_status' => $row['pagamento'], 'registration_status' => $row['situacao'],
        'created_at_utc' => $row['criada_em'],
    ];
}
