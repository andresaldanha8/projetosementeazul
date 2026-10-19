<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }
require_once dirname(__DIR__).'/api/registration-query.php';

/** A consistent read-only snapshot with optional validated filters, never UI pagination. */
function kids_pdf_snapshot(PDO $pdo, string $edition, ?array $filters = null): array
{
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $pdo->exec('SET TRANSACTION READ ONLY');
    $pdo->beginTransaction();
    try {
        $stmt=$pdo->prepare('SELECT codigo FROM kids_eventos WHERE codigo=?');
        $stmt->execute([$edition]);
        if (!$stmt->fetchColumn()) throw new RuntimeException('Edition unavailable');
        $rows=kids_pdf_rows($pdo,$edition,$filters);
        $pdo->commit();
        return $rows;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function kids_pdf_rows(PDO $pdo, string $edition, ?array $filters = null): array
{
    [$from,$args]=kids_registration_from($edition,$filters);
    $stmt=$pdo->prepare("SELECT i.numero_peito,i.crianca_nome,i.idade_inscricao,i.faixa,i.divisao,i.responsavel_nome,i.telefone,i.camisa,i.pagamento,i.situacao
        ".$from."
        ORDER BY CASE i.faixa WHEN '4-7' THEN 1 WHEN '8-10' THEN 2 WHEN '11-14' THEN 3 ELSE 4 END,i.numero_peito ASC");
    $stmt->execute($args);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function kids_pdf_totals(array $rows): array
{
    $totals=['all'=>count($rows),'active'=>0,'pending'=>0,'paid'=>0,'cancelled'=>0];
    foreach ($rows as $row) {
        if ($row['situacao']==='CANCELADA') { $totals['cancelled']++; continue; }
        if ($row['situacao']!=='REGISTRADA') throw new RuntimeException('Unexpected registration state');
        $totals['active']++;
        if ($row['pagamento']==='PENDENTE') $totals['pending']++;
        elseif ($row['pagamento']==='CONFIRMADO') $totals['paid']++;
        else throw new RuntimeException('Unexpected payment state');
    }
    return $totals;
}

/** Display only: retain the stored value for unrecognized telephone formats. */
function kids_pdf_phone(string $value): string
{
    $digits=preg_replace('/\D/','',$value);
    $local=strlen($digits)===13&&str_starts_with($digits,'55')?substr($digits,2):$digits;
    if (strlen($local)===11) return '('.substr($local,0,2).') '.substr($local,2,5).'-'.substr($local,7);
    if (strlen($local)===10) return '('.substr($local,0,2).') '.substr($local,2,4).'-'.substr($local,6);
    return $value;
}

function kids_pdf_html(array $rows, array $event, DateTimeImmutable $issued, ?array $filters = null): string
{
    $escape=static fn($value)=>htmlspecialchars((string)$value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $groups=$filters===null?['4-7'=>[],'8-10'=>[],'11-14'=>[]]:[$filters['band']=>[]];
    foreach ($rows as $row) {
        if (!array_key_exists($row['faixa'],$groups)) throw new RuntimeException('Unexpected persisted age band');
        $groups[$row['faixa']][]=$row;
    }
    $totals=kids_pdf_totals($rows);
    $date=(new DateTimeImmutable($event['event_date']))->format('d/m/Y');
    $logo=str_replace('\\','/',__DIR__.'/assets/logo.jpg');
    $html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
      @page { size:A4 landscape; margin:25pt 26pt 33pt; }
      body { font-family:"DejaVu Sans",sans-serif; font-size:9pt; color:#172b3a; }
      h1 { font-size:17pt; line-height:1.25; margin:0 0 7pt; }
      .mast { width:100%; border-collapse:collapse; margin-bottom:10pt; }
      .mast td { border:0; padding:0; vertical-align:middle; }
      .mast .brand { width:69pt; }
      .logo { width:51pt; height:51pt; object-fit:contain; }
      .meta { font-size:8.5pt; color:#354958; line-height:1.5; }
      .summary { border:1pt solid #8b9ba6; background:#f1f4f6; padding:9pt 11pt; margin:0 0 10pt; line-height:1.6; }
      .summary strong { color:#172b3a; }
      .note { font-size:8pt; margin-top:3pt; color:#354958; }
      .roster { width:100%; table-layout:auto; border-collapse:collapse; font-size:9pt; line-height:1.28; }
      .roster thead { display:table-header-group; }
      .roster tr { page-break-inside:avoid; }
      .roster td,.roster th { border:0.5pt solid #9caab4; padding:4pt 5pt; vertical-align:top; word-wrap:break-word; }
      .roster th { text-align:left; background:#edf1f4; font-size:8pt; color:#142f45; }
      .roster .band { background:#173b5c; color:white; font-size:12pt; padding:7pt 8pt; }
      .roster .cancelled td { background:#f1f1f1; }
      .number { font-weight:bold; white-space:nowrap; }
      .center { text-align:center; }
      .section { page-break-before:always; }
      .first { page-break-before:auto; }
    </style></head><body>';
    $title=$filters===null?'Autismo Run KIDS — Lista completa de inscritos':'Autismo Run KIDS — Lista filtrada de inscritos';
    $html.='<table class="mast"><tr><td class="brand"><img class="logo" src="'.$escape($logo).'" alt="Projeto Semente Azul"></td><td><h1>'.$title.'</h1><div class="meta">'.$escape($event['name']).' · Evento: '.$escape($date).'<br>Edição: '.$escape($event['edition']).' · Emissão: '.$escape($issued->setTimezone(new DateTimeZone('America/Sao_Paulo'))->format('d/m/Y H:i:s')).' (Brasília)</div></td></tr></table>';
    if ($filters!==null) {
        $payment=$filters['payment']==='CONFIRMADO'?'PAGO':($filters['payment']===''?'Todos':$filters['payment']);
        $html.='<div class="summary"><strong>Filtros aplicados</strong><br>Faixa: '.$escape(str_replace('-','–',$filters['band'])).' anos · Pagamento: '.$escape($payment).'<br>Busca: '.$escape($filters['search']===''?'Sem busca':'“'.$filters['search'].'”').'</div>';
    }
    $html.='<div class="summary"><strong>Inscrições ativas (registradas): '.$totals['active'].'</strong> &nbsp; | &nbsp; Pendentes ativas: '.$totals['pending'].' &nbsp; | &nbsp; Pagas ativas: '.$totals['paid'].'<br><strong>Canceladas: '.$totals['cancelled'].'</strong> &nbsp; | &nbsp; Total incluindo canceladas: '.$totals['all'].'<div class="note">Canceladas não integram os totais de ativas, pendentes ativas ou pagas ativas. O pagamento original de cada cancelada é preservado na linha.</div></div>';
    $first=true;
    $widths=[6,22,5,9,18,12,5,11,12];
    $labels=['Nº peito','Criança','Idade*','Categoria','Responsável','Telefone','Camisa','Pagamento','Inscrição'];
    foreach ($groups as $band=>$members) {
        $html.='<div class="'.($first?'first':'section').'"><table class="roster"><thead><tr><th colspan="9" class="band">'.$escape(str_replace('-','–',$band)).' anos · '.count($members).' '.(count($members)===1?'inscrição':'inscrições').'</th></tr><tr>';
        foreach ($labels as $i=>$label) $html.='<th style="width:'.$widths[$i].'%">'.$escape($label).'</th>';
        $html.='</tr></thead><tbody>';
        foreach ($members as $row) {
            $html.='<tr'.($row['situacao']==='CANCELADA'?' class="cancelled"':'').'>';
            $values=[str_pad((string)$row['numero_peito'],3,'0',STR_PAD_LEFT),$row['crianca_nome'],(int)$row['idade_inscricao'],$row['divisao']==='M'?'Masculino':'Feminino',$row['responsavel_nome'],kids_pdf_phone((string)$row['telefone']),$row['camisa'],$row['pagamento']==='CONFIRMADO'?'PAGO':'PENDENTE',$row['situacao']==='CANCELADA'?'Cancelada':'Registrada'];
            foreach ($values as $i=>$value) $html.='<td style="width:'.$widths[$i].'%"'.($i===0?' class="number"':'').'>'.($i===8&&$row['situacao']==='CANCELADA'?'<strong>'.$escape($value).'</strong>':$escape($value)).'</td>';
            $html.='</tr>';
        }
        if (!$members) $html.='<tr><td colspan="9">Nenhuma inscrição nesta faixa.</td></tr>';
        $html.='</tbody></table></div>';
        $first=false;
    }
    return $html.'</body></html>';
}

function kids_pdf_render(array $rows, array $event, DateTimeImmutable $issued, ?array $filters = null): string
{
    require_once __DIR__.'/vendor/autoload.php';
    $private=sys_get_temp_dir().'/psa-kids-pdf-'.bin2hex(random_bytes(16));
    if (!mkdir($private,0700)) throw new RuntimeException('Private temporary directory unavailable');
    try {
        $options=new Dompdf\Options();
        $options->set('isRemoteEnabled',false);
        $options->set('isPhpEnabled',false);
        $options->set('isJavascriptEnabled',false);
        $options->set('allowedProtocols',['file://'=>['rules'=>[]]]);
        $options->set('chroot',[__DIR__.'/assets',__DIR__.'/vendor/dompdf/dompdf/lib/fonts']);
        $options->set('tempDir',$private);
        $options->set('fontCache',$private);
        $options->set('defaultFont','DejaVu Sans');
        $options->set('isFontSubsettingEnabled',true);
        $pdf=new Dompdf\Dompdf($options);
        $pdf->setPaper('A4','landscape');
        $pdf->loadHtml(kids_pdf_html($rows,$event,$issued,$filters),'UTF-8');
        $pdf->render();
        $canvas=$pdf->getCanvas();
        $font=$pdf->getFontMetrics()->getFont('DejaVu Sans','normal');
        $canvas->page_text(26,575,'Autismo Run KIDS · * Idade/faixa registradas na inscrição',$font,8,[0.2,0.25,0.3]);
        $canvas->page_text(705,575,'Página {PAGE_NUM} de {PAGE_COUNT}',$font,8,[0.2,0.25,0.3]);
        return $pdf->output();
    } finally {
        // Only flat files created in this request's own private directory; no user-controlled paths.
        foreach (glob($private.'/*')?:[] as $file) if (is_file($file)&&!is_link($file)) unlink($file);
        @rmdir($private);
    }
}

function kids_pdf_download(array $rows, array $event, ?array $filters = null): void
{
    $issued=new DateTimeImmutable('now',new DateTimeZone('America/Sao_Paulo'));
    $bytes=kids_pdf_render($rows,$event,$issued,$filters);
    if (!str_starts_with($bytes,'%PDF-')) throw new RuntimeException('Invalid PDF output');
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="autismo-run-kids-lista-'.($filters===null?'completa':'filtrada').'-'.$issued->format('Ymd-His').'.pdf"');
    header('Cache-Control: no-store, private, max-age=0');
    header('Pragma: no-cache'); header('Expires: 0');
    header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: no-referrer');
    header('Content-Length: '.strlen($bytes));
    echo $bytes;
}
