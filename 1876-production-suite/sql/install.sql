-- ============================================================
-- 1876 Production Suite — Database Install Script
-- For use with: Local by Flywheel / WP Engine (MariaDB/MySQL)
--
-- IMPORTANT: Replace "wp_" below with your actual WordPress
-- table prefix if it differs (check wp-config.php).
--
-- Run this in: phpMyAdmin → SQL tab, or via MySQL CLI.
-- The plugin's activation hook runs this automatically via
-- dbDelta(), but this file is useful for manual inspection,
-- staging setup, or rollbacks.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── jobs ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `wp_1876_jobs` (
    `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `wf_id`         VARCHAR(50)      NOT NULL DEFAULT '',
    `name`          VARCHAR(255)     NOT NULL DEFAULT 'Untitled',
    `job_type`      VARCHAR(100)     NOT NULL DEFAULT '',
    `lob`           VARCHAR(50)      NOT NULL DEFAULT '',
    `phase`         VARCHAR(100)     NOT NULL DEFAULT 'Discovery',
    `cp`            VARCHAR(150)     NOT NULL DEFAULT '',
    `producer`      VARCHAR(150)     NOT NULL DEFAULT '',
    `marketer`      VARCHAR(150)     NOT NULL DEFAULT '',
    `media_partner` VARCHAR(150)     NOT NULL DEFAULT '',
    `project_task`  VARCHAR(150)     NOT NULL DEFAULT '',
    `risk`          VARCHAR(50)      NOT NULL DEFAULT 'On Track',
    `priority`      TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `loe`           DECIMAL(5,2)     NOT NULL DEFAULT 1.00,
    `start_date`    DATE                      DEFAULT NULL,
    `cd_date`       DATE                      DEFAULT NULL,
    `live_date`     DATE                      DEFAULT NULL,
    `go_live_date`  DATE                      DEFAULT NULL,
    `project_pct`   DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
    `cp_pct`        DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
    `producer_pct`  DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
    `has_fxf`       TINYINT(1)       NOT NULL DEFAULT 0,
    `status_notes`  TEXT,
    `risk_notes`    TEXT,
    `notes`         TEXT,
    `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by`    VARCHAR(150)     NOT NULL DEFAULT '',
    `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
    `updated_by`    VARCHAR(150)     NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    KEY `idx_lob`   (`lob`),
    KEY `idx_phase` (`phase`),
    KEY `idx_wf_id` (`wf_id`(20))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── job_assets ────────────────────────────────────────────────────────────────
-- Asset counts and per-asset time estimates, one row per job.
CREATE TABLE IF NOT EXISTS `wp_1876_job_assets` (
    `id`                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id`                 BIGINT UNSIGNED NOT NULL,
    `fxf_assets`             SMALLINT        NOT NULL DEFAULT 0,
    `social_assets`          SMALLINT        NOT NULL DEFAULT 0,
    `social_static_assets`   SMALLINT        NOT NULL DEFAULT 0,
    `display_assets`         SMALLINT        NOT NULL DEFAULT 0,
    `static_assets`          SMALLINT        NOT NULL DEFAULT 0,
    `cd_only_assets`         SMALLINT        NOT NULL DEFAULT 0,
    `total_assets`           SMALLINT        NOT NULL DEFAULT 0,
    `dev_min_social`         SMALLINT        NOT NULL DEFAULT 10,
    `dev_min_social_static`  SMALLINT        NOT NULL DEFAULT 10,
    `dev_min_display`        SMALLINT        NOT NULL DEFAULT 10,
    `dev_min_static`         SMALLINT        NOT NULL DEFAULT 10,
    `review_minutes`         SMALLINT        NOT NULL DEFAULT 5,
    `qa_minutes`             SMALLINT        NOT NULL DEFAULT 5,
    `fxf_minutes`            SMALLINT        NOT NULL DEFAULT 10,
    `cd_minutes`             SMALLINT        NOT NULL DEFAULT 10,
    `cd_delivery_minutes`    SMALLINT        NOT NULL DEFAULT 5,
    `est_rounds`             TINYINT         NOT NULL DEFAULT 1,
    `cd_placements`          SMALLINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_job_id` (`job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── job_assignments ───────────────────────────────────────────────────────────
-- Resource (assignee) names per job, one row per job.
CREATE TABLE IF NOT EXISTS `wp_1876_job_assignments` (
    `id`                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id`                  BIGINT UNSIGNED NOT NULL,
    `assignee_ad`             VARCHAR(150)    NOT NULL DEFAULT '',
    `assignee_social`         VARCHAR(150)    NOT NULL DEFAULT '',
    `assignee_social_static`  VARCHAR(150)    NOT NULL DEFAULT '',
    `assignee_display`        VARCHAR(150)    NOT NULL DEFAULT '',
    `assignee_static`         VARCHAR(150)    NOT NULL DEFAULT '',
    `assignee_review`         VARCHAR(150)    NOT NULL DEFAULT '',
    `assignee_qa`             VARCHAR(150)    NOT NULL DEFAULT '',
    `assignee_cd`             VARCHAR(150)    NOT NULL DEFAULT '',
    `assignee_content`        VARCHAR(150)    NOT NULL DEFAULT '',
    `vacation_track`          VARCHAR(50)     NOT NULL DEFAULT 'all',
    `vacation_person`         VARCHAR(150)    NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    KEY `idx_job_id` (`job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── order_entries ─────────────────────────────────────────────────────────────
-- One Order Entry form submission per job.
CREATE TABLE IF NOT EXISTS `wp_1876_order_entries` (
    `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id`             BIGINT UNSIGNED          DEFAULT NULL,
    `file_prefix`        VARCHAR(200)    NOT NULL DEFAULT '',
    `language`           VARCHAR(20)     NOT NULL DEFAULT '',
    `creative_options`   TINYINT         NOT NULL DEFAULT 1,
    `cnt_social`         SMALLINT        NOT NULL DEFAULT 0,
    `cnt_social_static`  SMALLINT        NOT NULL DEFAULT 0,
    `cnt_display`        SMALLINT        NOT NULL DEFAULT 0,
    `cnt_static`         SMALLINT        NOT NULL DEFAULT 0,
    `cnt_cd_only`        SMALLINT        NOT NULL DEFAULT 0,
    `cnt_cd_placements`  SMALLINT        NOT NULL DEFAULT 0,
    `cnt_total`          SMALLINT        NOT NULL DEFAULT 0,
    `res_cp`             VARCHAR(150)    NOT NULL DEFAULT '',
    `res_producer`       VARCHAR(150)    NOT NULL DEFAULT '',
    `res_ad`             VARCHAR(150)    NOT NULL DEFAULT '',
    `res_social`         VARCHAR(150)    NOT NULL DEFAULT '',
    `res_social_static`  VARCHAR(150)    NOT NULL DEFAULT '',
    `res_display`        VARCHAR(150)    NOT NULL DEFAULT '',
    `res_static`         VARCHAR(150)    NOT NULL DEFAULT '',
    `res_proofing`       VARCHAR(150)    NOT NULL DEFAULT '',
    `res_qa`             VARCHAR(150)    NOT NULL DEFAULT '',
    `res_cd`             VARCHAR(150)    NOT NULL DEFAULT '',
    -- Variable fields (template copy)
    `f1_eyebrow`         VARCHAR(255)    NOT NULL DEFAULT '',
    `ec_eyebrow`         VARCHAR(255)    NOT NULL DEFAULT '',
    `f1_headline`        VARCHAR(255)    NOT NULL DEFAULT '',
    `ec_headline`        VARCHAR(255)    NOT NULL DEFAULT '',
    `f1_offer`           VARCHAR(255)    NOT NULL DEFAULT '',
    `ec_offer`           VARCHAR(255)    NOT NULL DEFAULT '',
    `f1_subhead`         VARCHAR(255)    NOT NULL DEFAULT '',
    `ec_subhead`         VARCHAR(255)    NOT NULL DEFAULT '',
    `status`             VARCHAR(20)     NOT NULL DEFAULT 'draft',
    `created_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by`         BIGINT UNSIGNED          DEFAULT NULL,
    `updated_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_job_id` (`job_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── order_entry_creatives ─────────────────────────────────────────────────────
-- One row per creative version in an Order Entry.
CREATE TABLE IF NOT EXISTS `wp_1876_order_entry_creatives` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_entry_id`  BIGINT UNSIGNED NOT NULL,
    `version`         VARCHAR(100)    NOT NULL DEFAULT '',
    `language`        VARCHAR(50)     NOT NULL DEFAULT '',
    `audience_funnel` VARCHAR(100)    NOT NULL DEFAULT '',
    `sort_order`      TINYINT         NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_order_entry_id` (`order_entry_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── order_entry_deliverables ──────────────────────────────────────────────────
-- Individual deliverable line items (mirrors the XLSX export rows).
CREATE TABLE IF NOT EXISTS `wp_1876_order_entry_deliverables` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_entry_id`  BIGINT UNSIGNED NOT NULL,
    `creative_id`     BIGINT UNSIGNED          DEFAULT NULL,
    `asset_type`      VARCHAR(100)    NOT NULL DEFAULT '',
    `platform`        VARCHAR(100)    NOT NULL DEFAULT '',
    `size`            VARCHAR(100)    NOT NULL DEFAULT '',
    `module`          VARCHAR(100)    NOT NULL DEFAULT '',
    `runtime`         VARCHAR(50)     NOT NULL DEFAULT '',
    `version`         VARCHAR(100)    NOT NULL DEFAULT '',
    `language`        VARCHAR(50)     NOT NULL DEFAULT '',
    `audience`        VARCHAR(100)    NOT NULL DEFAULT '',
    `assigned`        VARCHAR(150)    NOT NULL DEFAULT '',
    `file_name`       VARCHAR(500)    NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    KEY `idx_order_entry_id` (`order_entry_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── settings ──────────────────────────────────────────────────────────────────
-- Key-value store for both global and per-user UI settings.
-- user_id = NULL means global / shared default.
CREATE TABLE IF NOT EXISTS `wp_1876_settings` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`        BIGINT UNSIGNED          DEFAULT NULL,
    `setting_key`    VARCHAR(100)    NOT NULL DEFAULT '',
    `setting_value`  TEXT,
    `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_user_key` (`user_id`, `setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Useful admin queries ──────────────────────────────────────────────────────
-- Check row counts after import:
--   SELECT 'jobs' AS tbl, COUNT(*) AS n FROM wp_1876_jobs
--   UNION ALL SELECT 'order_entries', COUNT(*) FROM wp_1876_order_entries;
--
-- List all active jobs by LOB:
--   SELECT lob, phase, name FROM wp_1876_jobs
--   WHERE phase IN ('Discovery','Pre-Production','In Production')
--   ORDER BY lob, start_date;
--
-- Set a user's LOB group (replace 2 with WP user ID):
--   INSERT INTO wp_usermeta (user_id, meta_key, meta_value)
--   VALUES (2, '1876_lob_group', 'FIB')
--   ON DUPLICATE KEY UPDATE meta_value = 'FIB';
