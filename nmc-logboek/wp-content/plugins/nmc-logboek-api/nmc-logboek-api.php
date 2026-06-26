<?php
/**
 * Plugin Name: NMC Logboek API
 * Description: Custom REST API endpoints voor het NMC Digitaal Logboek
 * Version: 1.0
 */

add_action('rest_api_init', function() {
    $ns = 'nmc/v1';

    // GET alle entries (met filters)
    register_rest_route($ns, '/logboek', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_logboek',
        'permission_callback' => 'nmc_auth_required',
    ]);

    // POST nieuwe entry
    register_rest_route($ns, '/logboek', [
        'methods'             => 'POST',
        'callback'            => 'nmc_post_logboek',
        'permission_callback' => 'nmc_auth_required',
    ]);

    // PUT bestaande entry bewerken
    register_rest_route($ns, '/logboek/(?P<uuid>[a-zA-Z0-9-]+)', [
        'methods'             => 'PUT',
        'callback'            => 'nmc_put_logboek',
        'permission_callback' => 'nmc_auth_required',
    ]);

    // DELETE (soft delete)
    register_rest_route($ns, '/logboek/(?P<uuid>[a-zA-Z0-9-]+)', [
        'methods'             => 'DELETE',
        'callback'            => 'nmc_delete_logboek',
        'permission_callback' => 'nmc_chef_required',  // alleen chef-rol
    ]);

    // GET check op duplicaat vóór opslaan
    register_rest_route($ns, '/logboek/check', [
        'methods'             => 'GET',
        'callback'            => 'nmc_check_duplicate',
        'permission_callback' => 'nmc_auth_required',
    ]);

    // GET huidige gebruiker (naam + rol) — gebruikt door api.js getUserRole()
    register_rest_route($ns, '/me', [
        'methods'             => 'GET',
        'callback'            => 'nmc_get_me',
        'permission_callback' => 'nmc_auth_required',
    ]);
});

function nmc_auth_required() {
    return is_user_logged_in();
}

function nmc_chef_required() {
    return current_user_can('edit_others_posts'); // Editor rol of hoger
}

function nmc_get_me() {
    $user = wp_get_current_user();
    $role = '';
    if (in_array('administrator', $user->roles, true))      $role = 'administrator';
    elseif (in_array('editor', $user->roles, true))         $role = 'editor';
    elseif (in_array('subscriber', $user->roles, true))     $role = 'subscriber';

    return rest_ensure_response([
        'naam' => $user->display_name,
        'role' => $role,
    ]);
}

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

    // Duplicaat check
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

    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table WHERE datum=%s AND shift=%s AND type=%s AND meteoroloog=%s AND deleted_at IS NULL",
        $req->get_param('datum'),
        $req->get_param('shift'),
        $req->get_param('type'),
        $req->get_param('meteoroloog')
    ));

    return rest_ensure_response(['exists' => (bool)$existing]);
}

// CORS
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
