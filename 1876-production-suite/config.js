/**
 * config.js — 1876 Production Suite
 * ─────────────────────────────────────────────────────────────────────────────
 * Single file that switches the app between local (localStorage) and server
 * (WordPress REST API) modes.
 *
 * HOW TO USE
 * ──────────
 * 1. Add this script tag BEFORE your app scripts in each HTML file:
 *      <script src="config.js"></script>
 *
 * 2. For local dev (default): leave APP_CONFIG.mode as 'local'.
 *    For the WP Engine server: set mode to 'server' and fill in apiBase.
 *
 * 3. The rest of your app calls API.* instead of localStorage directly.
 *    The API wrapper handles both modes transparently.
 *
 * QUICK DEPLOYMENT CHECKLIST
 * ──────────────────────────
 *   - Set mode: 'server'
 *   - Set apiBase to your WP REST API root (no trailing slash)
 *   - Upload the plugin to wp-content/plugins/ and activate it
 *   - Create WP user accounts and assign lob_group via the user profile page
 */

// ── Configuration ─────────────────────────────────────────────────────────────
const APP_CONFIG = {

  // ❶ CHANGE THIS LINE WHEN DEPLOYING ─────────────────────────────────────────
  mode: 'local',   // 'local'  → uses localStorage (dev / offline)
                   // 'server' → uses REST API (WP Engine production / staging)

  // ❷ Set to your WordPress site URL when mode === 'server'
  //    Example: 'https://scheduler.1876productions.com/wp-json/1876/v1'
  apiBase: '',

  // Internal — do not edit below this line
  _nonce: null,
};

// ── API wrapper ───────────────────────────────────────────────────────────────
const API = {

  // ── Authentication ──────────────────────────────────────────────────────────

  /**
   * Log in. In server mode, calls WP's built-in /wp-login.php via the
   * /users/me endpoint after authenticating with Application Passwords.
   * In local mode returns a mock user immediately.
   *
   * @param {string} username
   * @param {string} password  — WP Application Password (xxxx-xxxx-xxxx-…)
   * @returns {Promise<object>}  user object with displayName, lobGroup, isAdmin
   */
  async login(username, password) {
    if (APP_CONFIG.mode === 'local') {
      const name = username || 'Local User';
      localStorage.setItem('schedulerUserName', name);
      return { id: 0, username: name, displayName: name, lobGroup: 'ALL', isAdmin: true };
    }

    // Encode credentials for Basic Auth
    APP_CONFIG._appAuth = btoa(`${username}:${password}`);

    // Fetch nonce via the /nonce endpoint (requires cookie auth OR app password)
    try {
      const nonceRes = await API._fetch('/nonce');
      APP_CONFIG._nonce = nonceRes.nonce;
    } catch (_) { /* nonce optional — Application Password auth works without it */ }

    return API._fetch('/users/me');
  },

  /** Return the current user. In local mode reads from localStorage. */
  async getCurrentUser() {
    if (APP_CONFIG.mode === 'local') {
      return {
        id: 0,
        displayName: localStorage.getItem('schedulerUserName') || 'Local User',
        lobGroup: 'ALL',
        isAdmin: true,
      };
    }
    return API._fetch('/users/me');
  },

  // ── Jobs ────────────────────────────────────────────────────────────────────

  /**
   * Load all jobs. Optional filters: { lob, phase }.
   * In local mode reads from studioSchedulerState_v1 localStorage key.
   */
  async getJobs(filters = {}) {
    if (APP_CONFIG.mode === 'local') {
      return API._localState().jobs || [];
    }
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString();
    return API._fetch(`/jobs${qs ? '?' + qs : ''}`);
  },

  /**
   * Save a job. Creates if no id or id starts with 'new_', updates otherwise.
   * In server mode returns the saved job with its server-assigned id.
   */
  async saveJob(job) {
    if (APP_CONFIG.mode === 'local') {
      const state = API._localState();
      const idx = state.jobs.findIndex(j => String(j.id) === String(job.id));
      if (idx !== -1) state.jobs[idx] = job;
      else state.jobs.push(job);
      API._setLocalState(state);
      return job;
    }
    if (job.id && !String(job.id).startsWith('new_')) {
      return API._fetch(`/jobs/${job.id}`, 'PUT', job);
    }
    return API._fetch('/jobs', 'POST', job);
  },

  /** Delete a job by id. */
  async deleteJob(id) {
    if (APP_CONFIG.mode === 'local') {
      const state = API._localState();
      state.jobs = state.jobs.filter(j => String(j.id) !== String(id));
      API._setLocalState(state);
      return { deleted: true };
    }
    return API._fetch(`/jobs/${id}`, 'DELETE');
  },

  /**
   * Bulk upsert jobs from an XLSX import.
   * In server mode matches by wfId or name+lob and creates/updates accordingly.
   */
  async importJobs(jobs) {
    if (APP_CONFIG.mode === 'local') {
      const state = API._localState();
      jobs.forEach(j => {
        const idx = state.jobs.findIndex(e =>
          (j.wfId && e.wfId === j.wfId) ||
          (e.name === j.name && e.lob === j.lob)
        );
        if (idx !== -1) state.jobs[idx] = { ...state.jobs[idx], ...j };
        else state.jobs.push(j);
      });
      API._setLocalState(state);
      return { created: jobs.length, updated: 0, skipped: 0 };
    }
    return API._fetch('/jobs/import', 'POST', { jobs });
  },

  // ── Order Entries ───────────────────────────────────────────────────────────

  /** Get the Order Entry for a given job id (returns null if none exists). */
  async getOrderEntry(jobId) {
    if (APP_CONFIG.mode === 'local') {
      const raw = localStorage.getItem(`1876_orderEntry_${jobId}`);
      return raw ? JSON.parse(raw) : null;
    }
    const list = await API._fetch(`/order-entries?job_id=${jobId}`);
    return Array.isArray(list) && list.length ? list[0] : null;
  },

  /** Save (create or update) an Order Entry. */
  async saveOrderEntry(entry) {
    if (APP_CONFIG.mode === 'local') {
      localStorage.setItem(`1876_orderEntry_${entry.jobId}`, JSON.stringify(entry));
      return entry;
    }
    if (entry.id) return API._fetch(`/order-entries/${entry.id}`, 'PUT', entry);
    return API._fetch('/order-entries', 'POST', entry);
  },

  /** Mark an Order Entry as submitted. */
  async submitOrderEntry(id) {
    if (APP_CONFIG.mode === 'local') {
      const raw = localStorage.getItem(`1876_orderEntry_draft`);
      if (raw) {
        const e = JSON.parse(raw);
        e.status = 'submitted';
        localStorage.setItem(`1876_orderEntry_draft`, JSON.stringify(e));
        return e;
      }
      return null;
    }
    return API._fetch(`/order-entries/${id}/submit`, 'POST');
  },

  // ── Settings ────────────────────────────────────────────────────────────────

  /** Get a single setting value; returns defaultVal if not found. */
  async getSetting(key, defaultVal = null) {
    if (APP_CONFIG.mode === 'local') {
      const v = localStorage.getItem(`1876_setting_${key}`);
      return v !== null ? JSON.parse(v) : defaultVal;
    }
    try {
      const res = await API._fetch(`/settings/${key}`);
      return res ? res.value : defaultVal;
    } catch (_) { return defaultVal; }
  },

  /** Save a setting value. */
  async setSetting(key, value) {
    if (APP_CONFIG.mode === 'local') {
      localStorage.setItem(`1876_setting_${key}`, JSON.stringify(value));
      return;
    }
    return API._fetch(`/settings/${key}`, 'PUT', { value });
  },

  /** Load all settings at once (useful on app init). */
  async getAllSettings() {
    if (APP_CONFIG.mode === 'local') {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('1876_setting_')) {
          const key = k.replace('1876_setting_', '');
          try { out[key] = JSON.parse(localStorage.getItem(k)); } catch (_) {}
        }
      }
      return out;
    }
    return API._fetch('/settings');
  },

  // ── Internal ─────────────────────────────────────────────────────────────────

  /** Core fetch wrapper — handles auth headers, errors, and auth events. */
  async _fetch(path, method = 'GET', body = null) {
    const url  = APP_CONFIG.apiBase + path;
    const hdrs = { 'Content-Type': 'application/json' };

    if (APP_CONFIG._nonce) {
      hdrs['X-WP-Nonce'] = APP_CONFIG._nonce;
    }
    if (APP_CONFIG._appAuth) {
      hdrs['Authorization'] = `Basic ${APP_CONFIG._appAuth}`;
    }

    const opts = { method, headers: hdrs, credentials: 'include' };
    if (body !== null) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (res.status === 401) {
      // Clear stored auth and fire event so the app can show the login screen
      APP_CONFIG._nonce   = null;
      APP_CONFIG._appAuth = null;
      window.dispatchEvent(new CustomEvent('1876:auth-required'));
      throw new Error('Authentication required');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error ${res.status}`);
    }

    return res.json();
  },

  /** Read the full scheduler state from localStorage. */
  _localState() {
    try {
      const raw = localStorage.getItem('studioSchedulerState_v1');
      return raw ? JSON.parse(raw) : { jobs: [], users: [] };
    } catch (_) {
      return { jobs: [], users: [] };
    }
  },

  /** Write the full scheduler state back to localStorage. */
  _setLocalState(state) {
    state.lastEditedAt = new Date().toISOString();
    localStorage.setItem('studioSchedulerState_v1', JSON.stringify(state));
  },
};
