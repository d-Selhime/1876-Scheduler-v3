<?php
/**
 * P1876_API_Orders — REST endpoints for Order Entries.
 *
 * Routes:
 *   GET    /wp-json/1876/v1/order-entries              — list (?job_id=)
 *   POST   /wp-json/1876/v1/order-entries              — create
 *   GET    /wp-json/1876/v1/order-entries/<id>         — get single
 *   PUT    /wp-json/1876/v1/order-entries/<id>         — update
 *   DELETE /wp-json/1876/v1/order-entries/<id>         — delete (admin)
 *   POST   /wp-json/1876/v1/order-entries/<id>/submit  — mark as submitted
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class P1876_API_Orders {

    public static function register_routes() {
        $ns = P1876_API_NS;

        register_rest_route( $ns, '/order-entries', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'get_entries' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
                'args' => [
                    'job_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
                    'status' => [ 'type' => 'string',  'sanitize_callback' => 'sanitize_text_field' ],
                ],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [ __CLASS__, 'create_entry' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
        ] );

        register_rest_route( $ns, '/order-entries/(?P<id>\d+)', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'get_entry' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [ __CLASS__, 'update_entry' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
            [
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => [ __CLASS__, 'delete_entry' ],
                'permission_callback' => [ __CLASS__, 'require_admin' ],
            ],
        ] );

        register_rest_route( $ns, '/order-entries/(?P<id>\d+)/submit', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ __CLASS__, 'submit_entry' ],
            'permission_callback' => [ __CLASS__, 'require_login' ],
        ] );
    }

    public static function require_login(): bool { return is_user_logged_in(); }
    public static function require_admin(): bool { return current_user_can( 'manage_options' ); }

    // ── GET /order-entries ────────────────────────────────────────────────────
    public static function get_entries( WP_REST_Request $req ) {
        global $wpdb;
        $t = P1876_DB::table( 'order_entries' );

        $wheres = [];
        $vals   = [];

        if ( $job_id = $req->get_param( 'job_id' ) ) {
            $wheres[] = 'job_id = %d';
            $vals[]   = absint( $job_id );
        }
        if ( $status = $req->get_param( 'status' ) ) {
            $wheres[] = 'status = %s';
            $vals[]   = $status;
        }

        $where = $wheres ? 'WHERE ' . implode( ' AND ', $wheres ) : '';
        $sql   = "SELECT * FROM {$t} {$where} ORDER BY updated_at DESC";
        $rows  = $vals
            ? $wpdb->get_results( $wpdb->prepare( $sql, $vals ) )
            : $wpdb->get_results( $sql );

        return rest_ensure_response( array_map( [ __CLASS__, 'format_entry' ], $rows ) );
    }

    // ── GET /order-entries/<id> ────────────────────────────────────────────────
    public static function get_entry( WP_REST_Request $req ) {
        global $wpdb;
        $id = absint( $req->get_param( 'id' ) );
        $t  = P1876_DB::table( 'order_entries' );

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ) );
        if ( ! $row ) {
            return new WP_Error( 'not_found', 'Order entry not found.', [ 'status' => 404 ] );
        }

        $entry = self::format_entry( $row );
        $entry['creatives']    = self::get_creatives( $id );
        $entry['deliverables'] = self::get_deliverables( $id );

        return rest_ensure_response( $entry );
    }

    // ── POST /order-entries ───────────────────────────────────────────────────
    public static function create_entry( WP_REST_Request $req ) {
        global $wpdb;

        $data = self::sanitize_input( $req );
        $user = wp_get_current_user();
        $t    = P1876_DB::table( 'order_entries' );

        $ok = $wpdb->insert( $t, array_merge( $data['entry'], [
            'created_by' => $user->ID,
        ] ) );

        if ( false === $ok ) {
            return new WP_Error( 'db_error', 'Failed to create order entry.', [ 'status' => 500 ] );
        }

        $entry_id = $wpdb->insert_id;
        self::save_creatives( $entry_id, $data['creatives'] );
        self::save_deliverables( $entry_id, $data['deliverables'] );

        $get = new WP_REST_Request( 'GET', "/1876/v1/order-entries/{$entry_id}" );
        $get->set_param( 'id', $entry_id );
        return self::get_entry( $get );
    }

    // ── PUT /order-entries/<id> ────────────────────────────────────────────────
    public static function update_entry( WP_REST_Request $req ) {
        global $wpdb;

        $id   = absint( $req->get_param( 'id' ) );
        $data = self::sanitize_input( $req );
        $t    = P1876_DB::table( 'order_entries' );

        if ( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE id = %d", $id ) ) ) {
            return new WP_Error( 'not_found', 'Order entry not found.', [ 'status' => 404 ] );
        }

        $wpdb->update( $t, $data['entry'], [ 'id' => $id ] );
        self::save_creatives( $id, $data['creatives'] );
        self::save_deliverables( $id, $data['deliverables'] );

        $get = new WP_REST_Request( 'GET', "/1876/v1/order-entries/{$id}" );
        $get->set_param( 'id', $id );
        return self::get_entry( $get );
    }

    // ── DELETE /order-entries/<id> ─────────────────────────────────────────────
    public static function delete_entry( WP_REST_Request $req ) {
        global $wpdb;

        $id = absint( $req->get_param( 'id' ) );
        $t  = P1876_DB::table( 'order_entries' );

        if ( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE id = %d", $id ) ) ) {
            return new WP_Error( 'not_found', 'Order entry not found.', [ 'status' => 404 ] );
        }

        $wpdb->delete( P1876_DB::table( 'order_entry_deliverables' ), [ 'order_entry_id' => $id ] );
        $wpdb->delete( P1876_DB::table( 'order_entry_creatives' ),    [ 'order_entry_id' => $id ] );
        $wpdb->delete( $t, [ 'id' => $id ] );

        return rest_ensure_response( [ 'deleted' => true, 'id' => $id ] );
    }

    // ── POST /order-entries/<id>/submit ────────────────────────────────────────
    public static function submit_entry( WP_REST_Request $req ) {
        global $wpdb;

        $id = absint( $req->get_param( 'id' ) );
        $t  = P1876_DB::table( 'order_entries' );

        if ( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE id = %d", $id ) ) ) {
            return new WP_Error( 'not_found', 'Order entry not found.', [ 'status' => 404 ] );
        }

        $wpdb->update( $t, [ 'status' => 'submitted' ], [ 'id' => $id ] );

        $get = new WP_REST_Request( 'GET', "/1876/v1/order-entries/{$id}" );
        $get->set_param( 'id', $id );
        return self::get_entry( $get );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static function sanitize_input( WP_REST_Request $req ): array {
        $p  = $req->get_params();
        $sf = 'sanitize_text_field';

        $entry = [
            'job_id'            => $p['jobId']  ? absint( $p['jobId'] )  : null,
            'file_prefix'       => $sf( $p['filePrefix']      ?? '' ),
            'language'          => $sf( $p['language']        ?? '' ),
            'creative_options'  => absint( $p['creativeOptions'] ?? 1 ),
            'cnt_social'        => absint( $p['cntSocial']       ?? 0 ),
            'cnt_social_static' => absint( $p['cntSocialStatic'] ?? 0 ),
            'cnt_display'       => absint( $p['cntDisplay']      ?? 0 ),
            'cnt_static'        => absint( $p['cntStatic']       ?? 0 ),
            'cnt_cd_only'       => absint( $p['cntCdOnly']       ?? 0 ),
            'cnt_cd_placements' => absint( $p['cntCdPlacements'] ?? 0 ),
            'cnt_total'         => absint( $p['cntTotal']        ?? 0 ),
            'res_cp'            => $sf( $p['resCP']          ?? '' ),
            'res_producer'      => $sf( $p['resProducer']    ?? '' ),
            'res_ad'            => $sf( $p['resAD']          ?? '' ),
            'res_social'        => $sf( $p['resSocial']      ?? '' ),
            'res_social_static' => $sf( $p['resSocialStatic']?? '' ),
            'res_display'       => $sf( $p['resDisplay']     ?? '' ),
            'res_static'        => $sf( $p['resStatic']      ?? '' ),
            'res_proofing'      => $sf( $p['resProofing']    ?? '' ),
            'res_qa'            => $sf( $p['resQA']          ?? '' ),
            'res_cd'            => $sf( $p['resCD']          ?? '' ),
            'f1_eyebrow'        => $sf( $p['f1Eyebrow']      ?? '' ),
            'ec_eyebrow'        => $sf( $p['ecEyebrow']      ?? '' ),
            'f1_headline'       => $sf( $p['f1Headline']     ?? '' ),
            'ec_headline'       => $sf( $p['ecHeadline']     ?? '' ),
            'f1_offer'          => $sf( $p['f1Offer']        ?? '' ),
            'ec_offer'          => $sf( $p['ecOffer']        ?? '' ),
            'f1_subhead'        => $sf( $p['f1Subhead']      ?? '' ),
            'ec_subhead'        => $sf( $p['ecSubhead']      ?? '' ),
            'status'            => in_array( $p['status'] ?? '', [ 'draft', 'submitted' ], true )
                                    ? $p['status'] : 'draft',
        ];

        // Creative rows
        $creatives = [];
        if ( ! empty( $p['creatives'] ) && is_array( $p['creatives'] ) ) {
            foreach ( $p['creatives'] as $i => $cr ) {
                $creatives[] = [
                    'version'         => $sf( $cr['version']        ?? '' ),
                    'language'        => $sf( $cr['language']       ?? '' ),
                    'audience_funnel' => $sf( $cr['audienceFunnel'] ?? '' ),
                    'sort_order'      => absint( $i ),
                ];
            }
        }

        // Deliverable rows
        $deliverables = [];
        if ( ! empty( $p['deliverables'] ) && is_array( $p['deliverables'] ) ) {
            foreach ( $p['deliverables'] as $dl ) {
                $deliverables[] = [
                    'asset_type' => $sf( $dl['assetType'] ?? '' ),
                    'platform'   => $sf( $dl['platform']  ?? '' ),
                    'size'       => $sf( $dl['size']       ?? '' ),
                    'module'     => $sf( $dl['module']     ?? '' ),
                    'runtime'    => $sf( $dl['runtime']    ?? '' ),
                    'version'    => $sf( $dl['version']    ?? '' ),
                    'language'   => $sf( $dl['language']   ?? '' ),
                    'audience'   => $sf( $dl['audience']   ?? '' ),
                    'assigned'   => $sf( $dl['assigned']   ?? '' ),
                    'file_name'  => $sf( $dl['fileName']   ?? '' ),
                ];
            }
        }

        return compact( 'entry', 'creatives', 'deliverables' );
    }

    /** Replace all creatives for an order entry. */
    private static function save_creatives( int $entry_id, array $creatives ): void {
        global $wpdb;
        $t = P1876_DB::table( 'order_entry_creatives' );
        $wpdb->delete( $t, [ 'order_entry_id' => $entry_id ] );
        foreach ( $creatives as $cr ) {
            $wpdb->insert( $t, array_merge( [ 'order_entry_id' => $entry_id ], $cr ) );
        }
    }

    /** Replace all deliverables for an order entry. */
    private static function save_deliverables( int $entry_id, array $deliverables ): void {
        global $wpdb;
        $t = P1876_DB::table( 'order_entry_deliverables' );
        $wpdb->delete( $t, [ 'order_entry_id' => $entry_id ] );
        foreach ( $deliverables as $dl ) {
            $wpdb->insert( $t, array_merge( [ 'order_entry_id' => $entry_id ], $dl ) );
        }
    }

    private static function get_creatives( int $entry_id ): array {
        global $wpdb;
        $t = P1876_DB::table( 'order_entry_creatives' );
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$t} WHERE order_entry_id = %d ORDER BY sort_order ASC", $entry_id
        ) );
        return array_map( fn( $r ) => [
            'id'            => (int) $r->id,
            'version'       => $r->version,
            'language'      => $r->language,
            'audienceFunnel'=> $r->audience_funnel,
            'sortOrder'     => (int) $r->sort_order,
        ], $rows );
    }

    private static function get_deliverables( int $entry_id ): array {
        global $wpdb;
        $t = P1876_DB::table( 'order_entry_deliverables' );
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$t} WHERE order_entry_id = %d", $entry_id
        ) );
        return array_map( fn( $r ) => [
            'id'        => (int) $r->id,
            'assetType' => $r->asset_type,
            'platform'  => $r->platform,
            'size'      => $r->size,
            'module'    => $r->module,
            'runtime'   => $r->runtime,
            'version'   => $r->version,
            'language'  => $r->language,
            'audience'  => $r->audience,
            'assigned'  => $r->assigned,
            'fileName'  => $r->file_name,
        ], $rows );
    }

    public static function format_entry( object $row ): array {
        return [
            'id'              => (int) $row->id,
            'jobId'           => $row->job_id ? (int) $row->job_id : null,
            'filePrefix'      => $row->file_prefix,
            'language'        => $row->language,
            'creativeOptions' => (int) $row->creative_options,
            'cntSocial'       => (int) $row->cnt_social,
            'cntSocialStatic' => (int) $row->cnt_social_static,
            'cntDisplay'      => (int) $row->cnt_display,
            'cntStatic'       => (int) $row->cnt_static,
            'cntCdOnly'       => (int) $row->cnt_cd_only,
            'cntCdPlacements' => (int) $row->cnt_cd_placements,
            'cntTotal'        => (int) $row->cnt_total,
            'resCP'           => $row->res_cp,
            'resProducer'     => $row->res_producer,
            'resAD'           => $row->res_ad,
            'resSocial'       => $row->res_social,
            'resSocialStatic' => $row->res_social_static,
            'resDisplay'      => $row->res_display,
            'resStatic'       => $row->res_static,
            'resProofing'     => $row->res_proofing,
            'resQA'           => $row->res_qa,
            'resCD'           => $row->res_cd,
            'f1Eyebrow'       => $row->f1_eyebrow,
            'ecEyebrow'       => $row->ec_eyebrow,
            'f1Headline'      => $row->f1_headline,
            'ecHeadline'      => $row->ec_headline,
            'f1Offer'         => $row->f1_offer,
            'ecOffer'         => $row->ec_offer,
            'f1Subhead'       => $row->f1_subhead,
            'ecSubhead'       => $row->ec_subhead,
            'status'          => $row->status,
            'createdAt'       => $row->created_at,
            'createdBy'       => (int) $row->created_by,
            'updatedAt'       => $row->updated_at,
        ];
    }
}
