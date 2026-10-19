<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
// Reuse the read-only datadir identity guard before connecting to the isolated server.
ob_start();require __DIR__.'/manual-db.php';$identity=json_decode(ob_get_clean(),true,512,JSON_THROW_ON_ERROR);
require_once dirname(__DIR__).'/pdf/report.php';require_once dirname(__DIR__).'/api/config.php';
$schema='kids_pdf_test_'.bin2hex(random_bytes(6));
$pdo->exec('CREATE DATABASE `'.$schema.'` CHARACTER SET utf8mb4');
$dsn='mysql:host=127.0.0.1;port='.$identity['port'].';dbname='.$schema.';charset=utf8mb4';
class PdfProbePDO extends PDO { public ?Closure $onSnapshot=null; }
class PdfProbeStatement extends PDOStatement {
    protected function __construct(private PdfProbePDO $connection) {}
    public function execute(?array $params=null): bool {
        $result=parent::execute($params);
        if(str_starts_with($this->queryString,'SELECT codigo')&&$this->connection->onSnapshot){$hook=$this->connection->onSnapshot;$this->connection->onSnapshot=null;$hook();}
        return $result;
    }
}
$options=[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC];
$reader=new PdfProbePDO($dsn,'root','',$options);$reader->setAttribute(PDO::ATTR_STATEMENT_CLASS,[PdfProbeStatement::class,[$reader]]);
$writer=new PDO($dsn,'root','',$options);
$checks=[];
function verify(bool $condition,string $label):void {global $checks;if(!$condition)throw new RuntimeException($label);$checks[]=$label;echo "PASS $label\n";}
try {
    $writer->exec('CREATE TABLE kids_eventos(id INT PRIMARY KEY,codigo VARCHAR(100)) ENGINE=InnoDB');
    $writer->exec('CREATE TABLE kids_inscricoes(evento_id INT,numero_peito INT,crianca_nome VARCHAR(250),idade_inscricao INT,faixa VARCHAR(10),divisao CHAR(1),responsavel_nome VARCHAR(250),telefone VARCHAR(30),camisa CHAR(1),pagamento VARCHAR(20),situacao VARCHAR(20)) ENGINE=InnoDB');
    $writer->exec('CREATE TABLE kids_auditoria(inscricao_numero INT,estado_anterior VARCHAR(20),estado_novo VARCHAR(20)) ENGINE=InnoDB');
    $edition=kids_config()['edition'];$q=$writer->prepare('INSERT INTO kids_eventos VALUES(1,?),(2,?)');$q->execute([$edition,'OTHER-PDF-TEST']);
    $q=$writer->prepare('INSERT INTO kids_inscricoes VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    $fixtures=[
        [1,1000,mb_substr(str_repeat('Álvaro São João Conceição ',9),0,200),7,'4-7','M',mb_substr(str_repeat('Mãe Responsável Açucena ',9),0,200),'119999999999999','P','PENDENTE','REGISTRADA'],
        [1,1,'João <img src="https://invalid.example/logo"> & Açúcar',7,'4-7','M','Responsável Fictício','11900000001','P','PENDENTE','REGISTRADA'],
        [1,12,'Cancelada Paga Fictícia',6,'4-7','F','Responsável Fictício','11900000002','P','CONFIRMADO','CANCELADA'],
        [1,2,'Cancelada Pendente Fictícia',8,'8-10','F','Responsável Fictício','11900000003','P','PENDENTE','CANCELADA'],
        [1,3,'Criança Paga Fictícia',14,'11-14','F','Responsável Fictício','11900000004','P','CONFIRMADO','REGISTRADA'],
        [2,99,'OUTRA EDICAO NAO EXPORTAR',9,'8-10','M','Outro','11900000005','P','PENDENTE','REGISTRADA'],
    ];foreach($fixtures as $fixture)$q->execute($fixture);
    $reader->onSnapshot=function()use($writer){$writer->beginTransaction();$writer->exec("UPDATE kids_inscricoes SET pagamento='CONFIRMADO' WHERE evento_id=1 AND numero_peito=1");$writer->exec("INSERT INTO kids_auditoria VALUES(1,'PENDENTE','CONFIRMADO')");$writer->commit();};
    $old=kids_pdf_snapshot($reader,$edition);$oldTotals=kids_pdf_totals($old);
    verify(count($old)===5&&array_column($old,'numero_peito')===[1,12,1000,2,3],'complete edition only; numeric ordering within persisted bands');
    verify($old[0]['pagamento']==='PENDENTE'&&$writer->query('SELECT pagamento FROM kids_inscricoes WHERE numero_peito=1')->fetchColumn()==='CONFIRMADO','concurrent payment commits between event and row SELECTs; export keeps original snapshot');
    verify($oldTotals===['all'=>5,'active'=>3,'pending'=>2,'paid'=>1,'cancelled'=>2],'old totals and rows consistent; both cancellation payment states excluded from active totals');
    $new=kids_pdf_snapshot($reader,$edition);$newTotals=kids_pdf_totals($new);verify($new[0]['pagamento']==='CONFIRMADO'&&$newTotals['pending']===1&&$newTotals['paid']===2,'next export sees committed payment consistently');
    $filtered=kids_pdf_snapshot($reader,$edition,kids_registration_filters(['band'=>'4-7','payment'=>'PENDENTE','search'=>'Álvaro']));
    verify(count($filtered)===1&&(int)$filtered[0]['numero_peito']===1000&&kids_pdf_totals($filtered)['pending']===1,'filtered snapshot shares predicates and totals only matching rows');
    $cancelled=kids_pdf_snapshot($reader,$edition,kids_registration_filters(['band'=>'4-7','payment'=>'CONFIRMADO','search'=>'Cancelada']));
    verify(count($cancelled)===1&&kids_pdf_totals($cancelled)===['all'=>1,'active'=>0,'pending'=>0,'paid'=>0,'cancelled'=>1],'filtered cancelled paid row keeps payment and is excluded from active totals');
    $html=kids_pdf_html($old,kids_config(),new DateTimeImmutable('2035-01-01T12:00:00Z'));
    verify(!str_contains($html,'<img src="https://invalid')&&str_contains($html,'&lt;img src='),'persisted markup escaped, no arbitrary remote resource markup');
    if(!is_dir(__DIR__.'/pdf-pages'))mkdir(__DIR__.'/pdf-pages',0700);
    $target=__DIR__.'/pdf-pages/layout-cases.pdf';
    file_put_contents($target,kids_pdf_render($old,kids_config(),new DateTimeImmutable('2035-01-01T12:00:00Z')));
    $failed=false;try{kids_pdf_render([array_replace($old[0],['faixa'=>'invalid'])],kids_config(),new DateTimeImmutable());}catch(RuntimeException $e){$failed=true;}
    verify($failed&&kids_pdf_snapshot($reader,$edition)===$new,'generation failure does not mutate persisted rows');
    file_put_contents(__DIR__.'/pdf-report-results.json',json_encode(['checks'=>$checks,'oldTotals'=>$oldTotals,'newTotals'=>$newTotals,'layoutPdf'=>$target,'scope'=>'new auxiliary schema on verified isolated server; manual schema untouched'],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
} finally {
    // Only this newly-created random test schema is removed. No existing schema is touched.
    if($reader->inTransaction())$reader->rollBack();
    $pdo->exec('DROP DATABASE `'.$schema.'`');
}
