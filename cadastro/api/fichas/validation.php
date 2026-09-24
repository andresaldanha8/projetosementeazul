<?php
declare(strict_types=1);

// Somente funções de validação/normalização: sem sessão, HTTP ou banco.
function trim_or_null($v)
{
    if (!is_string($v)) return null;
    $t = trim($v);
    return $t === '' ? null : $t;
}

function is_valid_iso_date(string $d): bool
{
    $dt = DateTime::createFromFormat('Y-m-d', $d);
    return $dt && $dt->format('Y-m-d') === $d;
}

function normalize_digits($v)
{
    if ($v === null) return null;
    // Only accept strings here; callers must validate types before calling
    if (!is_string($v)) return null;
    $s = preg_replace('/\D+/', '', $v);
    return $s === '' ? null : $s;
}

function validate_cpf_digits(string $cpf): bool
{
    // expects 11 digits
    if (!preg_match('/^\d{11}$/', $cpf)) return false;
    // invalid known patterns
    if (preg_match('/^(\d)\1{10}$/', $cpf)) return false;
    $digits = str_split($cpf);
    // first verifier
    $sum = 0;
    for ($i = 0; $i < 9; $i++) $sum += (int)$digits[$i] * (10 - $i);
    $r = $sum % 11;
    $d1 = ($r < 2) ? 0 : 11 - $r;
    if ($d1 !== (int)$digits[9]) return false;
    // second verifier
    $sum = 0;
    for ($i = 0; $i < 10; $i++) $sum += (int)$digits[$i] * (11 - $i);
    $r = $sum % 11;
    $d2 = ($r < 2) ? 0 : 11 - $r;
    if ($d2 !== (int)$digits[10]) return false;
    return true;
}

/**
 * Regras extraídas da criação, preservando normalização e ordem dos erros.
 * A edição valida o formato estrito antes de chamar esta função.
 * Consentimento é exigido somente pelo chamador de criação.
 */
function validate_ficha_data(array $data, bool $requireConsent = false): array
{
    $errors = [];

    $child = is_array($data['child'] ?? null) ? $data['child'] : [];
    $schooling = is_array($data['schooling'] ?? null) ? $data['schooling'] : [];
    $guardian = is_array($data['guardian'] ?? null) ? $data['guardian'] : [];
    $interests = is_array($data['interests'] ?? null) ? $data['interests'] : [];
    $otherInterestDescription = $data['otherInterestDescription'] ?? null;
    $specificNeeds = $data['specificNeeds'] ?? null;
    $consent = $data['consent'] ?? null;

    // Required fields
    $child_name = trim_or_null($child['name'] ?? null);
    if ($child_name === null) $errors[] = 'child.name obrigatório.';

    // child.socialName type check and trim
    $child_social = null;
    if (array_key_exists('socialName', $child) && $child['socialName'] !== null && !is_string($child['socialName'])) {
        $errors[] = 'child.socialName tipo inválido.';
    } else {
        $child_social = trim_or_null($child['socialName'] ?? null);
    }

    $child_birth = $child['birthDate'] ?? null;
    if (!is_string($child_birth) || !is_valid_iso_date($child_birth)) $errors[] = 'child.birthDate inválida.';
    else {
        // future date check
        $d = DateTime::createFromFormat('Y-m-d', $child_birth, new DateTimeZone('UTC'));
        $nowDate = new DateTime('now', new DateTimeZone('UTC'));
        if ($d > $nowDate) $errors[] = 'child.birthDate não pode ser futura.';
    }

    $guardian_name = trim_or_null($guardian['name'] ?? null);
    if ($guardian_name === null) $errors[] = 'guardian.name obrigatório.';

    $guardian_relationship = trim_or_null($guardian['relationship'] ?? null);
    if ($guardian_relationship === null) $errors[] = 'guardian.relationship obrigatório.';

    $guardian_phone = normalize_digits($guardian['phone'] ?? null);
    $guardian_whatsapp = normalize_digits($guardian['whatsapp'] ?? null);
    if ($guardian_phone === null && $guardian_whatsapp === null) $errors[] = 'guardian.phone ou guardian.whatsapp obrigatório.';

    // consent must be boolean true
    if ($requireConsent && $consent !== true) $errors[] = 'consent deve ser true.';

    // Validate sex
    $child_sex = $child['sex'] ?? null;
    if ($child_sex !== null) {
        $allowedSex = ['FEMININO', 'MASCULINO', 'OUTRO'];
        if (!is_string($child_sex) || !in_array($child_sex, $allowedSex, true)) $errors[] = 'child.sex inválido.';
    }

    // RG
    $child_rg = trim_or_null($child['rg'] ?? null);
    if ($child_rg !== null && mb_strlen($child_rg) > 30) $errors[] = 'child.rg maior que 30 caracteres.';

    // CPF
    // CPF: must be string when provided
    if (array_key_exists('cpf', $child) && $child['cpf'] !== null && !is_string($child['cpf'])) {
        $errors[] = 'child.cpf tipo inválido.';
        $child_cpf = null;
    } else {
        $child_cpf = normalize_digits($child['cpf'] ?? null);
    }
    if ($child_cpf !== null) {
        if (!preg_match('/^\d{11}$/', $child_cpf) || !validate_cpf_digits($child_cpf)) $errors[] = 'child.cpf inválido.';
    }

    // neighborhood
    $child_neighborhood = trim_or_null($child['neighborhood'] ?? null);
    if ($child_neighborhood !== null && mb_strlen($child_neighborhood) > 150) $errors[] = 'child.neighborhood muito longa.';

    // phone
    // child.phone must be string when provided
    if (array_key_exists('phone', $child) && $child['phone'] !== null && !is_string($child['phone'])) {
        $errors[] = 'child.phone tipo inválido.';
        $child_phone = null;
    } else {
        $child_phone = normalize_digits($child['phone'] ?? null);
        if ($child_phone !== null && !preg_match('/^\d{10,11}$/', $child_phone)) $errors[] = 'child.phone inválido.';
    }

    // school
    $child_school = trim_or_null($child['school'] ?? null);
    if ($child_school !== null && mb_strlen($child_school) > 200) $errors[] = 'child.school muito longo.';

    // hasDiagnosis
    $hasDiagnosis = $child['hasDiagnosis'] ?? null;
    if ($hasDiagnosis !== null && !is_bool($hasDiagnosis)) $errors[] = 'child.hasDiagnosis inválido.';

    // schooling
    $schooling_year = trim_or_null($schooling['year'] ?? null);
    if ($schooling_year !== null && mb_strlen($schooling_year) > 50) $errors[] = 'schooling.year muito longo.';
    $schooling_grade = trim_or_null($schooling['grade'] ?? null);
    if ($schooling_grade !== null && mb_strlen($schooling_grade) > 50) $errors[] = 'schooling.grade muito longo.';

    // guardian birth
    $guardian_birth = $guardian['birthDate'] ?? null;
    if ($guardian_birth !== null) {
        if (!is_string($guardian_birth) || !is_valid_iso_date($guardian_birth)) $errors[] = 'guardian.birthDate inválida.';
        else {
            $d = DateTime::createFromFormat('Y-m-d', $guardian_birth, new DateTimeZone('UTC'));
            $nowDate = new DateTime('now', new DateTimeZone('UTC'));
            if ($d > $nowDate) $errors[] = 'guardian.birthDate não pode ser futura.';
        }
    }

    // guardian email
    $guardian_email = trim_or_null($guardian['email'] ?? null);
    if ($guardian_email !== null) {
        if (mb_strlen($guardian_email) > 254 || !filter_var($guardian_email, FILTER_VALIDATE_EMAIL)) $errors[] = 'guardian.email inválido.';
    }

    // guardian.phone and guardian.whatsapp must be strings when provided
    if (array_key_exists('phone', $guardian) && $guardian['phone'] !== null && !is_string($guardian['phone'])) {
        $errors[] = 'guardian.phone tipo inválido.';
    }
    if (array_key_exists('whatsapp', $guardian) && $guardian['whatsapp'] !== null && !is_string($guardian['whatsapp'])) {
        $errors[] = 'guardian.whatsapp tipo inválido.';
    }
    // Normalize and validate guardian phones
    $guardian_phone = normalize_digits($guardian['phone'] ?? null);
    $guardian_whatsapp = normalize_digits($guardian['whatsapp'] ?? null);
    if ($guardian_phone !== null && !preg_match('/^\d{10,11}$/', $guardian_phone)) $errors[] = 'guardian.phone inválido.';
    if ($guardian_whatsapp !== null && !preg_match('/^\d{10,11}$/', $guardian_whatsapp)) $errors[] = 'guardian.whatsapp inválido.';
    if ($guardian_phone === null && $guardian_whatsapp === null) $errors[] = 'guardian.phone ou guardian.whatsapp obrigatório.';

    // normalize otherInterestDescription and specificNeeds
    // otherInterestDescription handled above; ensure type was string or null
    $otherInterestDescription = trim_or_null($otherInterestDescription);
    if ($otherInterestDescription !== null && mb_strlen($otherInterestDescription) > 255) $errors[] = 'otherInterestDescription muito longa.';

    $specificNeeds = trim_or_null($specificNeeds);

    // interests: normalize codes
    $normalized_interests = [];
    if (is_array($interests)) {
        foreach ($interests as $c) {
            if (!is_string($c)) continue;
            $code = strtoupper(trim($c));
            if ($code === '') continue;
            $normalized_interests[$code] = $code; // dedupe
        }
        $normalized_interests = array_values($normalized_interests);
    }

    // If OUTRAS present, require otherInterestDescription
    $has_outras = in_array('OUTRAS', $normalized_interests, true);
    if ($has_outras) {
        if ($otherInterestDescription === null) $errors[] = 'otherInterestDescription obrigatório quando OUTRAS selecionado.';
    }

    // Length validations for fields that must not be truncated
    if (is_string($child_name) && mb_strlen($child_name) > 200) $errors[] = 'child.name muito longo.';
    if ($child_social !== null && mb_strlen($child_social) > 200) $errors[] = 'child.socialName muito longo.';
    if (is_string($guardian_name) && mb_strlen($guardian_name) > 200) $errors[] = 'guardian.name muito longo.';
    if (is_string($guardian_relationship) && mb_strlen($guardian_relationship) > 100) $errors[] = 'guardian.relationship muito longo.';

    return compact(
        'errors',
        'child',
        'consent',
        'child_name',
        'child_social',
        'child_birth',
        'child_sex',
        'child_rg',
        'child_cpf',
        'child_neighborhood',
        'child_phone',
        'child_school',
        'hasDiagnosis',
        'schooling_year',
        'schooling_grade',
        'guardian_name',
        'guardian_relationship',
        'guardian_birth',
        'guardian_phone',
        'guardian_whatsapp',
        'guardian_email',
        'otherInterestDescription',
        'specificNeeds',
        'normalized_interests',
        'has_outras'
    );
}
