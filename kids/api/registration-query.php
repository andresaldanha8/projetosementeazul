<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

/** Shared validation and predicates for the paginated list and unpaginated PDF. */
function kids_registration_filters(array $input, bool $allowId = false): array
{
    $filters=[];
    foreach (['search'=>'','payment'=>'','band'=>'4-7','id'=>''] as $key=>$default) $filters[$key]=array_key_exists($key,$input)?$input[$key]:$default;
    if (!is_string($filters['search']) || mb_strlen($filters['search'])>200
        || !in_array($filters['payment'],['','PENDENTE','CONFIRMADO'],true)
        || !in_array($filters['band'],['4-7','8-10','11-14'],true)
        || !is_string($filters['id']) || ($filters['id']!=='' && (!$allowId || !ctype_digit($filters['id'])))) {
        throw new InvalidArgumentException('Filtros inválidos.');
    }
    return $filters;
}

function kids_registration_from(string $edition, ?array $filters = null, bool $includeBand = true): array
{
    $where='e.codigo=?'; $args=[$edition];
    if ($filters!==null) {
        $search=$filters['search'];
        if ($search!=='') {
            $where.=' AND (i.crianca_nome LIKE ? OR i.responsavel_nome LIKE ? OR i.numero_peito=?)';
            array_push($args,'%'.$search.'%','%'.$search.'%',ctype_digit($search)?(int)$search:0);
        }
        if ($filters['payment']!=='') { $where.=' AND i.pagamento=?'; $args[]=$filters['payment']; }
        if ($filters['id']!=='') { $where.=' AND i.id=?'; $args[]=$filters['id']; }
        // Individual reconciliation is not band-scoped; filtered exports never accept an ID.
        elseif ($includeBand) { $where.=' AND i.faixa=?'; $args[]=$filters['band']; }
    }
    return [' FROM kids_inscricoes i JOIN kids_eventos e ON e.id=i.evento_id WHERE '.$where,$args];
}
