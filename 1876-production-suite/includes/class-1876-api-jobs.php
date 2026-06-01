<?php
/**
 * P1876_API_Jobs — REST endpoints for jobs.
 *
 * Routes:
 *   GET    /wp-json/1876/v1/jobs            — list all jobs (optional ?lob=&phase=)
 *   POST   /wp-json/1876/v1/jobs            — create a job
 *   GET    /wp-json/1876/v1/jobs/<id>       — get single job
 *   PUT    /wp-json/1876/v1/jobs/<id>       — update a job
 *   DELETE /wp-json/1876/v1/jobs/<id>       — delete a job (admin only)
 *   POST   /wp-json/1876/v1/jobs/import     — bulk upsert from XLSX import
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class P1876_API_Jobs {

    // ── Route registration ───────────────────────────────────────────────────
    public static function register_routes() {
        $ns = P1876_API_NS;

        register_rest_route( $ns, '/jobs', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'get_jobs' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
                'args' => [
                    'lob'   => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                    'phase' => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                ],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [ __CLASS__, 'create_job' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
        ] );

        register_rest_route( $ns, '/jobs/import', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ __CLASS__, 'import_jobs' ],
            'permission_callback' => [ __CLASS__, 'require_login' ],
        ] );

        register_rest_route( $ns, '/jobs/(?P<id>\d+)', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'get_job' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [ __CLASS__, 'update_job' ],
                'permission_callback' => [ __CLASS__, 'require_login' ],
            ],
            [
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => [ __CLASS__, 'delete_job' ],
                'permission_callback' => [ __CLASS__, 'require_admin' ],
            ],
        ] );
    }

    // ── Permission callbacks ─────────────────────────────────────────────────
    public static function require_login(): bool {
        return is_user_logged_in();
    }

    public static function require_admin(): bool {
        return current_user_can( 'manage_options' );
    }

    // ── GET /jobs ────────────────────────────────────────────────────────────
    public static function get_jobs( WP_REST_Request $req ) {
        global $wpdb;

        $j = P1876_DB::table( 'jobs' );
        $a = P1876_DB::table( 'job_assets' );
        $r = P1876_DB::table( 'job_assignments' );

        $wheres = [];
        $vals   = [];

        if ( $lob = $req->get_param( 'lob' ) ) {
            $wheres[] = 'j.lob = %s';
            $vals[]   = strtoupper( $lob );
        }
        if ( $phase = $req->get_param( 'phase' ) ) {
            $wheres[] = 'j.phase = %s';
            $vals[]   = $phase;
        }

        $where = $wheres ? 'WHERE ' . implode( ' AND ', $wheres ) : '';
        $sql   = "SELECT j.*,
                    a.fxf_assets, a.social_assets, a.social_static_assets, a.display_assets,
                    a.static_assets, a.cd_only_assets, a.total_assets,
                    a.dev_min_social, a.dev_min_social_static, a.dev_min_display, a.dev_min_static,
                    a.review_minutes, a.qa_minutes, a.fxf_minutes, a.cd_minutes,
                    a.cd_delivery_minutes, a.est_rounds, a.cd_placements,
                    r.assignee_ad, r.assignee_social, r.assignee_social_static, r.assignee_display,
                    r.assignee_static, r.assignee_review, r.assignee_qa, r.assignee_cd,
                    r.vacation_track, r.vacation_person
                  FROM {$j} j
                  LEFT JOIN {$a} a ON a.job_id = j.id
                  LEFT JOIN {$r} r ON r.job_id = j.id
                  {$where}
                  ORDER BY j.start_date ASC, j.id ASC";

        $rows = $vals
            ? $wpdb->get_results( $wpdb->prepare( $sql, $vals ) )
            : $wpdb->get_results( $sql );

        return rest_ensure_response( array_map( [ __CLASS__, 'format_job' ], $rows ) );
    }

    // ── GET /jobs/<id> ────────────────────────────────────────────────────────
    public static function get_job( WP_REST_Request $req ) {
        global $wpdb;

        $id = absint( $req->get_param( 'id' ) );
        $j  = P1876_DB::table( 'jobs' );
        $a  = P1876_DB::table( 'job_assets' );
        $r  = P1876_DB::table( 'job_assignments' );

        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT j.*,
                a.fxf_assets, a.social_assets, a.social_static_assets, a.display_assets,
                a.static_assets, a.cd_only_assets, a.total_assets,
                a.dev_min_social, a.dev_min_social_static, a.dev_min_display, a.dev_min_static,
                a.review_minutes, a.qa_minutes, a.fxf_minutes, a.cd_minutes,
                a.cd_delivery_minutes, a.est_rounds, a.cd_placements,
                r.assignee_ad, r.assignee_social, r.assignee_social_static, r.assignee_display,
                r.assignee_static, r.assignee_review, r.assignee_qa, r.assignee_cd,
                r.vacation_track, r.vacation_person
             FROM {$j} j
             LEFT JOIN {$a} a ON a.job_id = j.id
             LEFT JOIN {$r} r ON r.job_id = j.id
             WHERE j.id = %d",
            $id
        ) );

        if ( ! $row ) {
            return new WP_Error( 'not_found', 'Job not found.', [ 'status' => 404 ] );
        }

        return rest_ensure_response( self::format_job( $row ) );
    }

    // ── POST /jobs ────────────────────────────────────────────────────────────
    public static function create_job( WP_REST_Request $req ) {
        global $wpdb;

        $data = self::sanitize_input( $req );
        $err  = self::check_lob( $data['lob'] );
        if ( $err ) return $err;

        $user = wp_get_current_user();
        $now  = current_time( 'mysql' );
        $jt   = P1876_DB::table( 'jobs' );

        $ok = $wpdb->insert( $jt, self::job_row( $data, $user->display_name, $now, true ) );
        if ( false === $ok ) {
            return new WP_Error( 'db_error', 'Failed to create job.', [ 'status' => 500 ] );
        }

        $id = $wpdb->insert_id;
        self::upsert_assets( $id, $data );
        self::upsert_assignments( $id, $data );

        $get = new WP_REST_Request( 'GET', "/1876/v1/jobs/{$id}" );
        $get->set_param( 'id', $id );
        return self::get_job( $get );
    }

    // ── PUT /jobs/<id> ────────────────────────────────────────────────────────
    public static function update_job( WP_REST_Request $req ) {
        global $wpdb;

        $id   = absint( $req->get_param( 'id' ) );
        $data = self::sanitize_input( $req );
        $jt   = P1876_DB::table( 'jobs' );

        $existing = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, lob, phase FROM {$jt} WHERE id = %d", $id
        ) );
        if ( ! $existing ) {
            return new WP_Error( 'not_found', 'Job not found.', [ 'status' => 404 ] );
        }

        // Use existing LOB if not supplied in the update payload
        $lob_to_check = $data['lob'] ?: $existing->lob;
        $err = self::check_lob( $lob_to_check );
        if ( $err ) return $err;

        // Preserve phase if not included in payload (phase is set via SR detail panel)
        if ( empty( $data['phase'] ) ) {
            $data['phase'] = $existing->phase;
        }

        $user = wp_get_current_user();
        $now  = current_time( 'mysql' );
        $row  = self::job_row( $data, $user->display_name, $now, false );

        $wpdb->update( $jt, $row, [ 'id' => $id ] );
        self::upsert_assets( $id, $data );
        self::upsert_assignments( $id, $data );

        $get = new WP_REST_Request( 'GET', "/1876/v1/jobs/{$id}" );
        $get->set_param( 'id', $id );
        return self::get_job( $get );
    }

    // ── DELETE /jobs/<id> ─────────────────────────────────────────────────────
    public static function delete_job( WP_REST_Request $req ) {
        global $wpdb;

        $id = absint( $req->get_param( 'id' ) );
        $jt = P1876_DB::table( 'jobs' );

        if ( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$jt} WHERE id = %d", $id ) ) ) {
            return new WP_Error( 'not_found', 'Job not found.', [ 'status' => 404 ] );
        }

        $wpdb->delete( P1876_DB::table( 'job_assets' ),       [ 'job_id' => $id ] );
        $wpdb->delete( P1876_DB::table( 'job_assignments' ),  [ 'job_id' => $id ] );
        $wpdb->delete( $jt,                                   [ 'id'     => $id ] );

        return rest_ensure_response( [ 'deleted' => true, 'id' => $id ] );
    }

    // ── POST /jobs/import ─────────────────────────────────────────────────────
    public static function import_jobs( WP_REST_Request $req ) {
        global $wpdb;

        $body = $req->get_json_params();
        if ( empty( $body['jobs'] ) || ! is_array( $body['jobs'] ) ) {
            return new WP_Error( 'invalid_data', 'Expected { "jobs": [] }', [ 'status' => 400 ] );
        }

        $jt      = P1876_DB::table( 'jobs' );
        $created = $updated = $skipped = 0;

        foreach ( $body['jobs'] as $raw ) {
            $sub = new WP_REST_Request( 'POST', '/1876/v1/jobs' );
            $sub->set_body_params( (array) $raw );

            // Find existing by wfId, then by name+lob
            $existing_id = null;
            $wf_id = sanitize_text_field( $raw['wfId'] ?? '' );
            if ( $wf_id ) {
                $existing_id = $wpdb->get_var( $wpdb->prepare(
                    "SELECT id FROM {$jt} WHERE wf_id = %s LIMIT 1", $wf_id
                ) );
            }
            if ( ! $existing_id ) {
                $name = sanitize_text_field( $raw['name'] ?? '' );
                $lob  = sanitize_text_field( $raw['lob']  ?? '' );
                if ( $name ) {
                    $existing_id = $wpdb->get_var( $wpdb->prepare(
                        "SELECT id FROM {$jt} WHERE name = %s AND lob = %s LIMIT 1",
                        $name, strtoupper( $lob )
                    ) );
                }
            }

            if ( $existing_id ) {
                $sub->set_param( 'id', (int) $existing_id );
                $result = self::update_job( $sub );
                is_wp_error( $result ) ? $skipped++ : $updated++;
            } else {
                $result = self::create_job( $sub );
                is_wp_error( $result ) ? $skipped++ : $created++;
            }
        }

        return rest_ensure_response( [
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
        ] );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Sanitize and normalize all inbound job fields. */
    private static function sanitize_input( WP_REST_Request $req ): array {
        $p  = $req->get_params();
        $sf = 'sanitize_text_field';

        return [
            // Core
            'wfId'         => $sf( $p['wfId']        ?? $p['wf_id']        ?? '' ),
            'name'         => $sf( $p['name']                               ?? '' ),
            'jobType'      => $sf( $p['jobType']      ?? $p['job_type']     ?? '' ),
            'lob'          => strtoupper( $sf( $p['lob'] ?? '' ) ),
            'phase'        => $sf( $p['phase']                              ?? '' ),
            'cp'           => $sf( $p['cp']                                 ?? '' ),
            'producer'     => $sf( $p['producer']                           ?? '' ),
            'marketer'     => $sf( $p['marketer']                           ?? '' ),
            'mediaPartner' => $sf( $p['mediaPartner'] ?? $p['media_partner']?? '' ),
            'projectTask'  => $sf( $p['projectTask']  ?? $p['project_task'] ?? '' ),
            'risk'         => $sf( $p['risk']         ?? 'On Track' ),
            'priority'     => absint(  $p['priority']  ?? 1 ),
            'loe'          => (float)( $p['loe']       ?? 1.0 ),
            'startDate'    => self::safe_date( $p['startDate']  ?? $p['start_date']  ?? '' ),
            'cdDate'       => self::safe_date( $p['cdDate']     ?? $p['cd_date']     ?? '' ),
            'liveDate'     => self::safe_date( $p['liveDate']   ?? $p['live_date']   ?? '' ),
            'goLiveDate'   => self::safe_date( $p['goLiveDate'] ?? $p['go_live_date']?? '' ),
            'projectPct'   => (float)( $p['projectPct']  ?? $p['project_pct']  ?? 0 ),
            'cpPct'        => (float)( $p['cpPct']       ?? $p['cp_pct']       ?? 0 ),
            'producerPct'  => (float)( $p['producerPct'] ?? $p['producer_pct'] ?? 0 ),
            'statusNotes'  => sanitize_textarea_field( $p['statusNotes'] ?? $p['status_notes'] ?? '' ),
            'riskNotes'    => sanitize_textarea_field( $p['riskNotes']   ?? $p['risk_notes']   ?? '' ),
            'notes'        => sanitize_textarea_field( $p['notes']       ?? '' ),
            'hasFxf'       => ( ( $p['hasFxf'] ?? '' ) === 'YES' ) ? 'YES' : 'NO',
            // Assets
            'fxfAssets'            => absint( $p['fxfAssets']            ?? 0 ),
            'socialAssets'         => absint( $p['socialAssets']         ?? 0 ),
            'socialStaticAssets'   => absint( $p['socialStaticAssets']   ?? 0 ),
            'displayAssets'        => absint( $p['displayAssets']        ?? 0 ),
            'staticAssets'         => absint( $p['staticAssets']         ?? 0 ),
            'cdOnlyAssets'         => absint( $p['cdOnlyAssets']         ?? 0 ),
            'totalAssets'          => absint( $p['totalAssets']          ?? 0 ),
            'devMinutesSocial'     => absint( $p['devMinutesSocial']     ?? 10 ),
            'devMinutesSocialStatic' => absint( $p['devMinutesSocialStatic'] ?? 10 ),
            'devMinutesDisplay'    => absint( $p['devMinutesDisplay']    ?? 10 ),
            'devMinutesStatic'     => absint( $p['devMinutesStatic']     ?? 10 ),
            'reviewMinutes'        => absint( $p['reviewMinutes']        ?? 5 ),
            'qaMinutes'            => absint( $p['qaMinutes']            ?? 5 ),
            'fxfMinutes'           => absint( $p['fxfMinutes']           ?? 10 ),
            'cdMinutes'            => absint( $p['cdMinutes']            ?? 10 ),
            'cdDeliveryMinutes'    => absint( $p['cdDeliveryMinutes']    ?? 5 ),
            'estRounds'            => absint( $p['estRounds']            ?? 1 ),
            'cdPlacements'         => absint( $p['cdPlacements']         ?? 0 ),
            // Assignments
            'assigneeAd'           => $sf( $p['assigneeAd']           ?? '' ),
            'assigneeSocial'       => $sf( $p['assigneeSocial']       ?? '' ),
            'assigneeSocialStatic' => $sf( $p['assigneeSocialStatic'] ?? '' ),
            'assigneeDisplay'      => $sf( $p['assigneeDisplay']      ?? '' ),
            'assigneeStatic'       => $sf( $p['assigneeStatic']       ?? '' ),
            'assigneeReview'       => $sf( $p['assigneeReview']       ?? '' ),
            'assigneeQa'           => $sf( $p['assigneeQa']           ?? '' ),
            'assigneeCd'           => $sf( $p['assigneeCd']           ?? '' ),
            'assigneeContent'      => $sf( $p['assigneeContent']      ?? '' ),
            'vacationTrack'        => $sf( $p['vacationTrack']        ?? 'all' ),
            'vacationPerson'       => $sf( $p['vacationPerson']       ?? '' ),
        ];
    }

    /** Build the jobs table row array. $is_new = true adds created_at/by. */
    private static function job_row( array $d, string $by, string $now, bool $is_new ): array {
        $row = [
            'wf_id'        => $d['wfId'],
            'name'         => $d['name'] ?: 'Untitled',
            'job_type'     => $d['jobType'],
            'lob'          => $d['lob'],
            'phase'        => $d['phase'] ?: 'Discovery',
            'cp'           => $d['cp'],
            'producer'     => $d['producer'],
            'marketer'     => $d['marketer'],
            'media_partner'=> $d['mediaPartner'],
            'project_task' => $d['projectTask'],
            'risk'         => $d['risk'],
            'priority'     => $d['priority'],
            'loe'          => $d['loe'],
            'start_date'   => $d['startDate'],
            'cd_date'      => $d['cdDate'],
            'live_date'    => $d['liveDate'],
            'go_live_date' => $d['goLiveDate'],
            'project_pct'  => $d['projectPct'],
            'cp_pct'       => $d['cpPct'],
            'producer_pct' => $d['producerPct'],
            'has_fxf'      => $d['hasFxf'] === 'YES' ? 1 : 0,
            'status_notes' => $d['statusNotes'],
            'risk_notes'   => $d['riskNotes'],
            'notes'        => $d['notes'],
            'updated_at'   => $now,
            'updated_by'   => $by,
        ];
        if ( $is_new ) {
            $row['created_at'] = $now;
            $row['created_by'] = $by;
        }
        return $row;
    }

    /** Validate a date string; return Y-m-d or null. */
    private static function safe_date( $val ): ?string {
        if ( empty( $val ) ) return null;
        $d = date_create( $val );
        return $d ? date_format( $d, 'Y-m-d' ) : null;
    }

    /** Return WP_Error if current user's LOB group does not permit editing $lob. */
    private static function check_lob( string $lob ): ?WP_Error {
        $group = get_user_meta( get_current_user_id(), '1876_lob_group', true ) ?: 'ALL';
        if ( $group === 'ALL' || empty( $lob ) ) return null;

        $allowed = match ( $group ) {
            'BUS'   => [ 'BUS' ],
            'FIB'   => [ 'FIB', 'MOB' ],
            'MOB'   => [ 'FIB', 'MOB' ],
            default => [],
        };

        if ( $allowed && ! in_array( strtoupper( $lob ), $allowed, true ) ) {
            return new WP_Error(
                'lob_forbidden',
                "You do not have permission to edit {$lob} jobs.",
                [ 'status' => 403 ]
            );
        }
        return null;
    }

    /** Upsert the job_assets row for a given job. */
    private static function upsert_assets( int $job_id, array $d ): void {
        global $wpdb;
        $t = P1876_DB::table( 'job_assets' );

        $row = [
            'fxf_assets'            => $d['fxfAssets'],
            'social_assets'         => $d['socialAssets'],
            'social_static_assets'  => $d['socialStaticAssets'],
            'display_assets'        => $d['displayAssets'],
            'static_assets'         => $d['staticAssets'],
            'cd_only_assets'        => $d['cdOnlyAssets'],
            'total_assets'          => $d['totalAssets'],
            'dev_min_social'        => $d['devMinutesSocial'],
            'dev_min_social_static' => $d['devMinutesSocialStatic'],
            'dev_min_display'       => $d['devMinutesDisplay'],
            'dev_min_static'        => $d['devMinutesStatic'],
            'review_minutes'        => $d['reviewMinutes'],
            'qa_minutes'            => $d['qaMinutes'],
            'fxf_minutes'           => $d['fxfMinutes'],
            'cd_minutes'            => $d['cdMinutes'],
            'cd_delivery_minutes'   => $d['cdDeliveryMinutes'],
            'est_rounds'            => $d['estRounds'],
            'cd_placements'         => $d['cdPlacements'],
        ];

        $exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE job_id = %d", $job_id ) );
        if ( $exists ) {
            $wpdb->update( $t, $row, [ 'job_id' => $job_id ] );
        } else {
            $wpdb->insert( $t, array_merge( [ 'job_id' => $job_id ], $row ) );
        }
    }

    /** Upsert the job_assignments row for a given job. */
    private static function upsert_assignments( int $job_id, array $d ): void {
        global $wpdb;
        $t = P1876_DB::table( 'job_assignments' );

        $row = [
            'assignee_ad'            => $d['assigneeAd'],
            'assignee_social'        => $d['assigneeSocial'],
            'assignee_social_static' => $d['assigneeSocialStatic'],
            'assignee_display'       => $d['assigneeDisplay'],
            'assignee_static'        => $d['assigneeStatic'],
            'assignee_review'        => $d['assigneeReview'],
            'assignee_qa'            => $d['assigneeQa'],
            'assignee_cd'            => $d['assigneeCd'],
            'assignee_content'       => $d['assigneeContent'],
            'vacation_track'         => $d['vacationTrack'],
            'vacation_person'        => $d['vacationPerson'],
        ];

        $exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE job_id = %d", $job_id ) );
        if ( $exists ) {
            $wpdb->update( $t, $row, [ 'job_id' => $job_id ] );
        } else {
            $wpdb->insert( $t, array_merge( [ 'job_id' => $job_id ], $row ) );
        }
    }

    /** Convert a DB row to the camelCase JSON shape the front-end expects. */
    public static function format_job( object $row ): array {
        return [
            'id'           => (int)   $row->id,
            'wfId'         =>         $row->wf_id,
            'name'         =>         $row->name,
            'jobType'      =>         $row->job_type,
            'lob'          =>         $row->lob,
            'phase'        =>         $row->phase,
            'cp'           =>         $row->cp,
            'producer'     =>         $row->producer,
            'marketer'     =>         $row->marketer,
            'mediaPartner' =>         $row->media_partner,
            'projectTask'  =>         $row->project_task,
            'risk'         =>         $row->risk,
            'priority'     => (int)   $row->priority,
            'loe'          => (float) $row->loe,
            'startDate'    =>         $row->start_date,
            'cdDate'       =>         $row->cd_date,
            'liveDate'     =>         $row->live_date,
            'goLiveDate'   =>         $row->go_live_date,
            'projectPct'   => (float) $row->project_pct,
            'cpPct'        => (float) $row->cp_pct,
            'producerPct'  => (float) $row->producer_pct,
            'statusNotes'  =>         $row->status_notes,
            'riskNotes'    =>         $row->risk_notes,
            'notes'        =>         $row->notes,
            'hasFxf'       =>       ( $row->has_fxf ?? 0 ) ? 'YES' : 'NO',
            'createdAt'    =>         $row->created_at,
            'createdBy'    =>         $row->created_by,
            'updatedAt'    =>         $row->updated_at,
            'updatedBy'    =>         $row->updated_by,
            // Assets
            'fxfAssets'              => (int) ( $row->fxf_assets            ?? 0 ),
            'socialAssets'           => (int) ( $row->social_assets         ?? 0 ),
            'socialStaticAssets'     => (int) ( $row->social_static_assets  ?? 0 ),
            'displayAssets'          => (int) ( $row->display_assets        ?? 0 ),
            'staticAssets'           => (int) ( $row->static_assets         ?? 0 ),
            'cdOnlyAssets'           => (int) ( $row->cd_only_assets        ?? 0 ),
            'totalAssets'            => (int) ( $row->total_assets          ?? 0 ),
            'devMinutesSocial'       => (int) ( $row->dev_min_social        ?? 10 ),
            'devMinutesSocialStatic' => (int) ( $row->dev_min_social_static ?? 10 ),
            'devMinutesDisplay'      => (int) ( $row->dev_min_display       ?? 10 ),
            'devMinutesStatic'       => (int) ( $row->dev_min_static        ?? 10 ),
            'reviewMinutes'          => (int) ( $row->review_minutes        ?? 5 ),
            'qaMinutes'              => (int) ( $row->qa_minutes            ?? 5 ),
            'fxfMinutes'             => (int) ( $row->fxf_minutes           ?? 10 ),
            'cdMinutes'              => (int) ( $row->cd_minutes            ?? 10 ),
            'cdDeliveryMinutes'      => (int) ( $row->cd_delivery_minutes   ?? 5 ),
            'estRounds'              => (int) ( $row->est_rounds            ?? 1 ),
            'cdPlacements'           => (int) ( $row->cd_placements         ?? 0 ),
            // Assignments
            'assigneeAd'            => $row->assignee_ad            ?? '',
            'assigneeSocial'        => $row->assignee_social        ?? '',
            'assigneeSocialStatic'  => $row->assignee_social_static ?? '',
            'assigneeDisplay'       => $row->assignee_display       ?? '',
            'assigneeStatic'        => $row->assignee_static        ?? '',
            'assigneeReview'        => $row->assignee_review        ?? '',
            'assigneeQa'            => $row->assignee_qa            ?? '',
            'assigneeCd'            => $row->assignee_cd            ?? '',
            'assigneeContent'       => $row->assignee_content       ?? '',
            'vacationTrack'         => $row->vacation_track         ?? 'all',
            'vacationPerson'        => $row->vacation_person        ?? '',
        ];
    }
}
