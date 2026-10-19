<?php
declare(strict_types=1);

function kids_receipt_html(array $row, array $event, DateTimeImmutable $issued): string
{
    $escape = static fn($value): string => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $zone = new DateTimeZone($event['timezone']);
    $date = new DateTimeImmutable($row['criada_em'], new DateTimeZone('UTC'));
    $stamp = static fn(DateTimeImmutable $value): string => $value->setTimezone($zone)->format('d/m/Y H:i:s').' Vitória do Xingu - Pa';
    $cancelled = $row['situacao'] === 'CANCELADA';
    $html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
      @page { margin: 42px; } body { font-family: "DejaVu Sans", sans-serif; color: #193b50; font-size: 12px; line-height: 1.6; }
      h1 { font-size: 23px; margin: 0 0 12px; } h2 { font-size: 18px; } .label { color: #526775; font-size: 11px; }
      .bib { font-size: 38px; font-weight: bold; margin: 0; } .name { font-size: 22px; word-wrap: break-word; }
      .panel { border: 1px solid #b8cbd5; padding: 20px; margin: 20px 0; } .cancelled { color: #991b1b; border: 3px solid #991b1b; padding: 12px; font-size: 19px; font-weight: bold; }
      .notice { background: #fff3d5; padding: 14px; color: #573d00; } .footer { font-size: 10px; margin-top: 30px; }
      </style></head><body><h1>Comprovante individual de inscrição</h1><h2>'.$escape($event['name']).' - KIDS</h2>';
    if ($cancelled) $html .= '<p class="cancelled">INSCRIÇÃO CANCELADA</p>';
    $html .= '<div class="panel"><div class="label">Nome da criança</div><div class="name">'.$escape($row['crianca_nome']).'</div><p class="label">Número de peito</p><p class="bib">'.$escape(str_pad((string)$row['numero_peito'],3,'0',STR_PAD_LEFT)).'</p>';
    foreach (['Faixa etária'=>$row['faixa'].' anos', 'Data da inscrição'=>$stamp($date), 'Situação da inscrição'=>$cancelled ? 'CANCELADA' : $row['situacao'], 'Pagamento na emissão'=>$row['pagamento'] === 'CONFIRMADO' ? 'CONFIRMADO (pago)' : $row['pagamento']] as $label=>$value) {
        $html .= '<p><strong>'.$escape($label).':</strong> '.$escape($value).'</p>';
    }
    $html .= '</div>';
    if ($row['pagamento'] === 'PENDENTE') $html .= '<p class="notice">Este comprovante confirma a inscrição e não comprova o pagamento.</p>';
    return $html.'<p class="footer">Emitido em '.$escape($stamp($issued)).'.<br>Situação e pagamento consultados nesta emissão.</p></body></html>';
}

function kids_receipt_render(array $row, array $event, DateTimeImmutable $issued): string
{
    require_once __DIR__.'/vendor/autoload.php';
    $private = sys_get_temp_dir().'/psa-kids-receipt-'.bin2hex(random_bytes(16));
    if (!mkdir($private,0700)) throw new RuntimeException('Private temporary directory unavailable');
    try {
        $options = new Dompdf\Options();
        $options->set('isRemoteEnabled',false);
        $options->set('isPhpEnabled',false);
        $options->set('isJavascriptEnabled',false);
        $options->set('allowedProtocols',['file://'=>['rules'=>[]]]);
        $options->set('chroot',[__DIR__.'/assets',__DIR__.'/vendor/dompdf/dompdf/lib/fonts']);
        $options->set('tempDir',$private);
        $options->set('fontCache',$private);
        $options->set('defaultFont','DejaVu Sans');
        $options->set('isFontSubsettingEnabled',true);
        $pdf = new Dompdf\Dompdf($options);
        $pdf->setPaper('A4','portrait');
        $pdf->loadHtml(kids_receipt_html($row,$event,$issued),'UTF-8');
        $pdf->render();
        $bytes = $pdf->output();
        if (!str_starts_with($bytes,'%PDF-')) throw new RuntimeException('Invalid PDF');
        return $bytes;
    } finally {
        foreach (glob($private.'/*') ?: [] as $file) if (is_file($file) && !is_link($file)) unlink($file);
        @rmdir($private);
    }
}
