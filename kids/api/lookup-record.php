<?php
declare(strict_types=1);
require_once __DIR__.'/pix.php';

// Deliberate public allowlist: never expose ownership, reference or contact data.
function kids_lookup_record(array $row, array $config): array
{
    $result = [
        'number' => str_pad((string)$row['numero_peito'], 3, '0', STR_PAD_LEFT),
        'child_name' => $row['crianca_nome'],
        'registration_status' => $row['situacao'], 'payment_status' => $row['pagamento'],
    ];
    if ($row['situacao'] === 'REGISTRADA' && $row['pagamento'] === 'PENDENTE') {
        $amount = (int)$row['valor_centavos'];
        $money = 'R$ '.number_format($amount / 100, 2, ',', '.');
        $text = 'Olá! Fiz a inscrição de '.$row['crianca_nome'].' na corrida KIDS do Projeto Semente Azul. Número da inscrição: '.$result['number'].'. Vou enviar o comprovante do pagamento de '.$money.' para conferência.';
        $result['payment'] = [
            'amount_cents' => $amount, 'pix' => $config['pix'], 'payee' => $config['payee'],
            'pix_payload' => kids_pix_payload($amount, $config),
            'whatsapp_url' => 'https://wa.me/'.$config['whatsapp'].'?text='.rawurlencode($text),
        ];
    }
    return $result;
}
