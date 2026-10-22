<?php
declare(strict_types=1);

// Static BR Code (EMV MPM). No charge creation or payment confirmation.
function kids_pix_field(string $id, string $value): string
{
    $length = strlen($value);
    if ($length < 1 || $length > 99) throw new InvalidArgumentException('Invalid PIX field length');
    return $id.str_pad((string)$length, 2, '0', STR_PAD_LEFT).$value;
}

function kids_pix_text(string $text, int $limit): string
{
    $ascii = strtr($text, ['Á'=>'A','À'=>'A','Â'=>'A','Ã'=>'A','Ä'=>'A','á'=>'a','à'=>'a','â'=>'a','ã'=>'a','ä'=>'a','É'=>'E','Ê'=>'E','é'=>'e','ê'=>'e','Í'=>'I','í'=>'i','Ó'=>'O','Ô'=>'O','Õ'=>'O','ó'=>'o','ô'=>'o','õ'=>'o','Ú'=>'U','Ü'=>'U','ú'=>'u','ü'=>'u','Ç'=>'C','ç'=>'c']);
    $ascii = trim(preg_replace('/[^A-Z0-9 ]/', '', strtoupper($ascii)));
    return rtrim(substr(preg_replace('/ +/', ' ', $ascii), 0, $limit));
}

function kids_pix_crc(string $payload): string
{
    $crc = 0xFFFF;
    for ($i = 0, $length = strlen($payload); $i < $length; $i++) {
        $crc ^= ord($payload[$i]) << 8;
        for ($bit = 0; $bit < 8; $bit++) {
            $crc = (($crc & 0x8000) ? ($crc << 1) ^ 0x1021 : $crc << 1) & 0xFFFF;
        }
    }
    return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
}

function kids_pix_payload(int $amountCents, array $config): string
{
    // This KIDS recipient uses a CNPJ. Keep display punctuation out of the BR Code.
    $key = preg_replace('/\D/', '', $config['pix']);
    if (strlen($key) !== 14 || $amountCents <= 0 || $amountCents > 999999999999) {
        throw new InvalidArgumentException('Invalid KIDS PIX key or amount');
    }
    $amount = intdiv($amountCents, 100).'.'.str_pad((string)($amountCents % 100), 2, '0', STR_PAD_LEFT);
    // EMV limits: name 25, city 15 ASCII characters. City abbreviated from
    // Vitória do Xingu–PA; the state is not part of Merchant City.
    $name = kids_pix_text(str_replace('ASSOCIACAO PROJETO', 'ASSOC PROJ', kids_pix_text($config['payee'], 99)), 25);
    $city = 'VITORIA XINGU';
    $payload = kids_pix_field('00', '01')
        .kids_pix_field('26', kids_pix_field('00', 'br.gov.bcb.pix').kids_pix_field('01', $key))
        .kids_pix_field('52', '0000').kids_pix_field('53', '986')
        .kids_pix_field('54', $amount).kids_pix_field('58', 'BR')
        .kids_pix_field('59', $name).kids_pix_field('60', $city)
        // No reconciliation identifier: manual administrative checking is unchanged.
        .kids_pix_field('62', kids_pix_field('05', '***')).'6304';
    return $payload.kids_pix_crc($payload);
}
