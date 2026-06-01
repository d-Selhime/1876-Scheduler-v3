<?php
/**
 * P1876_API_Misc — Settings and current-user endpoints.
 *
 * Routes:
 *   GET  /wp-json/1876/v1/users/me          — current user info + lob_group
 *   GET  /wp-json/1876/v1/settings/<key>    — get a setting value
 *   PUT  /wp-json/1876/v1/settings/<key>    — save a setting value
 *   GET  /wp-json/1876/v1/settings          — get all settings for current user
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class P1876_API_Misc {

    public static function register_routes() {
        $ns = P1876_API_NS;

        // Current user
        register_rest_route( $ns, '/users/me', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ __CLASS__, 'get_me' ],
            'permission_callback' => [ __CLASS__, 'require_login' ],
        ] );

        // All settings for current user
        register_rest_route( $ns, '/settings', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ __CLASS__, 'get_all_settings' ],
            'permission_callback' => [ __CLASS__, 'require_login' ],
        ] );

        // Single setting by key
        register_rest_route( $ns, '/settings/(?P<key>[a-zA-Z0-9_\-]+)', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'get_setting' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [ __CLASS__, 'set_setting' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
        ] );
    }

    public static function require_login(): bool { return is_user_logged_in(); }

    // ── GET /users/me ─────────────────────────────────────────────────────────
    public static function get_me() {
        $user      = wp_get_current_user();
        $lob_group = get_user_meta( $user->ID, '1876_lob_group', true ) ?: 'ALL';

        return rest_ensure_response( [
            'id'          => $user->ID,
            'username'    => $user->user_login,
            'displayName' => $user->display_name,
            'email'       => $user->user_email,
            'lobGroup'    => $lob_group,
            'isAdmin'     => current_user_can( 'manage_options' ),
        ] );
    }

    // ── GET /settings ─────────────────────────────────────────────────────────
    public static function get_all_settings() {
        global $wpdb;
        $t      = P1876_DB::table( 'settings' );
        $uid    = get_current_user_id();

        // Return user-specific settings merged over global (NULL user_id) settings
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT setting_key, setting_value, user_id
             FROM {$t}
             WHERE user_id IS NULL OR user_id = %d
             ORDER BY user_id ASC",  // NULLs first, user rows last (override)
            $uid
        ) );

        $merged = [];
        foreach ( $rows as $r ) {
            $merged[ $r->setting_key ] = $r->setting_value;
        }

        return rest_ensure_response( $merged );
    }

    // ── GET /settings/<key> ────────────────────────────────────────────────────
    public static function get_setting( WP_REST_Request $req ) {
        global $wpdb;
        $key = sanitize_key( $req->get_param( 'key' ) );
        $uid = get_current_user_id();
        $t   = P1876_DB::table( 'settings' );

        // Prefer user-specific, fall back to global
        $val = $wpdb->get_var( $wpdb->prepare(
            "SELECT setting_value FROM {$t}
             WHERE setting_key = %s AND user_id = %d LIMIT 1",
            $key, $uid
        ) );

        if ( $val === null ) {
            $val = $wpdb->get_var( $wpdb->prepare(
                "SELECT setting_value FROM {$t}
                 WHERE setting_key = %s AND user_id IS NULL LIMIT 1",
                $key
            ) );
        }

        if ( $val === null ) {
            return new WP_Error( 'not_found', "Setting '{$key}' not found.", [ 'status' => 404 ] );
        }

        return rest_ensure_response( [ 'key' => $key, 'value' => $val ] );
    }

    // ── PUT /settings/<key> ────────────────────────────────────────────────────
    public static function set_setting( WP_REST_Request $req ) {
        global $wpdb;
        $key = sanitize_key( $req->get_param( 'key' ) );
        $uid = get_current_user_id();
        $t   = P1876_DB::table( 'settings' );

        $body = $req->get_json_params();
        // Accept scalar or any JSON value — store as string
        $val  = isset( $body['value'] )
            ? ( is_scalar( $body['value'] ) ? (string) $body['value'] : wp_json_encode( $body['value'] ) )
            : '';

        // Upsert using INSERT ... ON DUPLICATE KEY UPDATE (unique key on user_id+setting_key)
        $wpdb->query( $wpdb->prepare(
            "INSERT INTO {$t} (user_id, setting_key, setting_value)
             VALUES (%d, %s, %s)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
            $uid, $key, $val
        ) );

        return rest_ensure_response( [ 'key' => $key, 'value' => $val ] );
    }
}
