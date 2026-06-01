<?php
/**
 * P1876_DB — Database installation and table helpers.
 *
 * Called on plugin activation via register_activation_hook().
 * Uses dbDelta() so it is safe to re-run (adds missing columns,
 * creates missing tables, never drops or truncates).
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class P1876_DB {

    const DB_VERSION        = '1.2.0';
    const DB_VERSION_OPTION = '1876_db_version';

    // ── Install (runs on plugin activation) ─────────────────────────────────
    public static function install() {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $c   = $wpdb->get_charset_collate();
        $pfx = $wpdb->prefix . '1876_';

        // ── jobs ──────────────────────────────────────────────────────────────
        dbDelta( "CREATE TABLE {$pfx}jobs (
            id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
            wf_id          VARCHAR(50)      NOT NULL DEFAULT '',
            name           VARCHAR(255)     NOT NULL DEFAULT 'Untitled',
            job_type       VARCHAR(100)     NOT NULL DEFAULT '',
            lob            VARCHAR(50)      NOT NULL DEFAULT '',
            phase          VARCHAR(100)     NOT NULL DEFAULT 'Discovery',
            cp             VARCHAR(150)     NOT NULL DEFAULT '',
            producer       VARCHAR(150)     NOT NULL DEFAULT '',
            marketer       VARCHAR(150)     NOT NULL DEFAULT '',
            media_partner  VARCHAR(150)     NOT NULL DEFAULT '',
            project_task   VARCHAR(150)     NOT NULL DEFAULT '',
            risk           VARCHAR(50)      NOT NULL DEFAULT 'On Track',
            priority       TINYINT UNSIGNED NOT NULL DEFAULT 1,
            loe            DECIMAL(5,2)     NOT NULL DEFAULT 1.00,
            start_date     DATE                      DEFAULT NULL,
            cd_date        DATE                      DEFAULT NULL,
            live_date      DATE                      DEFAULT NULL,
            go_live_date   DATE                      DEFAULT NULL,
            project_pct    DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
            cp_pct         DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
            producer_pct   DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
            has_fxf        TINYINT(1)       NOT NULL DEFAULT 0,
            status_notes   TEXT,
            risk_notes     TEXT,
            notes          TEXT,
            created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by     VARCHAR(150)     NOT NULL DEFAULT '',
            updated_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by     VARCHAR(150)     NOT NULL DEFAULT '',
            PRIMARY KEY  (id),
            KEY idx_lob   (lob),
            KEY idx_phase (phase),
            KEY idx_wf_id (wf_id(20))
        ) $c;" );

        // ── job_assets ────────────────────────────────────────────────────────
        dbDelta( "CREATE TABLE {$pfx}job_assets (
            id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            job_id                 BIGINT UNSIGNED NOT NULL,
            fxf_assets             SMALLINT        NOT NULL DEFAULT 0,
            social_assets          SMALLINT        NOT NULL DEFAULT 0,
            social_static_assets   SMALLINT        NOT NULL DEFAULT 0,
            display_assets         SMALLINT        NOT NULL DEFAULT 0,
            static_assets          SMALLINT        NOT NULL DEFAULT 0,
            cd_only_assets         SMALLINT        NOT NULL DEFAULT 0,
            total_assets           SMALLINT        NOT NULL DEFAULT 0,
            dev_min_social         SMALLINT        NOT NULL DEFAULT 10,
            dev_min_social_static  SMALLINT        NOT NULL DEFAULT 10,
            dev_min_display        SMALLINT        NOT NULL DEFAULT 10,
            dev_min_static         SMALLINT        NOT NULL DEFAULT 10,
            review_minutes         SMALLINT        NOT NULL DEFAULT 5,
            qa_minutes             SMALLINT        NOT NULL DEFAULT 5,
            fxf_minutes            SMALLINT        NOT NULL DEFAULT 10,
            cd_minutes             SMALLINT        NOT NULL DEFAULT 10,
            cd_delivery_minutes    SMALLINT        NOT NULL DEFAULT 5,
            est_rounds             TINYINT         NOT NULL DEFAULT 1,
            cd_placements          SMALLINT        NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_job_id (job_id)
        ) $c;" );

        // ── job_assignments ───────────────────────────────────────────────────
        dbDelta( "CREATE TABLE {$pfx}job_assignments (
            id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            job_id                  BIGINT UNSIGNED NOT NULL,
            assignee_ad             VARCHAR(150)    NOT NULL DEFAULT '',
            assignee_social         VARCHAR(150)    NOT NULL DEFAULT '',
            assignee_social_static  VARCHAR(150)    NOT NULL DEFAULT '',
            assignee_display        VARCHAR(150)    NOT NULL DEFAULT '',
            assignee_static         VARCHAR(150)    NOT NULL DEFAULT '',
            assignee_review         VARCHAR(150)    NOT NULL DEFAULT '',
            assignee_qa             VARCHAR(150)    NOT NULL DEFAULT '',
            assignee_cd             VARCHAR(150)    NOT NULL DEFAULT '',
            assignee_content        VARCHAR(150)    NOT NULL DEFAULT '',
            vacation_track          VARCHAR(50)     NOT NULL DEFAULT 'all',
            vacation_person         VARCHAR(150)    NOT NULL DEFAULT '',
            PRIMARY KEY (id),
            KEY idx_job_id (job_id)
        ) $c;" );

        // ── order_entries ─────────────────────────────────────────────────────
        dbDelta( "CREATE TABLE {$pfx}order_entries (
            id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            job_id             BIGINT UNSIGNED          DEFAULT NULL,
            file_prefix        VARCHAR(200)    NOT NULL DEFAULT '',
            language           VARCHAR(20)     NOT NULL DEFAULT '',
            creative_options   TINYINT         NOT NULL DEFAULT 1,
            cnt_social         SMALLINT        NOT NULL DEFAULT 0,
            cnt_social_static  SMALLINT        NOT NULL DEFAULT 0,
            cnt_display        SMALLINT        NOT NULL DEFAULT 0,
            cnt_static         SMALLINT        NOT NULL DEFAULT 0,
            cnt_cd_only        SMALLINT        NOT NULL DEFAULT 0,
            cnt_cd_placements  SMALLINT        NOT NULL DEFAULT 0,
            cnt_total          SMALLINT        NOT NULL DEFAULT 0,
            res_cp             VARCHAR(150)    NOT NULL DEFAULT '',
            res_producer       VARCHAR(150)    NOT NULL DEFAULT '',
            res_ad             VARCHAR(150)    NOT NULL DEFAULT '',
            res_social         VARCHAR(150)    NOT NULL DEFAULT '',
            res_social_static  VARCHAR(150)    NOT NULL DEFAULT '',
            res_display        VARCHAR(150)    NOT NULL DEFAULT '',
            res_static         VARCHAR(150)    NOT NULL DEFAULT '',
            res_proofing       VARCHAR(150)    NOT NULL DEFAULT '',
            res_qa             VARCHAR(150)    NOT NULL DEFAULT '',
            res_cd             VARCHAR(150)    NOT NULL DEFAULT '',
            f1_eyebrow         VARCHAR(255)    NOT NULL DEFAULT '',
            ec_eyebrow         VARCHAR(255)    NOT NULL DEFAULT '',
            f1_headline        VARCHAR(255)    NOT NULL DEFAULT '',
            ec_headline        VARCHAR(255)    NOT NULL DEFAULT '',
            f1_offer           VARCHAR(255)    NOT NULL DEFAULT '',
            ec_offer           VARCHAR(255)    NOT NULL DEFAULT '',
            f1_subhead         VARCHAR(255)    NOT NULL DEFAULT '',
            ec_subhead         VARCHAR(255)    NOT NULL DEFAULT '',
            status             VARCHAR(20)     NOT NULL DEFAULT 'draft',
            created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by         BIGINT UNSIGNED          DEFAULT NULL,
            updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_job_id (job_id),
            KEY idx_status (status)
        ) $c;" );

        // ── order_entry_creatives ─────────────────────────────────────────────
        dbDelta( "CREATE TABLE {$pfx}order_entry_creatives (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_entry_id  BIGINT UNSIGNED NOT NULL,
            version         VARCHAR(100)    NOT NULL DEFAULT '',
            language        VARCHAR(50)     NOT NULL DEFAULT '',
            audience_funnel VARCHAR(100)    NOT NULL DEFAULT '',
            sort_order      TINYINT         NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_order_entry_id (order_entry_id)
        ) $c;" );

        // ── order_entry_deliverables ──────────────────────────────────────────
        dbDelta( "CREATE TABLE {$pfx}order_entry_deliverables (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_entry_id  BIGINT UNSIGNED NOT NULL,
            creative_id     BIGINT UNSIGNED          DEFAULT NULL,
            asset_type      VARCHAR(100)    NOT NULL DEFAULT '',
            platform        VARCHAR(100)    NOT NULL DEFAULT '',
            size            VARCHAR(100)    NOT NULL DEFAULT '',
            module          VARCHAR(100)    NOT NULL DEFAULT '',
            runtime         VARCHAR(50)     NOT NULL DEFAULT '',
            version         VARCHAR(100)    NOT NULL DEFAULT '',
            language        VARCHAR(50)     NOT NULL DEFAULT '',
            audience        VARCHAR(100)    NOT NULL DEFAULT '',
            assigned        VARCHAR(150)    NOT NULL DEFAULT '',
            file_name       VARCHAR(500)    NOT NULL DEFAULT '',
            PRIMARY KEY (id),
            KEY idx_order_entry_id (order_entry_id)
        ) $c;" );

        // ── users — team roster with roles and function assignments ──────────────
        dbDelta( "CREATE TABLE {$pfx}users (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name       VARCHAR(150)    NOT NULL DEFAULT '',
            role       VARCHAR(50)     NOT NULL DEFAULT 'view',
            lobs       TEXT,
            functions  TEXT,
            PRIMARY KEY (id),
            UNIQUE KEY idx_name (name(100))
        ) $c;" );

        // ── settings ──────────────────────────────────────────────────────────
        dbDelta( "CREATE TABLE {$pfx}settings (
            id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id        BIGINT UNSIGNED          DEFAULT NULL,
            setting_key    VARCHAR(100)    NOT NULL DEFAULT '',
            setting_value  TEXT,
            updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY idx_user_key (user_id, setting_key)
        ) $c;" );

        update_option( self::DB_VERSION_OPTION, self::DB_VERSION );
    }

    // ── Deactivation — keep data, nothing to do ───────────────────────────────
    public static function deactivate() {}

    // ── Helper: fully-qualified table name ────────────────────────────────────
    public static function table( string $name ): string {
        global $wpdb;
        return $wpdb->prefix . '1876_' . $name;
    }
}
