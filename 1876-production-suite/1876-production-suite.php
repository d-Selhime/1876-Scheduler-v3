<?php
/**
 * Plugin Name: 1876 Production Suite
 * Plugin URI:  https://github.com/km5782_ATT/1876_ProductionSuite
 * Description: REST API backend for the 1876 Studio Scheduler and Order Entry apps.
 * Version:     1.0.0
 * Author:      1876 Productions
 * License:     Private
 *
 * This file is the plugin bootstrap. It loads class files, registers
 * activation/deactivation hooks, and wires up the REST API.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Prevent direct access.
}

define( 'P1876_VERSION',    '1.0.0' );
define( 'P1876_DIR',        plugin_dir_path( __FILE__ ) );
define( 'P1876_URL',        plugin_dir_url( __FILE__ ) );
define( 'P1876_API_NS',     '1876/v1' );

// ── Load classes ────────────────────────────────────────────────────────────
require_once P1876_DIR . 'includes/class-1876-db.php';
require_once P1876_DIR . 'includes/class-1876-api-jobs.php';
require_once P1876_DIR . 'includes/class-1876-api-orders.php';
require_once P1876_DIR . 'includes/class-1876-api-misc.php';

// ── Activation / Deactivation ────────────────────────────────────────────────
register_activation_hook( __FILE__,   [ 'P1876_DB', 'install'    ] );
register_deactivation_hook( __FILE__, [ 'P1876_DB', 'deactivate' ] );

// ── REST API routes ───────────────────────────────────────────────────────────
add_action( 'rest_api_init', function () {
    P1876_API_Jobs::register_routes();
    P1876_API_Orders::register_routes();
    P1876_API_Misc::register_routes();
} );

// ── CORS — allow the standalone HTML app to call the API ─────────────────────
// Update the allowed origins list to match your actual domains.
add_action( 'rest_api_init', function () {
    remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
    add_filter( 'rest_pre_serve_request', function ( $served ) {
        $allowed = [
            'http://localhost',
            'http://localhost:5500',  // VS Code Live Server default
            'file://',                // Local file open in browser
        ];

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        // Allow configured origins; in production, restrict to your exact domain.
        if ( in_array( $origin, $allowed, true ) ||
             strpos( $origin, '.wpengine.com' ) !== false ) {
            header( 'Access-Control-Allow-Origin: '      . esc_url_raw( $origin ) );
            header( 'Access-Control-Allow-Credentials: true' );
            header( 'Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS' );
            header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce' );
        }

        return $served;
    } );
}, 15 );

// ── Nonce endpoint — lets the front-end fetch a fresh nonce ──────────────────
add_action( 'rest_api_init', function () {
    register_rest_route( P1876_API_NS, '/nonce', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => function () {
            if ( ! is_user_logged_in() ) {
                return new WP_Error( 'not_logged_in', 'Authentication required.', [ 'status' => 401 ] );
            }
            return rest_ensure_response( [ 'nonce' => wp_create_nonce( 'wp_rest' ) ] );
        },
        'permission_callback' => '__return_true',
    ] );
} );

// ── User meta: expose lob_group in WP user profile ───────────────────────────
add_action( 'show_user_profile',   'p1876_user_lob_field' );
add_action( 'edit_user_profile',   'p1876_user_lob_field' );
add_action( 'personal_options_update',  'p1876_save_user_lob_field' );
add_action( 'edit_user_profile_update', 'p1876_save_user_lob_field' );

function p1876_user_lob_field( $user ) {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $val = get_user_meta( $user->ID, '1876_lob_group', true );
    ?>
    <h3>1876 Production Suite</h3>
    <table class="form-table">
        <tr>
            <th><label for="1876_lob_group">LOB Group</label></th>
            <td>
                <select name="1876_lob_group" id="1876_lob_group">
                    <option value="ALL"  <?php selected( $val, 'ALL'  ); ?>>ALL (no restriction)</option>
                    <option value="FIB"  <?php selected( $val, 'FIB'  ); ?>>FIB / MOB</option>
                    <option value="MOB"  <?php selected( $val, 'MOB'  ); ?>>MOB / FIB</option>
                    <option value="BUS"  <?php selected( $val, 'BUS'  ); ?>>BUS only</option>
                </select>
                <p class="description">Controls which LOB jobs this user can create or edit.</p>
            </td>
        </tr>
    </table>
    <?php
}

function p1876_save_user_lob_field( $user_id ) {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $allowed = [ 'ALL', 'FIB', 'MOB', 'BUS' ];
    $val = sanitize_text_field( $_POST['1876_lob_group'] ?? 'ALL' );
    if ( in_array( $val, $allowed, true ) ) {
        update_user_meta( $user_id, '1876_lob_group', $val );
    }
}
