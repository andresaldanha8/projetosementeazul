<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

function kids_validate(array $data, DateTimeImmutable $now, array $config, bool $newRegistration = true): array
{
    $expected = ['child_name', 'birth_date', 'division', 'guardian_name', 'relationship', 'phone', 'declaration_version', 'accepted'];
    $optional = ['image_authorized', 'image_authorization_version'];
    if (array_diff($expected, array_keys($data)) || array_diff(array_keys($data), array_merge($expected,$optional))) {
        throw new InvalidArgumentException('Campos inválidos.');
    }
    $out = [];
    foreach (['child_name' => 200, 'guardian_name' => 200, 'relationship' => 100, 'phone' => 30, 'birth_date' => 10, 'division' => 1, 'declaration_version' => 100] as $field => $max) {
        if (!is_string($data[$field]) || preg_match('//u', $data[$field]) !== 1) throw new InvalidArgumentException('Campos inválidos.');
        $value = trim($data[$field]);
        if ($value === '' || mb_strlen($value, 'UTF-8') > $max || preg_match('/[\x00-\x1F\x7F]/u', $value)) throw new InvalidArgumentException('Campos inválidos.');
        $out[$field] = $value;
    }
    if (!in_array($out['division'], ['M', 'F'], true)) throw new InvalidArgumentException('Divisão inválida.');
    if (!preg_match('/^[+()\d .-]+$/D', $out['phone'])) throw new InvalidArgumentException('Telefone inválido.');
    $out['phone'] = preg_replace('/\D/', '', $out['phone']);
    if (strlen($out['phone']) < 10 || strlen($out['phone']) > 15) throw new InvalidArgumentException('Telefone inválido.');
    $tz = new DateTimeZone($config['timezone']);
    $today = $now->setTimezone($tz)->setTime(0, 0);
    $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $out['birth_date'], $tz);
    if (!$birth || $birth->format('Y-m-d') !== $out['birth_date'] || $birth > $today) throw new InvalidArgumentException('Nascimento inválido.');
    $age = $birth->diff($today)->y;
    if ($newRegistration && ($age < 4 || $age > 14)) throw new InvalidArgumentException('Idade fora das faixas permitidas.');
    if ($data['accepted'] !== true || ($newRegistration && ($config['declaration_version'] === null || $out['declaration_version'] !== $config['declaration_version']))) throw new InvalidArgumentException('Declaração inválida.');
    // Apenas dados enviados compõem o hash: idade é derivada e pode mudar no replay.
    $out['accepted'] = true;
    // Preserve the original payload shape for recovery of pre-feature idempotency keys.
    if (array_key_exists('image_authorized',$data) || array_key_exists('image_authorization_version',$data)) {
        $choice=$data['image_authorized']??false;
        $version=$data['image_authorization_version']??null;
        if (!is_bool($choice) || ($version!==null && (!is_string($version) || strlen($version)>100))) throw new InvalidArgumentException('Autorização inválida.');
        if ($choice && ($version===null || ($newRegistration && $version!==$config['image_authorization_version']))) throw new InvalidArgumentException('Autorização inválida.');
        $out['image_authorized']=$choice;
        $out['image_authorization_version']=$version;
    }
    return ['input' => $out, 'age' => $age, 'category' => $age <= 7 ? '4-7' : ($age <= 10 ? '8-10' : '11-14')];
}

function kids_closed(DateTimeImmutable $now, array $config): bool
{
    return $now >= new DateTimeImmutable($config['closes_at'], new DateTimeZone($config['timezone']));
}
