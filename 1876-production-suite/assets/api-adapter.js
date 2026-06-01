/**
 * 1876 Production Suite — WordPress REST API Adapter
 * ────────────────────────────────────────────────────
 * Bridges the app's data-layer calls to the WP REST API.
 *
 * P1876_API is injected by WordPress via wp_localize_script():
 *   P1876_API.root   = 'https://yoursite.com/wp-json/1876/v1/'
 *   P1876_API.nonce  = '<wp_rest nonce>'
 */

// Alias so app.js (which still references SS_API) finds the localized object
var SS_API = P1876_API; // eslint-disable-line no-var

/* global P1876_API, jobs, users, anchorDate, currentHorizonDays,
          currentUserName, applyLoadedState, renderSchedule,
          saveStateToStorage, buildStatePayload,
          updateFsaStatusUI, ensureUserName, resolveUserRole, applyRoleUI */

const SS_WP = (() => {

  function apiUrl(path) {
    return P1876_API.root.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-WP-Nonce':   P1876_API.nonce,
    };
  }

  async function apiFetch(path, options = {}) {
    const url = apiUrl(path);
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(`API ${options.method || 'GET'} ${path} failed: ${err.message || res.status}`);
      }
      return await res.json();
    } catch (e) {
      console.error('[P1876_WP] fetch error:', e);
      throw e;
    }
  }

  // ── Status banner ────────────────────────────────────────────────────────────

  function setStatus(state, msg) {
    const colors = { connected: '#22c55e', saving: '#f97316', error: '#ef4444' };
    const icons  = { connected: '●', saving: '↑', error: '○' };

    document.querySelectorAll('#fsaStatus, #fsaStatusCal').forEach(el => {
      el.textContent = (icons[state] || '○') + ' ' + (msg || '');
      el.style.color = colors[state] || '#9ca3af';
    });

    document.querySelectorAll('#connectFileBtn, #connectFileBtnCal').forEach(btn => {
      if (state === 'connected' || state === 'saving') {
        btn.textContent = 'Connected to Database';
        btn.style.background  = '#22c55e';
        btn.style.color       = '#fff';
        btn.style.borderColor = '#22c55e';
      } else if (state === 'error') {
        btn.textContent = 'Database Error';
        btn.style.background  = '#ef4444';
        btn.style.color       = '#fff';
        btn.style.borderColor = '#ef4444';
      }
    });
  }

  // ── Load ────────────────────────────────────────────────────────────────────

  async function loadFromApi() {
    setStatus('saving', 'Loading…');
    try {
      const payload = await apiFetch('/data');
      if (payload && Array.isArray(payload.jobs)) {
        applyLoadedState(payload, { fromEmbedded: false });
        if (window.resolveUserRole) window.resolveUserRole(window.currentUserName);
        if (window.applyRoleUI)     window.applyRoleUI();
        renderSchedule();
        setStatus('connected', 'Loaded from database');
      }
    } catch (e) {
      setStatus('error', 'Could not load data');
      console.error('[P1876_WP] loadFromApi failed', e);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function saveToApi() {
    setStatus('saving', 'Saving…');
    try {
      const payload = buildStatePayload();
      await apiFetch('/data', {
        method: 'PUT',
        body:   JSON.stringify(payload),
      });
      const t = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      setStatus('connected', 'Saved at ' + t);
    } catch (e) {
      setStatus('error', 'Save failed — check console');
      console.error('[P1876_WP] saveToApi failed', e);
    }
  }

  // ── Single-job helpers ──────────────────────────────────────────────────────

  async function patchJob(jobData) {
    return apiFetch('/jobs/' + encodeURIComponent(String(jobData.id)), {
      method: 'PUT',
      body:   JSON.stringify(jobData),
    });
  }

  async function deleteJob(jobId) {
    return apiFetch('/jobs/' + encodeURIComponent(String(jobId)), {
      method: 'DELETE',
    });
  }

  // ── Poll for external updates ────────────────────────────────────────────────

  let _pollId = null;

  function startPoll(intervalMs) {
    stopPoll();
    _pollId = setInterval(async () => {
      try {
        const payload = await apiFetch('/data');
        if (!payload || !payload.lastEditedAt) return;
        const fileTime = new Date(payload.lastEditedAt);
        if (
          window._ssLastLoadedAt &&
          fileTime > window._ssLastLoadedAt &&
          payload.lastEditedBy !== currentUserName
        ) {
          showUpdateBanner(payload.lastEditedBy, fileTime);
        }
      } catch (_) { /* silent */ }
    }, intervalMs || 900000);
  }

  function stopPoll() {
    if (_pollId) { clearInterval(_pollId); _pollId = null; }
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  function init() {
    document.querySelectorAll('#connectFileBtn, #connectFileBtnCal').forEach(btn => {
      btn.textContent = 'Reload from Database';
      btn.style.background  = '#22c55e';
      btn.style.color       = '#fff';
      btn.style.borderColor = '#22c55e';
      btn.onclick = function() { loadFromApi(); };
    });

    window.saveStateToStorage = function() {
      try {
        const payload = buildStatePayload();
        localStorage.setItem('studioSchedulerState_v1', JSON.stringify(payload));
      } catch (_) {}
      clearTimeout(window._ssApiSaveTimer);
      window._ssApiSaveTimer = setTimeout(() => saveToApi(), 800);
    };

    window.saveToConnectedFile = function() {
      return saveToApi();
    };

    window.connectToDataFile = function() {
      loadFromApi();
    };

    const cached = (() => {
      try { return JSON.parse(localStorage.getItem('studioSchedulerState_v1') || ''); }
      catch (_) { return null; }
    })();

    if (cached && Array.isArray(cached.jobs) && cached.jobs.length) {
      applyLoadedState(cached, { fromEmbedded: false });
      renderSchedule();
      setStatus('connected', 'Loaded from cache — syncing…');
    }

    loadFromApi().then(() => {
      window._ssLastLoadedAt = new Date();
    });

    startPoll(900000);
  }

  return { init, loadFromApi, saveToApi, patchJob, deleteJob, startPoll, stopPoll };

})();
