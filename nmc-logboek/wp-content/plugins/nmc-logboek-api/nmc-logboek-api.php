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

function nmc_issue_token($user) {
    $payload = base64_encode(json_encode([
        'uid'  => (int) $user['id'],
        'naam' => $user['naam'],
        'role' => $user['role'],
        'exp'  => time() + 7 * DAY_IN_SECONDS,
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

function nmc_admin_required(WP_REST_Request $req) {
    $u = nmc_current_user($req);
    return $u && $u['role'] === 'admin';
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
        'permission_callback' => 'nmc_chef_required',
    ]);

    register_rest_route($ns, '/logboek', [
        'methods'             => 'POST',
        'callback'            => 'nmc_post_logboek',
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
        'permission_callback' => 'nmc_chef_required',
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
});

// ---------------------------------------------------------------------------
// Auth handlers
// ---------------------------------------------------------------------------

function nmc_login(WP_REST_Request $req) {
    global $wpdb;
    $table = $wpdb->prefix . 'nmc_logboek_users';
    $body  = $req->get_json_params();
    $username = sanitize_user($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (!$username || !$password) {
        return rest_ensure_response(['success' => false, 'error' => 'Vul gebruikersnaam en wachtwoord in.']);
    }

    $user = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE username=%s AND actief=1", $username
    ), ARRAY_A);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        return rest_ensure_response(['success' => false, 'error' => 'Onjuiste gebruikersnaam of wachtwoord.']);
    }

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
    $role     = in_array($body['role'] ?? '', ['forecaster', 'observer', 'chef', 'admin'], true) ? $body['role'] : 'forecaster';

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
    if (!empty($body['role']) && in_array($body['role'], ['forecaster', 'observer', 'chef', 'admin'], true)) {
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
    if ($req->get_param('type'))   { $where[] = 'type = %s';           $params[] = $req->get_param('type'); }

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
        : ($body['personen'][0]['naam'] ?? '');

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

    $result = $wpdb->update(
        $table,
        ['data_json' => json_encode($body), 'ts_updated' => current_time('mysql')],
        ['uuid' => $uuid, 'deleted_at' => null]
    );

    if ($result === false) return new WP_Error('db_error', $wpdb->last_error, ['status' => 500]);
    if ($result === 0)     return new WP_Error('not_found', 'Entry niet gevonden', ['status' => 404]);

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
