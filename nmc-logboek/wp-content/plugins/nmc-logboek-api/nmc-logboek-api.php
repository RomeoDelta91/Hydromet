<?php
/**
 * Plugin Name: NMC Logboek API
 * Description: Custom REST API endpoints voor het NMC Digitaal Logboek. Beheert eigen
 *              gebruikersaccounts (los van WordPress-gebruikers) zodat nieuwe forecasters/
 *              observers via de app zelf aangemaakt kunnen worden, zonder wp-admin.
 * Version: 2.0
 */

// ---------------------------------------------------------------------------
// Activatie: maak alle benodigde tabellen + een eerste admin-account.
// ---------------------------------------------------------------------------

register_activation_hook(__FILE__, 'nmc_activate_plugin');

function nmc_activate_plugin() {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();

    $usersTable    = $wpdb->prefix . 'nmc_logboek_users';
    $logTable      = $wpdb->prefix . 'nmc_logboek';
    $personenTable = $wpdb->prefix . 'nmc_logboek_personen';

    dbDelta("CREATE TABLE $usersTable (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        username      VARCHAR(60)  NOT NULL UNIQUE,
        naam          VARCHAR(80)  NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(20)  NOT NULL DEFAULT 'forecaster',
        actief        TINYINT(1)   NOT NULL DEFAULT 1,
        created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) $charset;");

    dbDelta("CREATE TABLE $logTable (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        uuid          VARCHAR(36)  NOT NULL UNIQUE,
        type          VARCHAR(20)  NOT NULL,
        datum         DATE         NOT NULL,
        shift         VARCHAR(80)  NOT NULL,
        ingevuld_door VARCHAR(80),
        meteoroloog   VARCHAR(80),
        ts_created    DATETIME     DEFAULT CURRENT_TIMESTAMP,
        ts_updated    DATETIME     NULL,
        deleted_at    DATETIME     DEFAULT NULL,
        data_json     LONGTEXT     NOT NULL,
        UNIQUE KEY uniq_shift (datum, shift, type, meteoroloog),
        KEY idx_datum (datum),
        KEY idx_type_datum (type, datum),
        KEY idx_shift (datum, shift),
        KEY idx_deleted (deleted_at)
    ) $charset;");

    dbDelta("CREATE TABLE $personenTable (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        logboek_id    INT          NOT NULL,
        naam          VARCHAR(80)  NOT NULL,
        werktijd_van  VARCHAR(8),
        werktijd_tot  VARCHAR(8),
        synop_totaal  INT DEFAULT 0,
        metar_totaal  INT DEFAULT 0,
        klima_totaal  INT DEFAULT 0,
        taf_totaal    INT DEFAULT 0,
        KEY idx_naam (naam),
        KEY idx_logboek_id (logboek_id)
    ) $charset;");

    // Genereer eenmalig een geheime sleutel voor het signeren van login-tokens.
    if (!get_option('nmc_auth_secret')) {
        update_option('nmc_auth_secret', wp_generate_password(64, true, true), true);
    }

    // Maak één eerste admin-account aan zodat de app meteen te beheren is
    // zonder tussenkomst van WordPress-beheer. WIJZIG DIT WACHTWOORD DIRECT
    // na de eerste keer inloggen via het "Beheer"-tabblad.
    $existing = $wpdb->get_var("SELECT COUNT(*) FROM $usersTable");
    if ((int) $existing === 0) {
        $wpdb->insert($usersTable, [
            'username'      => 'admin',
            'naam'          => 'Beheerder',
            'password_hash' => password_hash('NmcLogboek2026!', PASSWORD_BCRYPT),
            'role'          => 'admin',
        ]);
    }
}

// ---------------------------------------------------------------------------
// Eigen token-authenticatie (los van WordPress-gebruikers/JWT-plugin).
// ---------------------------------------------------------------------------

function nmc_get_secret() {
    $secret = get_option('nmc_auth_secret');
    if (!$secret) {
        $secret = wp_generate_password(64, true, true);
        update_option('nmc_auth_secret', $secret, true);
    }
    return $secret;
}

define('NMC_TOKEN_GELDIG_UREN', 12);

function nmc_issue_token($user) {
    $payload = base64_encode(json_encode([
        'uid'  => (int) $user['id'],
        'naam' => $user['naam'],
        'role' => $user['role'],
        // Kort genoeg om één dienst te dekken: een achtergebleven of gelekt
        // token is daarna vanzelf waardeloos.
        'exp'  => time() + NMC_TOKEN_GELDIG_UREN * HOUR_IN_SECONDS,
    ]));
    $sig = hash_hmac('sha256', $payload, nmc_get_secret());
    return $payload . '.' . $sig;
}

function nmc_verify_token($token) {
    if (!$token || strpos($token, '.') === false) return null;
    [$payload, $sig] = explode('.', $token, 2);
    $expected = hash_hmac('sha256', $payload, nmc_get_secret());
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode($payload), true);
    if (!is_array($data) || empty($data['exp']) || $data['exp'] < time()) return null;
    return $data;
}

function nmc_get_bearer_token(WP_REST_Request $req) {
    $auth = $req->get_header('authorization');
    if (!$auth || stripos($auth, 'Bearer ') !== 0) return null;
    return trim(substr($auth, 7));
}

function nmc_current_user(WP_REST_Request $req) {
    return nmc_verify_token(nmc_get_bearer_token($req));
}

function nmc_auth_required(WP_REST_Request $req) {
    return nmc_current_user($req) !== null;
}

function nmc_chef_required(WP_REST_Request $req) {
    $u = nmc_current_user($req);
    return $u && in_array($u['role'], ['chef', 'admin'], true);
}

// Lezen/exporteren van het overzicht: chef, admin, administratie én viewer.
// Administratie en viewer mogen uitsluitend lezen (viewer ook Analyse) — niet
// bewerken of verwijderen (die routes blijven op nmc_chef_required staan).
function nmc_overzicht_required(WP_REST_Request $req) {
    $u = nmc_current_user($req);
    return $u && in_array($u['role'], ['chef', 'admin', 'administratie', 'viewer'], true);
}

function nmc_admin_required(WP_REST_Request $req) {
    $u = nmc_current_user($req);
    return $u && $u['role'] === 'admin';
}

// Lezen van "Vorige Records" (forecaster/observer roepen alleen hun eigen
// type op, zie nmc_get_logboek) naast het volledige Overzicht voor
// chef/admin/administratie/viewer.
function nmc_logboek_read_required(WP_REST_Request $req) {
    $u = nmc_current_user($req);
    return $u && in_array($u['role'], ['chef', 'admin', 'administratie', 'viewer', 'forecaster', 'observer'], true);
}

// Forecasters mogen alleen 'forecaster'-entries aanmaken, observers alleen
// 'observer'-entries. Chef/admin mogen beide (volledige controle).
function nmc_role_can_use_type($role, $type) {
    if (in_array($role, ['chef', 'admin'], true)) return true;
    return $role === $type;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

add_action('rest_api_init', function() {
    $ns = 'nmc/v1';

    register_rest_route($ns, '/auth/login', [
        'methods'             => 'POST',
        'callback'            => 'nmc_login',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($ns, '/me', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_me',
        'permission_callback' => 'nmc_auth_required',
    ]);

    // Overzicht/Analyse (lezen + bewerken van bestaande entries) is voorbehouden
    // aan chef/admin — forecasters en observers mogen alleen hun eigen sectie
    // invullen (POST), niet bladeren of bewerken.
    register_rest_route($ns, '/logboek', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_logboek',
        'permission_callback' => 'nmc_logboek_read_required',
    ]);

    register_rest_route($ns, '/logboek', [
        'methods'             => 'POST',
        'callback'            => 'nmc_post_logboek',
        'permission_callback' => 'nmc_auth_required',
    ]);

    // Eigen invoer corrigeren binnen het correctievenster (forecaster/observer).
    register_rest_route($ns, '/logboek/corrigeerbaar', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_corrigeerbaar',
        'permission_callback' => 'nmc_auth_required',
    ]);

    register_rest_route($ns, '/logboek/(?P<uuid>[a-zA-Z0-9-]+)/correctie', [
        'methods'             => 'POST',
        'callback'            => 'nmc_correctie_logboek',
        'permission_callback' => 'nmc_auth_required',
    ]);

    register_rest_route($ns, '/logboek/check', [
        'methods'             => 'GET',
        'callback'            => 'nmc_check_duplicate',
        'permission_callback' => 'nmc_auth_required',
    ]);

    register_rest_route($ns, '/logboek/(?P<uuid>[a-zA-Z0-9-]+)', [
        'methods'             => 'PUT',
        'callback'            => 'nmc_put_logboek',
        'permission_callback' => 'nmc_chef_required',
    ]);

    register_rest_route($ns, '/logboek/(?P<uuid>[a-zA-Z0-9-]+)', [
        'methods'             => 'DELETE',
        'callback'            => 'nmc_delete_logboek',
        'permission_callback' => 'nmc_chef_required',
    ]);

    register_rest_route($ns, '/personen', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_personen',
        'permission_callback' => 'nmc_overzicht_required',
    ]);

    // Gebruikersbeheer — alleen voor 'admin'-rol, vervangt wp-admin gebruikersbeheer.
    register_rest_route($ns, '/users', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_users',
        'permission_callback' => 'nmc_admin_required',
    ]);

    register_rest_route($ns, '/users', [
        'methods'             => 'POST',
        'callback'            => 'nmc_create_user',
        'permission_callback' => 'nmc_admin_required',
    ]);

    register_rest_route($ns, '/users/(?P<id>\d+)', [
        'methods'             => 'PUT',
        'callback'            => 'nmc_update_user',
        'permission_callback' => 'nmc_admin_required',
    ]);

    register_rest_route($ns, '/users/(?P<id>\d+)', [
        'methods'             => 'DELETE',
        'callback'            => 'nmc_delete_user',
        'permission_callback' => 'nmc_admin_required',
    ]);

    // Login-logboek — uitsluitend voor 'admin', niemand anders (ook chef niet).
    register_rest_route($ns, '/logs', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_login_logs',
        'permission_callback' => 'nmc_admin_required',
    ]);

    register_rest_route($ns, '/logs/(?P<file>[a-zA-Z0-9\-\.]+)', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_login_log_content',
        'permission_callback' => 'nmc_admin_required',
    ]);
});

// ---------------------------------------------------------------------------
// Auth handlers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Login-logboek: legt elke login-poging vast (wie, vanaf welk IP, geslaagd of
// niet) voor kwaliteits-/fraudecontrole. Eén tekstbestand per kalendermaand,
// automatisch aangemaakt zodra de maand wisselt — geen aparte rotatie-taak
// nodig, de bestandsnaam bevat het jaar+maand.
function nmc_logs_dir() {
    $dir = plugin_dir_path(__FILE__) . 'logs/';
    if (!file_exists($dir)) {
        wp_mkdir_p($dir);
    }
    $htaccess = $dir . '.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "Deny from all\n");
    }
    $index = $dir . 'index.php';
    if (!file_exists($index)) {
        file_put_contents($index, "<?php\n// Silence is golden.\n");
    }
    return $dir;
}

function nmc_client_ip() {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = $_SERVER[$key];
            if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
            return sanitize_text_field($ip);
        }
    }
    return 'onbekend';
}

function nmc_log_login($username, $naam, $role, $status) {
    $dir  = nmc_logs_dir();
    $file = $dir . 'login-log-' . date('Y-m') . '.txt';
    $line = sprintf(
        "[%s] status=%s gebruikersnaam=%s naam=%s rol=%s ip=%s\n",
        current_time('mysql'),
        $status,
        $username,
        $naam ?: '-',
        $role ?: '-',
        nmc_client_ip()
    );
    file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
}

// Lijst van beschikbare maand-logbestanden (nieuwste eerst), met bestandsgrootte
// en aantal regels, zodat de admin niet blind hoeft te downloaden.
function nmc_get_login_logs() {
    $dir = nmc_logs_dir();
    $files = glob($dir . 'login-log-*.txt');
    if (!$files) return rest_ensure_response([]);
    rsort($files);
    $out = array_map(function($path) {
        $name = basename($path);
        $lines = 0;
        $handle = fopen($path, 'r');
        if ($handle) {
            while (!feof($handle)) { fgets($handle); $lines++; }
            fclose($handle);
        }
        return [
            'bestand'    => $name,
            'grootte_kb' => round(filesize($path) / 1024, 1),
            'regels'     => max(0, $lines - 1),
        ];
    }, $files);
    return rest_ensure_response($out);
}

// Geeft de volledige inhoud van één maand-logbestand terug als platte tekst.
// Bestandsnaam wordt strikt gevalideerd (regex in de route + nogmaals hier)
// zodat er nooit buiten de logs-map gelezen kan worden.
function nmc_get_login_log_content(WP_REST_Request $req) {
    $file = $req->get_param('file');
    if (!preg_match('/^login-log-\d{4}-\d{2}\.txt$/', $file)) {
        return new WP_Error('invalid_file', 'Ongeldige bestandsnaam.', ['status' => 400]);
    }
    $dir  = nmc_logs_dir();
    $path = $dir . $file;
    if (!file_exists($path)) {
        return new WP_Error('not_found', 'Logbestand niet gevonden.', ['status' => 404]);
    }
    return new WP_REST_Response(file_get_contents($path), 200, ['Content-Type' => 'text/plain; charset=utf-8']);
}

// ---------------------------------------------------------------------------
// Login-poging-limiet: na 5 mislukte pogingen wordt het account 15 minuten
// geblokkeerd. Gebruikt WP-transients (self-expirend, geen aparte tabel nodig).
// ---------------------------------------------------------------------------
define('NMC_LOGIN_MAX_POGINGEN', 5);
define('NMC_LOGIN_LOCKOUT_MINUTEN', 15);

function nmc_login_fail_key($username)   { return 'nmc_login_fails_' . md5($username); }
function nmc_login_lockout_key($username) { return 'nmc_login_lockout_' . md5($username); }

function nmc_login_is_locked($username) {
    return get_transient(nmc_login_lockout_key($username)) !== false;
}

function nmc_login_register_fail($username) {
    $key = nmc_login_fail_key($username);
    $fails = (int) get_transient($key);
    $fails++;
    set_transient($key, $fails, NMC_LOGIN_LOCKOUT_MINUTEN * MINUTE_IN_SECONDS);
    if ($fails >= NMC_LOGIN_MAX_POGINGEN) {
        set_transient(nmc_login_lockout_key($username), 1, NMC_LOGIN_LOCKOUT_MINUTEN * MINUTE_IN_SECONDS);
    }
}

function nmc_login_clear_fails($username) {
    delete_transient(nmc_login_fail_key($username));
    delete_transient(nmc_login_lockout_key($username));
}

// ---------------------------------------------------------------------------
// Correctievenster: een forecaster/observer mag zijn eigen invoer nog een korte
// tijd na het opslaan zelf corrigeren. Corrigeren is nadrukkelijk iets anders
// dan overschrijven — de oorspronkelijke versie blijft bewaard en elke
// correctie wordt gelogd, zodat er nooit iets ongemerkt verdwijnt.
// ---------------------------------------------------------------------------
define('NMC_CORRECTIE_MINUTEN', 30);

// Heeft de chef een aantekening bij dit record gemaakt?
function nmc_heeft_chef_aantekening($data, $ingevuld_door) {
    return !empty($data['chef_edits']);
}

// Ontbrekend, null, lege tekst en lege lijst betekenen allemaal "niets
// ingevuld" — anders geldt een veld dat pas later aan het formulier is
// toegevoegd ten onrechte als wijziging.
function nmc_genormaliseerd($v) {
    if ($v === null || $v === '') return null;
    if (is_array($v) && count($v) === 0) return null;
    return $v;
}

// Meta-velden die niet meetellen als inhoudelijke wijziging.
function nmc_diff_velden($oud, $nieuw) {
    $skip = [
        'id', 'uuid', 'ts', 'ts_created', 'ts_updated', 'deleted_at', 'data_json',
        'type', 'ingevuld_door', 'chef_edits', 'chef_edit_door', 'chef_edit_datum',
        'originele_versie', 'correcties', 'correctie_velden',
    ];
    $oud = is_array($oud) ? $oud : [];
    $nieuw = is_array($nieuw) ? $nieuw : [];
    $keys = array_unique(array_merge(array_keys($oud), array_keys($nieuw)));
    $uit = [];
    foreach ($keys as $k) {
        if (in_array($k, $skip, true)) continue;
        if (json_encode(nmc_genormaliseerd($oud[$k] ?? null)) !== json_encode(nmc_genormaliseerd($nieuw[$k] ?? null))) $uit[] = $k;
    }
    return $uit;
}

// Geeft de eigen, nog corrigeerbare invoer terug (of null). Het venster wordt
// volledig met de databaseklok berekend, zodat de klok van de computer van de
// gebruiker geen invloed heeft.
function nmc_get_corrigeerbaar(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek';
    $user  = nmc_current_user($req);

    $type = $req->get_param('type');
    if (in_array($user['role'], ['forecaster', 'observer'], true)) $type = $user['role'];
    if (!$type) return rest_ensure_response(null);

    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT *, TIMESTAMPDIFF(SECOND, ts_created, NOW()) AS verstreken
         FROM $table
         WHERE deleted_at IS NULL AND ingevuld_door = %s AND type = %s
           AND ts_created >= DATE_SUB(NOW(), INTERVAL %d MINUTE)
         ORDER BY ts_created DESC LIMIT 1",
        $user['naam'], $type, NMC_CORRECTIE_MINUTEN
    ), ARRAY_A);

    if (!$row) return rest_ensure_response(null);

    $data = json_decode($row['data_json'], true) ?: [];
    // Heeft de chef al een aantekening gemaakt, dan is corrigeren niet meer
    // toegestaan — anders zou de aantekening overschreven kunnen worden.
    if (nmc_heeft_chef_aantekening($data, $row['ingevuld_door'])) return rest_ensure_response(null);

    $resterend = (NMC_CORRECTIE_MINUTEN * 60) - (int) $row['verstreken'];
    return rest_ensure_response([
        'uuid'               => $row['uuid'],
        'datum'              => $row['datum'],
        'shift'              => $row['shift'],
        'opgeslagen'         => $row['ts_created'],
        'resterend_seconden' => max(0, $resterend),
        'entry'              => array_merge($data, ['uuid' => $row['uuid']]),
    ]);
}

function nmc_correctie_logboek(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek';
    $uuid  = $req->get_param('uuid');
    $user  = nmc_current_user($req);
    $body  = $req->get_json_params();

    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT *, (ts_created >= DATE_SUB(NOW(), INTERVAL %d MINUTE)) AS binnen_venster
         FROM $table WHERE uuid = %s AND deleted_at IS NULL",
        NMC_CORRECTIE_MINUTEN, $uuid
    ), ARRAY_A);

    if (!$row) return new WP_Error('not_found', 'Logboek niet gevonden.', ['status' => 404]);

    if ((string) $row['ingevuld_door'] !== (string) $user['naam']) {
        return new WP_Error('forbidden', 'U kunt alleen uw eigen invoer corrigeren.', ['status' => 403]);
    }
    if (!$row['binnen_venster']) {
        return new WP_Error('venster_verstreken', 'Het correctievenster is verstreken. Vraag de chef om de aanpassing te doen.', ['status' => 403]);
    }

    $oud = json_decode($row['data_json'], true) ?: [];
    if (nmc_heeft_chef_aantekening($oud, $row['ingevuld_door'])) {
        return new WP_Error('forbidden', 'De chef heeft een aantekening gemaakt; corrigeren is niet meer mogelijk.', ['status' => 403]);
    }

    $gewijzigd = nmc_diff_velden($oud, $body);
    if (empty($gewijzigd)) return rest_ensure_response(['success' => true, 'gewijzigd' => []]);

    $nieuw = $body;
    // De oorspronkelijke versie wordt maar één keer vastgelegd: bij de eerste
    // correctie. Latere correcties laten die ongemoeid.
    $nieuw['originele_versie'] = $oud['originele_versie'] ?? $oud;

    $correcties = (isset($oud['correcties']) && is_array($oud['correcties'])) ? $oud['correcties'] : [];
    $correcties[] = [
        'door'     => $user['naam'],
        'tijdstip' => current_time('mysql'),
        'velden'   => $gewijzigd,
    ];
    $nieuw['correcties'] = $correcties;

    $eerder = (isset($oud['correctie_velden']) && is_array($oud['correctie_velden'])) ? $oud['correctie_velden'] : [];
    $nieuw['correctie_velden'] = array_values(array_unique(array_merge($eerder, $gewijzigd)));

    // Chef-aantekeningen mogen nooit via een correctie gezet of gewist worden.
    foreach (['chef_edits', 'chef_edit_door', 'chef_edit_datum'] as $k) {
        if (isset($oud[$k])) $nieuw[$k] = $oud[$k]; else unset($nieuw[$k]);
    }

    $meteoroloog = $row['type'] === 'forecaster'
        ? ($nieuw['personen'][0]['naam'] ?? ($nieuw['meteoroloog'] ?? $row['meteoroloog']))
        : ($nieuw['personen'][0]['naam'] ?? ($nieuw['administratie'][0] ?? $row['meteoroloog']));

    // ts_created blijft ongemoeid: het venster is verankerd aan het oorspronkelijke
    // opslagmoment en wordt dus niet verlengd door te blijven corrigeren.
    $result = $wpdb->update($table, [
        'datum'       => $nieuw['datum'] ?? $row['datum'],
        'shift'       => $nieuw['shift'] ?? $row['shift'],
        'meteoroloog' => $meteoroloog,
        'data_json'   => json_encode($nieuw),
        'ts_updated'  => current_time('mysql'),
    ], ['uuid' => $uuid, 'deleted_at' => null]);

    if ($result === false) return new WP_Error('db_error', $wpdb->last_error, ['status' => 500]);

    if ($row['type'] === 'observer') {
        nmc_sync_personen($row['id'], $nieuw['personen'] ?? []);
    }

    return rest_ensure_response(['success' => true, 'gewijzigd' => $gewijzigd]);
}

function nmc_login(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek_users';
    $body  = $req->get_json_params();
    $username = sanitize_user($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (!$username || !$password) {
        return rest_ensure_response(['success' => false, 'error' => 'Vul gebruikersnaam en wachtwoord in.']);
    }

    if (nmc_login_is_locked($username)) {
        nmc_log_login($username, '', '', 'GEBLOKKEERD');
        return rest_ensure_response(['success' => false, 'error' => 'Te veel mislukte inlogpogingen. Probeer het over ' . NMC_LOGIN_LOCKOUT_MINUTEN . ' minuten opnieuw.']);
    }

    $user = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE username=%s AND actief=1", $username
    ), ARRAY_A);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        nmc_login_register_fail($username);
        nmc_log_login($username, $user['naam'] ?? '', $user['role'] ?? '', 'MISLUKT');
        return rest_ensure_response(['success' => false, 'error' => 'Onjuiste gebruikersnaam of wachtwoord.']);
    }

    nmc_login_clear_fails($username);
    nmc_log_login($username, $user['naam'], $user['role'], 'OK');

    return rest_ensure_response([
        'success' => true,
        'token'   => nmc_issue_token($user),
        'naam'    => $user['naam'],
        'role'    => $user['role'],
    ]);
}

function nmc_get_me(WP_REST_Request $req) {
    $u = nmc_current_user($req);
    return rest_ensure_response(['naam' => $u['naam'], 'role' => $u['role']]);
}

// ---------------------------------------------------------------------------
// Gebruikersbeheer (admin)
// ---------------------------------------------------------------------------

function nmc_get_users() {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek_users';
    $rows = $wpdb->get_results("SELECT id, username, naam, role, actief, created_at FROM $table ORDER BY naam", ARRAY_A);
    return rest_ensure_response($rows);
}

function nmc_create_user(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek_users';
    $body  = $req->get_json_params();

    $username = sanitize_user($body['username'] ?? '');
    $naam     = sanitize_text_field($body['naam'] ?? '');
    $password = $body['password'] ?? '';
    $role     = in_array($body['role'] ?? '', ['forecaster', 'observer', 'administratie', 'viewer', 'chef', 'admin'], true) ? $body['role'] : 'forecaster';

    if (!$username || !$naam || !$password) {
        return new WP_Error('missing_fields', 'Gebruikersnaam, naam en wachtwoord zijn verplicht', ['status' => 400]);
    }

    $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE username=%s", $username));
    if ($exists) {
        return new WP_Error('duplicate', 'Deze gebruikersnaam bestaat al', ['status' => 409]);
    }

    $result = $wpdb->insert($table, [
        'username'      => $username,
        'naam'          => $naam,
        'password_hash' => password_hash($password, PASSWORD_BCRYPT),
        'role'          => $role,
    ]);

    if ($result === false) return new WP_Error('db_error', $wpdb->last_error, ['status' => 500]);
    return rest_ensure_response(['success' => true, 'id' => $wpdb->insert_id]);
}

function nmc_update_user(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek_users';
    $id    = (int) $req->get_param('id');
    $body  = $req->get_json_params();

    $data = [];
    if (!empty($body['naam']))     $data['naam'] = sanitize_text_field($body['naam']);
    if (!empty($body['role']) && in_array($body['role'], ['forecaster', 'observer', 'administratie', 'viewer', 'chef', 'admin'], true)) {
        $data['role'] = $body['role'];
    }
    if (!empty($body['password'])) $data['password_hash'] = password_hash($body['password'], PASSWORD_BCRYPT);
    if (isset($body['actief']))    $data['actief'] = $body['actief'] ? 1 : 0;

    if (empty($data)) return new WP_Error('no_fields', 'Niets om bij te werken', ['status' => 400]);

    $result = $wpdb->update($table, $data, ['id' => $id]);
    if ($result === false) return new WP_Error('db_error', $wpdb->last_error, ['status' => 500]);
    return rest_ensure_response(['success' => true]);
}

function nmc_delete_user(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek_users';
    $id    = (int) $req->get_param('id');
    $wpdb->delete($table, ['id' => $id]);
    return rest_ensure_response(['success' => true]);
}

// ---------------------------------------------------------------------------
// Personen (adjunct-meteorologen) — genormaliseerde child-tabel
// ---------------------------------------------------------------------------

function nmc_sync_personen($logboek_id, $personen) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek_personen';

    $wpdb->delete($table, ['logboek_id' => $logboek_id]);

    if (empty($personen) || !is_array($personen)) return;

    foreach ($personen as $p) {
        if (empty($p['naam'])) continue;
        $wpdb->insert($table, [
            'logboek_id'   => $logboek_id,
            'naam'         => $p['naam'],
            'werktijd_van' => $p['werktijd_van'] ?? '',
            'werktijd_tot' => $p['werktijd_tot'] ?? '',
            'synop_totaal' => count($p['synop_gedaan'] ?? []),
            'metar_totaal' => count($p['metar_gedaan'] ?? []),
            'klima_totaal' => count($p['klima_gedaan'] ?? []),
            'taf_totaal'   => count($p['taf_gedaan'] ?? []),
        ]);
    }
}

function nmc_get_personen(WP_REST_Request $req) {
    global $wpdb;
    $table    = $wpdb->prefix . 'nmc_logboek_personen';
    $logTable = $wpdb->prefix . 'nmc_logboek';
    $where    = ['l.deleted_at IS NULL'];
    $params   = [];

    if ($req->get_param('naam'))  { $where[] = 'p.naam = %s';      $params[] = $req->get_param('naam'); }
    if ($req->get_param('van'))   { $where[] = 'l.datum >= %s';    $params[] = $req->get_param('van'); }
    if ($req->get_param('tot'))   { $where[] = 'l.datum <= %s';    $params[] = $req->get_param('tot'); }
    if ($req->get_param('maand')) { $where[] = 'l.datum LIKE %s';  $params[] = $req->get_param('maand') . '-%'; }

    $sql = "SELECT p.*, l.datum, l.shift, l.uuid AS logboek_uuid
            FROM $table p
            JOIN $logTable l ON l.id = p.logboek_id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY l.datum DESC";
    if (!empty($params)) {
        $sql = $wpdb->prepare($sql, $params);
    }
    return rest_ensure_response($wpdb->get_results($sql, ARRAY_A));
}

// ---------------------------------------------------------------------------
// Logboek entries
// ---------------------------------------------------------------------------

function nmc_get_logboek(WP_REST_Request $req) {
    global $wpdb;
    $table  = $wpdb->prefix . 'nmc_logboek';
    $where  = ['deleted_at IS NULL'];
    $params = [];

    if ($req->get_param('datum'))  { $where[] = 'datum = %s';         $params[] = $req->get_param('datum'); }
    if ($req->get_param('maand'))  { $where[] = 'datum LIKE %s';       $params[] = $req->get_param('maand') . '-%'; }
    if ($req->get_param('van'))    { $where[] = 'datum >= %s';         $params[] = $req->get_param('van'); }
    if ($req->get_param('tot'))    { $where[] = 'datum <= %s';         $params[] = $req->get_param('tot'); }

    // Forecasters/observers mogen via "Vorige Records" uitsluitend entries van
    // hun eigen sectie terugroepen. Het type wordt dan door de server bepaald
    // en een meegestuurd type-filter wordt genegeerd, zodat een forecaster ook
    // met een aangepaste query nooit observer-entries kan opvragen (en omgekeerd).
    $user = nmc_current_user($req);
    $type = $req->get_param('type');
    if ($user && in_array($user['role'], ['forecaster', 'observer'], true)) {
        $type = $user['role'];
    }
    if ($type) { $where[] = 'type = %s'; $params[] = $type; }

    $sql = "SELECT * FROM $table WHERE " . implode(' AND ', $where) . " ORDER BY datum DESC, ts_created DESC";
    if (!empty($params)) {
        $sql = $wpdb->prepare($sql, $params);
    }
    $rows = $wpdb->get_results($sql, ARRAY_A);

    foreach ($rows as &$row) {
        $row['data_json'] = json_decode($row['data_json'], true);
    }
    return rest_ensure_response($rows);
}

function nmc_post_logboek(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek';
    $body  = $req->get_json_params();

    if (empty($body['datum']) || empty($body['shift']) || empty($body['type'])) {
        return new WP_Error('missing_fields', 'datum, shift en type zijn verplicht', ['status' => 400]);
    }

    $user = nmc_current_user($req);
    if (!nmc_role_can_use_type($user['role'], $body['type'])) {
        return new WP_Error('forbidden', 'U mag alleen uw eigen sectie invullen.', ['status' => 403]);
    }

    $meteoroloog = $body['type'] === 'forecaster'
        ? ($body['meteoroloog'] ?? '')
        : ($body['personen'][0]['naam'] ?? ($body['administratie'][0] ?? ''));

    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table WHERE datum=%s AND shift=%s AND type=%s AND meteoroloog=%s AND deleted_at IS NULL",
        $body['datum'], $body['shift'], $body['type'], $meteoroloog
    ));

    if ($existing) {
        return new WP_Error('duplicate', 'Er bestaat al een logboek voor deze datum/shift/persoon', ['status' => 409]);
    }

    $result = $wpdb->insert($table, [
        'uuid'          => $body['id'] ?? wp_generate_uuid4(),
        'type'          => $body['type'],
        'datum'         => $body['datum'],
        'shift'         => $body['shift'],
        'ingevuld_door' => $body['ingevuld_door'] ?? '',
        'meteoroloog'   => $meteoroloog,
        'data_json'     => json_encode($body),
    ]);

    if ($result === false) {
        return new WP_Error('db_error', $wpdb->last_error, ['status' => 500]);
    }

    if ($body['type'] === 'observer') {
        nmc_sync_personen($wpdb->insert_id, $body['personen'] ?? []);
    }

    return rest_ensure_response(['success' => true, 'id' => $wpdb->insert_id]);
}

function nmc_put_logboek(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek';
    $uuid  = $req->get_param('uuid');
    $body  = $req->get_json_params();

    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE uuid=%s AND deleted_at IS NULL", $uuid), ARRAY_A);
    if (!$row) return new WP_Error('not_found', 'Entry niet gevonden', ['status' => 404]);

    // De kolommen datum/shift/meteoroloog moeten meelopen met de inhoud. Bleven
    // ze achter, dan stond een record na een datumcorrectie nog onder de oude
    // datum in het overzicht én hield het die datum bezet, waardoor een nieuwe
    // invoer voor die dag als duplicaat werd geweigerd.
    $meteoroloog = $body['type'] === 'forecaster'
        ? ($body['personen'][0]['naam'] ?? ($body['meteoroloog'] ?? $row['meteoroloog']))
        : ($body['personen'][0]['naam'] ?? ($body['administratie'][0] ?? $row['meteoroloog']));

    // De datum van de aantekening komt van de server, niet van de computer van
    // de chef — anders bepaalt een verkeerd gezette pc-klok wat er in het
    // logboek staat.
    if (!empty($body['chef_edits'])) {
        $body['chef_edit_datum'] = current_time('Y-m-d');
    }

    $result = $wpdb->update(
        $table,
        [
            'datum'       => $body['datum'] ?? $row['datum'],
            'shift'       => $body['shift'] ?? $row['shift'],
            'meteoroloog' => $meteoroloog,
            'data_json'   => json_encode($body),
            'ts_updated'  => current_time('mysql'),
        ],
        ['uuid' => $uuid, 'deleted_at' => null]
    );

    if ($result === false) return new WP_Error('db_error', $wpdb->last_error, ['status' => 500]);

    if (($body['type'] ?? '') === 'observer') {
        $logboek_id = $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE uuid=%s", $uuid));
        if ($logboek_id) {
            nmc_sync_personen($logboek_id, $body['personen'] ?? []);
        }
    }

    return rest_ensure_response(['success' => true]);
}

function nmc_delete_logboek(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek';
    $uuid  = $req->get_param('uuid');

    $result = $wpdb->update(
        $table,
        ['deleted_at' => current_time('mysql')],
        ['uuid' => $uuid]
    );

    if ($result === false) return new WP_Error('db_error', $wpdb->last_error, ['status' => 500]);
    return rest_ensure_response(['success' => true]);
}

function nmc_check_duplicate(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek';

    $user = nmc_current_user($req);
    if (!nmc_role_can_use_type($user['role'], $req->get_param('type'))) {
        return new WP_Error('forbidden', 'U mag alleen uw eigen sectie invullen.', ['status' => 403]);
    }

    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table WHERE datum=%s AND shift=%s AND type=%s AND meteoroloog=%s AND deleted_at IS NULL",
        $req->get_param('datum'),
        $req->get_param('shift'),
        $req->get_param('type'),
        $req->get_param('meteoroloog')
    ));

    return rest_ensure_response(['exists' => (bool) $existing]);
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        $origin = get_http_origin();
        if ($origin) {
            header('Access-Control-Allow-Origin: ' . esc_url_raw($origin));
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Authorization, Content-Type');
        }
        return $value;
    });
}, 15);
