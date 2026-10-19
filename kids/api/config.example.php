<?php
declare(strict_types=1);
// Copy to config.php locally and fill public payment/contact settings.
// The filled config.php stays outside Git.

function kids_config(): array
{
    return [
        'edition' => 'AUTISMO-RUN-2026-KIDS',
        'name' => 'II Corrida Solidária Autismo Run',
        'event_date' => '2026-11-22',
        'timezone' => 'America/Sao_Paulo',
        'closes_at' => '2026-11-21 16:00:00',
        'amount_cents' => 6000,
        'shirt_size' => 'P',
        'pix' => 'PREENCHA_CHAVE_PIX',
        'payee' => 'PREENCHA_FAVORECIDO',
        'whatsapp' => 'PREENCHA_WHATSAPP',
        // Versioned separately. Installing these texts does not open registrations.
        'declaration_version' => 'KIDS-2026-v2',
        'declaration_text' => 'Declaro ser responsável legal pela criança inscrita ou estar autorizado por seu responsável legal a realizar esta inscrição. Confirmo que os dados informados são verdadeiros e autorizo sua participação no Autismo Run KIDS. Estou ciente do valor de R$ 60,00, com camisa tamanho P incluída, e de que o pagamento ficará pendente até a conferência pela organização. Comprometo-me a seguir as orientações da equipe e a garantir que a criança esteja acompanhada por seu responsável no evento.',
        'image_authorization_version' => 'KIDS-IMAGEM-2026-v1',
        'image_authorization_text' => 'Como responsável legal pela criança, autorizo o uso de sua imagem em fotos e vídeos do Autismo Run KIDS para divulgação do evento e das atividades do Projeto Semente Azul em seus canais oficiais.',
        'public_open' => false,
        'session_seconds' => 28800,
        'lookup_window_seconds' => 600,
        'lookup_session_limit' => 5,
        'lookup_ip_limit' => 20,
    ];
}
