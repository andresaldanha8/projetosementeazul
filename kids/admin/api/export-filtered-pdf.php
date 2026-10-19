<?php
declare(strict_types=1);
require_once __DIR__.'/_bootstrap.php';
require_once dirname(__DIR__,2).'/api/registration-query.php';
kids_admin_method('POST');
try {
    kids_require_admin($pdo,true);
    $input=kids_admin_body();
    $keys=['band','payment','search'];
    if (array_diff($keys,array_keys($input)) || array_diff(array_keys($input),$keys)) kids_reply(400,['sucesso'=>false,'mensagem'=>'Filtros inválidos.']);
    try { $filters=kids_registration_filters($input); }
    catch(InvalidArgumentException $e){ kids_reply(400,['sucesso'=>false,'mensagem'=>'Filtros inválidos.']); }
    session_write_close();
    require_once dirname(__DIR__,2).'/pdf/report.php';
    $event=kids_config();
    $rows=kids_pdf_snapshot($pdo,$event['edition'],$filters);
    if (!$rows) kids_reply(404,['sucesso'=>false,'code'=>'NO_RESULTS','mensagem'=>'Nenhuma inscrição encontrada para os filtros selecionados']);
    kids_pdf_download($rows,$event,$filters);
} catch(Throwable $e){ kids_admin_error($e); }
