<?php
declare(strict_types=1);
require_once __DIR__.'/_bootstrap.php';
kids_admin_method('POST');
try {
    kids_require_admin($pdo,true);
    // No filter/search/page request parameters are consumed by this complete-edition export.
    session_write_close();
    require_once dirname(__DIR__,2).'/pdf/report.php';
    $event=kids_config();
    $rows=kids_pdf_snapshot($pdo,$event['edition']);
    kids_pdf_download($rows,$event);
} catch (Throwable $e) {
    kids_admin_error($e);
}
