<?php
declare(strict_types=1);
require_once __DIR__ . '/http.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') { header('Allow: GET'); kids_reply(405, ['ok' => false]); }
kids_public_session(true);
$config = kids_config();
if (!isset($_SESSION['generation'])) $_SESSION['generation'] = bin2hex(random_bytes(16));
$now = new DateTimeImmutable('now', new DateTimeZone($config['timezone']));
kids_reply(200, [
    'ok' => true, 'csrf_token' => $_SESSION['csrf'], 'expires_at' => $_SESSION['expires'],
    'session_generation' => $_SESSION['generation'],
    'public_open' => $config['public_open'], 'declaration_version' => $config['declaration_version'],
    'declaration_text' => $config['declaration_text'],
    'image_authorization_version' => $config['image_authorization_version'],
    'image_authorization_text' => $config['image_authorization_text'],
    'event' => [
        'name' => $config['name'], 'date' => $config['event_date'], 'timezone' => $config['timezone'],
        'closes_at' => (new DateTimeImmutable($config['closes_at'], new DateTimeZone($config['timezone'])))->format(DateTimeInterface::ATOM),
        'server_now' => $now->format(DateTimeInterface::ATOM),
        'amount_cents' => $config['amount_cents'], 'shirt_size' => $config['shirt_size'],
        'pix' => $config['pix'], 'payee' => $config['payee'], 'whatsapp' => $config['whatsapp'],
    ],
]);
