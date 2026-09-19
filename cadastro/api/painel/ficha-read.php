<?php
declare(strict_types=1);

/**
 * Leitura interna do detalhe. O chamador deve validar autenticação e permissões.
 * Não executa consultas ao ser incluído ou solicitado diretamente.
 */
function fetch_ficha_detalhe(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare('SELECT
        id, crianca_nome, crianca_nome_social, crianca_nascimento, crianca_sexo,
        crianca_rg, crianca_cpf, bairro, crianca_telefone, escola_instituicao,
        ano_escolar, serie_escolar, responsavel_nome, responsavel_parentesco,
        responsavel_nascimento, responsavel_telefone, responsavel_whatsapp,
        responsavel_email, possui_diagnostico, necessidades_especificas,
        outro_interesse_descricao, situacao, origem, data_ingresso,
        observacoes_administrativas, created_by_name_snapshot, created_at,
        updated_at, updated_by_name_snapshot
        FROM cad_fichas WHERE id = :id');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        return null;
    }

    // Preservar interesses associados mesmo que atualmente estejam inativos.
    $stmt = $pdo->prepare('SELECT i.codigo, i.nome
        FROM cad_ficha_interesses fi
        INNER JOIN cad_interesses i ON i.id = fi.interesse_id
        WHERE fi.cadastro_id = :id
        ORDER BY i.ordem ASC, i.id ASC');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $interesses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // UNIQUE(cadastro_id) garante no máximo uma autorização por ficha.
    $stmt = $pdo->prepare('SELECT a.responsavel_nome_snapshot, a.concordou,
        a.concordou_at, a.declaracao_id, d.versao AS declaracao_versao,
        a.registrado_por, a.registrado_por_nome_snapshot
        FROM cad_autorizacoes a
        INNER JOIN cad_declaracoes d ON d.id = a.declaracao_id
        WHERE a.cadastro_id = :id');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $authorizationRow = $stmt->fetch(PDO::FETCH_ASSOC);
    $autorizacao = null;
    if ($authorizationRow !== false) {
        $autorizacao = [
            'responsavelNomeSnapshot' => $authorizationRow['responsavel_nome_snapshot'],
            'concordou' => (bool)$authorizationRow['concordou'],
            'concordouAt' => $authorizationRow['concordou_at'],
            'declaracaoId' => (int)$authorizationRow['declaracao_id'],
            'declaracaoVersao' => $authorizationRow['declaracao_versao'],
            'registradoPorId' => (int)$authorizationRow['registrado_por'],
            'registradoPorNome' => $authorizationRow['registrado_por_nome_snapshot'],
        ];
    }

    $stmt = $pdo->prepare('SELECT id, operacao, ocorrido_at, usuario_nome_snapshot,
        campos_alterados, situacao_anterior, situacao_nova
        FROM cad_auditoria WHERE cadastro_id = :id
        ORDER BY ocorrido_at ASC, id ASC');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $historico = [];
    while (($event = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
        $camposAlterados = [];
        $rawCampos = $event['campos_alterados'];
        if ($rawCampos !== null && trim($rawCampos) !== '') {
            // Decodificar sem converter objetos em arrays: o contrato exige lista.
            $decoded = json_decode($rawCampos);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)
                && count(array_filter($decoded, 'is_string')) === count($decoded)) {
                $camposAlterados = $decoded;
            } else {
                // Não registrar o JSON bruto nem valores sensíveis.
                error_log('painel/ficha.php: campos_alterados inconsistente no evento ' . (int)$event['id']);
            }
        }
        $historico[] = [
            'id' => (int)$event['id'],
            'operacao' => $event['operacao'],
            'ocorridoAt' => $event['ocorrido_at'],
            'usuarioNomeSnapshot' => $event['usuario_nome_snapshot'],
            'camposAlterados' => $camposAlterados,
            'situacaoAnterior' => $event['situacao_anterior'],
            'situacaoNova' => $event['situacao_nova'],
        ];
    }

    return [
        'id' => (int)$row['id'],
        'numero' => sprintf('PSA-%06d', (int)$row['id']),
        'crianca' => [
            'nome' => $row['crianca_nome'],
            'nomeSocial' => $row['crianca_nome_social'],
            'nascimento' => $row['crianca_nascimento'],
            'sexo' => $row['crianca_sexo'],
            'rg' => $row['crianca_rg'],
            'cpf' => $row['crianca_cpf'],
            'bairro' => $row['bairro'],
            'telefone' => $row['crianca_telefone'],
            'escola' => $row['escola_instituicao'],
            'anoEscolar' => $row['ano_escolar'],
            'serieEscolar' => $row['serie_escolar'],
        ],
        'responsavel' => [
            'nome' => $row['responsavel_nome'],
            'parentesco' => $row['responsavel_parentesco'],
            'nascimento' => $row['responsavel_nascimento'],
            'telefone' => $row['responsavel_telefone'],
            'whatsapp' => $row['responsavel_whatsapp'],
            'email' => $row['responsavel_email'],
        ],
        'necessidades' => [
            'possuiDiagnostico' => $row['possui_diagnostico'] === null ? null : (bool)$row['possui_diagnostico'],
            'necessidadesEspecificas' => $row['necessidades_especificas'],
            'outroInteresseDescricao' => $row['outro_interesse_descricao'],
            'interesses' => $interesses,
        ],
        'autorizacao' => $autorizacao,
        'administrativo' => [
            'situacao' => $row['situacao'],
            'origem' => $row['origem'],
            'dataIngresso' => $row['data_ingresso'],
            'observacoesAdministrativas' => $row['observacoes_administrativas'],
            'cadastradoPor' => $row['created_by_name_snapshot'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
            'atualizadoPor' => $row['updated_by_name_snapshot'],
        ],
        'historico' => $historico,
    ];
}
