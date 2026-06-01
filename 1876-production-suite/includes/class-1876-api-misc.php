<?php
/**
 * P1876_API_Misc — Settings, users, current-user, and bulk data endpoints.
 *
 * Routes:
 *   GET  /wp-json/1876/v1/data              — full payload for app bootstrap
 *   PUT  /wp-json/1876/v1/data              — bulk save (jobs + users + settings)
 *   GET  /wp-json/1876/v1/users             — team roster
 *   PUT  /wp-json/1876/v1/users             — bulk-replace team roster
 *   GET  /wp-json/1876/v1/users/me          — current WP user info + lob_group
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

        // Full payload — app bootstrap + bulk save
        register_rest_route( $ns, '/data', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'get_data' ],
                'permission_callback' => '__return_true',
            ],
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [ __CLASS__, 'put_data' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
        ] );

        // Team roster
        register_rest_route( $ns, '/users', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'get_users' ],
                'permission_callback' => '__return_true',
            ],
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [ __CLASS__, 'put_users' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
        ] );

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

    // ── GET /data — full bootstrap payload ────────────────────────────────────
    public static function get_data() {
        global $wpdb;

        // Jobs — join assets + assignments (reuse Jobs class formatter)
        $j = P1876_DB::table( 'jobs' );
        $a = P1876_DB::table( 'job_assets' );
        $r = P1876_DB::table( 'job_assignments' );

        $rows = $wpdb->get_results(
            "SELECT j.*,
                a.fxf_assets, a.social_assets, a.social_static_assets, a.display_assets,
                a.static_assets, a.cd_only_assets, a.total_assets,
                a.dev_min_social, a.dev_min_social_static, a.dev_min_display, a.dev_min_static,
                a.review_minutes, a.qa_minutes, a.fxf_minutes, a.cd_minutes,
                a.cd_delivery_minutes, a.est_rounds, a.cd_placements,
                r.assignee_ad, r.assignee_social, r.assignee_social_static, r.assignee_display,
                r.assignee_static, r.assignee_review, r.assignee_qa, r.assignee_cd,
                r.assignee_content, r.vacation_track, r.vacation_person
             FROM {$j} j
             LEFT JOIN {$a} a ON a.job_id = j.id
             LEFT JOIN {$r} r ON r.job_id = j.id
             ORDER BY j.start_date ASC, j.id ASC"
        );

        $jobs = array_map( [ 'P1876_API_Jobs', 'format_job' ], $rows ?: [] );

        $settings = self::get_global_settings_map();

        return rest_ensure_response( [
            'jobs'               => $jobs,
            'users'              => self::get_users_array(),
            'anchorDate'         => $settings['anchorDate']         ?? '',
            'currentHorizonDays' => (int) ( $settings['currentHorizonDays'] ?? 42 ),
            'lastEditedBy'       => $settings['lastEditedBy']       ?? '',
            'lastEditedAt'       => $settings['lastEditedAt']       ?? '',
        ] );
    }

    // ── PUT /data — bulk save ─────────────────────────────────────────────────
    public static function put_data( WP_REST_Request $req ) {
        global $wpdb;

        $body = $req->get_json_params();
        if ( ! is_array( $body ) ) {
            return new WP_Error( 'invalid_data', 'Expected a JSON object.', [ 'status' => 400 ] );
        }

        if ( ! empty( $body['jobs'] ) && is_array( $body['jobs'] ) ) {
            self::bulk_replace_jobs( $body['jobs'] );
        }

        if ( isset( $body['users'] ) && is_array( $body['users'] ) ) {
            self::bulk_replace_users( $body['users'] );
        }

        $settings_to_save = [];
        foreach ( [ 'anchorDate', 'currentHorizonDays', 'lastEditedBy', 'lastEditedAt' ] as $key ) {
            if ( array_key_exists( $key, $body ) ) {
                $settings_to_save[ $key ] = (string) $body[ $key ];
            }
        }
        if ( $settings_to_save ) {
            self::save_global_settings( $settings_to_save );
        }

        return rest_ensure_response( [ 'success' => true ] );
    }

    // ── GET /users ────────────────────────────────────────────────────────────
    public static function get_users() {
        return rest_ensure_response( self::get_users_array() );
    }

    // ── PUT /users ────────────────────────────────────────────────────────────
    public static function put_users( WP_REST_Request $req ) {
        $users = $req->get_json_params();
        if ( ! is_array( $users ) ) {
            return new WP_Error( 'invalid_data', 'Expected a JSON array.', [ 'status' => 400 ] );
        }
        self::bulk_replace_users( $users );
        return rest_ensure_response( [ 'success' => true ] );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static function get_users_array(): array {
        global $wpdb;
        $t    = P1876_DB::table( 'users' );
        $rows = $wpdb->get_results( "SELECT * FROM {$t} ORDER BY name ASC", ARRAY_A );
        return array_map( function( $r ) {
            return [
                'name'      => $r['name'],
                'role'      => $r['role'],
                'lobs'      => $r['lobs']      ? json_decode( $r['lobs'],      true ) : [],
                'functions' => $r['functions'] ? json_decode( $r['functions'], true ) : [],
            ];
        }, $rows ?: [] );
    }

    private static function bulk_replace_users( array $users ): void {
        global $wpdb;
        $t = P1876_DB::table( 'users' );
        $wpdb->query( 'START TRANSACTION' );
        $wpdb->query( "DELETE FROM `{$t}`" );
        foreach ( $users as $u ) {
            $u    = (array) $u;
            $lobs = is_array( $u['lobs'] ?? null ) ? wp_json_encode( $u['lobs'] ) : '[]';
            $fns  = is_array( $u['functions'] ?? null ) ? wp_json_encode( $u['functions'] ) : '[]';
            $wpdb->replace( $t, [
                'name'      => sanitize_text_field( $u['name'] ?? '' ),
                'role'      => sanitize_text_field( $u['role'] ?? 'view' ),
                'lobs'      => $lobs,
                'functions' => $fns,
            ], [ '%s', '%s', '%s', '%s' ] );
            if ( $wpdb->last_error ) { $wpdb->query( 'ROLLBACK' ); return; }
        }
        $wpdb->query( 'COMMIT' );
    }

    private static function bulk_replace_jobs( array $jobs ): void {
        global $wpdb;
        $jt = P1876_DB::table( 'jobs' );
        $wpdb->query( 'START TRANSACTION' );
        $wpdb->query( "DELETE FROM `" . P1876_DB::table( 'job_assignments' ) . "`" );
        $wpdb->query( "DELETE FROM `" . P1876_DB::table( 'job_assets' ) . "`" );
        $wpdb->query( "DELETE FROM `{$jt}`" );

        $user = wp_get_current_user();
        $now  = current_time( 'mysql' );

        foreach ( $jobs as $raw ) {
            $sub = new WP_REST_Request( 'POST', '/1876/v1/jobs' );
            $sub->set_body_params( (array) $raw );
            $result = P1876_API_Jobs::create_job( $sub );
            if ( is_wp_error( $result ) || $wpdb->last_error ) {
                $wpdb->query( 'ROLLBACK' );
                return;
            }
        }
        $wpdb->query( 'COMMIT' );
    }

    private static function get_global_settings_map(): array {
        global $wpdb;
        $t    = P1876_DB::table( 'settings' );
        $rows = $wpdb->get_results(
            "SELECT setting_key, setting_value FROM {$t} WHERE user_id IS NULL",
            ARRAY_A
        );
        $out = [];
        foreach ( $rows ?: [] as $r ) {
            $out[ $r['setting_key'] ] = $r['setting_value'];
        }
        return $out;
    }

    private static function save_global_settings( array $data ): void {
        global $wpdb;
        $t = P1876_DB::table( 'settings' );
        foreach ( $data as $key => $value ) {
            $wpdb->query( $wpdb->prepare(
                "INSERT INTO {$t} (user_id, setting_key, setting_value)
                 VALUES (NULL, %s, %s)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
                sanitize_key( $key ), (string) $value
            ) );
        }
    }

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
