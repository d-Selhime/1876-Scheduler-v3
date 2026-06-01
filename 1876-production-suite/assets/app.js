// prettier-ignore
// In-memory job store for now
// Initialize WordPress API adapter (replaces JSON file I/O)
document.addEventListener('DOMContentLoaded', function() {
const jobs = [];
let editingJobId = null;
let currentModalJobId = null;
let _assigneeBreakdown = {}; // keyed "name||weekIdx" → { name, weekLabel, jobs[] }

function parseMinutes(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function recalcJobMetrics() {
  const fxf = parseFloat(document.getElementById("fxfAssets").value) || 0;
  const social = parseFloat(document.getElementById("socialAssets").value) || 0;
  const display =
    parseFloat(document.getElementById("displayAssets").value) || 0;
  const statics =
    parseFloat(document.getElementById("staticAssets").value) || 0;
  const cdOnly = parseFloat(document.getElementById("cdOnlyAssets").value) || 0;
  const totalAssets = social + display + statics + cdOnly;

  document.getElementById("totalAssets").value = String(totalAssets);
  const loe = parseFloat(document.getElementById("loe").value) || 1;

  // Rounds multiplier: diminishing returns, each extra round = 70% of previous
  // Applies to Social Dev, Display Dev, Static Dev, Creative, Proofing ONLY
  const roundsN = parseInt(document.getElementById("estRounds")?.value) || 1;
  const roundsMult = roundsN <= 1 ? 1 : (1 - Math.pow(0.7, roundsN)) / 0.3;
  const rl = document.getElementById("estRoundsLabel");
  if (rl)
    rl.textContent =
      roundsN +
      " round" +
      (roundsN > 1 ? "s" : "") +
      " · ×" +
      roundsMult.toFixed(2);

  const fxfM = parseMinutes(document.getElementById("fxfMinutes").value) * loe;
  const devSocialMBase = parseMinutes(
    document.getElementById("devMinutesSocial").value
  );
  const devDisplayMBase = parseMinutes(
    document.getElementById("devMinutesDisplay").value
  );
  const devStaticM =
    parseMinutes(document.getElementById("devMinutesStatic").value) * loe;
  const revM =
    parseMinutes(document.getElementById("reviewMinutes").value) * loe;
  const qaM = parseMinutes(document.getElementById("qaMinutes").value) * loe;
  const cdM = parseMinutes(document.getElementById("cdMinutes").value);
  const cdDelivM = parseMinutes(
    document.getElementById("cdDeliveryMinutes").value
  );
  const cdPlacements =
    parseFloat(document.getElementById("cdPlacements").value) || 0;
  const cdBasis = cdPlacements > 0 ? cdPlacements : totalAssets;

  const reductionFactor = 0.75;

  const socialDevMins =
    social > 0
      ? devSocialMBase * loe +
        (social - 1) * (devSocialMBase * reductionFactor * loe)
      : 0;
  const displayDevMins =
    display > 0
      ? devDisplayMBase * loe +
        (display - 1) * (devDisplayMBase * reductionFactor * loe)
      : 0;

  const fxfDevH = (fxf * fxfM) / 60;
  // roundsMult applied: Social Dev, Display Dev, Static Dev, Creative (qaH), Proofing (revH)
  const socialDevH = (socialDevMins / 60) * roundsMult;
  const displayDevH = (displayDevMins / 60) * roundsMult;
  const staticDevH = ((statics * devStaticM) / 60) * roundsMult;
  const revH = ((totalAssets * revM) / 60) * roundsMult; // Proofing
  const qaH = ((totalAssets * qaM) / 60) * roundsMult; // Creative
  // QA and CD: no rounds multiplier
  const cdH = (cdBasis * cdM) / 60;
  const cdDelivH = (cdBasis * cdDelivM) / 60;

  document.getElementById("socialDevHours").textContent = socialDevH.toFixed(1);
  document.getElementById("displayDevHours").textContent =
    displayDevH.toFixed(1);
  document.getElementById("staticDevHours").textContent = staticDevH.toFixed(1);
  document.getElementById("reviewHours").textContent = revH.toFixed(1);
  document.getElementById("qaHours").textContent = qaH.toFixed(1);
  document.getElementById("cdHours").textContent = (
    cdH +
    cdDelivH +
    fxfDevH
  ).toFixed(1);
  updateSummary();
}

function fmtDate(isoStr) {
  if (!isoStr) return "—";
  const [y, m, d] = isoStr.split("-");
  if (!y || !m || !d) return "—";
  return m + "/" + d + "/" + y;
}

function updateSummary() {
  const g = (id) => document.getElementById(id);
  const sv = (id, val) => {
    const el = g(id);
    if (el) el.textContent = val;
  };

  // Job name
  sv("sumJobName", g("jobName")?.value.trim() || "JOB ID / WF #");

  // Asset counts
  const social = parseFloat(g("socialAssets")?.value) || 0;
  const display = parseFloat(g("displayAssets")?.value) || 0;
  const statics = parseFloat(g("staticAssets")?.value) || 0;
  const cdOnly = parseFloat(g("cdOnlyAssets")?.value) || 0;
  const total = social + display + statics + cdOnly;
  sv("sumTotalAssets", String(total));
  // Hours (not asset counts) — populated after reading hidden spans below

  // LOE
  const loe = parseFloat(g("loe")?.value) || 1;
  const loeLabels = { 0.75: "Light", 1: "Normal", 1.5: "Heavy", 2: "Extreme" };
  sv("sumLoe", loeLabels[String(loe)] || loe + "×");

  // Priority
  const priority = g("priority")?.value || "";
  sv("sumPriority", priority || "—");
  sv("sumStartDate", fmtDate(g("startDate")?.value));
  sv("sumCdDate", fmtDate(g("cdDate")?.value));
  sv("sumLiveDate", fmtDate(g("liveDate")?.value));
  sv("sumGoLiveDate", fmtDate(g("goLiveDate")?.value));

  // Hours
  const revH2 = parseFloat(g("reviewHours")?.textContent) || 0;
  const qaH2 = parseFloat(g("qaHours")?.textContent) || 0;
  const cdH2 = parseFloat(g("cdHours")?.textContent) || 0;
  const sdevH = parseFloat(g("socialDevHours")?.textContent) || 0;
  const ddevH = parseFloat(g("displayDevHours")?.textContent) || 0;
  const stDevH = parseFloat(g("staticDevHours")?.textContent) || 0;
  const totalH = sdevH + ddevH + stDevH + revH2 + qaH2 + cdH2;
  sv("sumSocial", String(parseFloat(sdevH.toFixed(1))));
  sv("sumDisplay", String(parseFloat(ddevH.toFixed(1))));
  sv("sumStatics", String(parseFloat(stDevH.toFixed(1))));
  sv("sumTotalHours", String(parseFloat(totalH.toFixed(1))));
  sv("sumProofing", String(parseFloat(revH2.toFixed(1))));
  sv("sumCreative", String(parseFloat(qaH2.toFixed(1))));
  sv("sumCD", String(parseFloat(cdH2.toFixed(1))));

  // Duration (start → CD)
  const s = g("startDate")?.value;
  const c = g("cdDate")?.value;
  if (s && c) {
    const diff = Math.round(
      (new Date(c + "T00:00:00") - new Date(s + "T00:00:00")) / 86400000
    );
    sv("sumDuration", diff >= 0 ? diff + " days" : "—");
  } else {
    sv("sumDuration", "—");
  }
}

// Also update summary when name/date fields change
["jobName", "startDate", "cdDate", "liveDate", "loe"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", updateSummary);
  el.addEventListener("change", updateSummary);
});

[
  "socialAssets",
  "displayAssets",
  "staticAssets",
  "cdOnlyAssets",
  "loe",
  "devMinutesSocial",
  "devMinutesDisplay",
  "devMinutesStatic",
  "reviewMinutes",
  "qaMinutes",
  "cdMinutes",
  "cdPlacements",
  "estRounds",
].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", recalcJobMetrics);
  el.addEventListener("change", recalcJobMetrics);
});

function toggleJobTypeFields() {
  const isVacation =
    (document.getElementById("jobType") || {}).value === "Vacation";
  [
    "jobOnlyAssets",
    "jobOnlyMinutes",
    "jobOnlyAssignee1",
    "jobOnlyAssignee2",
    "sectionResources",
    "sectionAssets",
    "sectionTaskTime",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = isVacation ? "none" : "";
  });
  const vacEl = document.getElementById("vacationOnlyFields");
  if (vacEl) vacEl.style.display = isVacation ? "" : "none";
  // Hide fields irrelevant to vacation entries
  ["fieldMarketer", "fieldCp", "fieldPriority", "fieldLiveDate"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = isVacation ? "none" : "";
    }
  );
  // Clear liveDate when switching to Vacation so stale values don't affect capacity math
  if (isVacation) {
    const lvEl = document.getElementById("liveDate");
    if (lvEl) lvEl.value = "";
  }
  // Swap form title
  const titleEl = document.getElementById("formTitle");
  if (titleEl)
    titleEl.textContent = isVacation ? "Vacation Tracker" : "New / Edit Job";
  // Swap Content Delivery Date label
  const cdLbl = document.getElementById("cdDateLabel");
  if (cdLbl)
    cdLbl.textContent = isVacation ? "End Date" : "Content Delivery Date";
}
document
  .getElementById("jobType")
  .addEventListener("change", toggleJobTypeFields);

// SLA auto-fill: forward-fill empty downstream dates on change
["startDate", "cdDate", "liveDate"].forEach(function (id) {
  const el = document.getElementById(id);
  if (el)
    el.addEventListener("change", function () {
      slaFillDates(id, false);
    });
});

// ↻ SLA button: force-recalculate all dates from Start Date
const slaFillBtn = document.getElementById("slaFillBtn");
if (slaFillBtn) {
  slaFillBtn.addEventListener("click", function () {
    const startEl = document.getElementById("startDate");
    if (!startEl || !startEl.value) {
      alert("Set a Start Date first.");
      return;
    }
    // Clear downstream fields then force-fill from start
    ["cdDate", "liveDate", "goLiveDate"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    slaFillDates("startDate", true);
  });
}

// Auto-set the vacationTrack when a known person is selected
document
  .getElementById("vacationPerson")
  .addEventListener("input", function () {
    const name = this.value.trim();
    const track = PERSON_GROUP_MAP[name];
    if (track) {
      document.getElementById("vacationTrack").value = track;
    }
  });

function getDateFromInput(id) {
  const v = document.getElementById(id).value;
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  return isNaN(d) ? null : d;
}

// Add N business days to a date (skips Sat/Sun)
function addBizDays(date, n) {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function dateToInputValue(d) {
  if (!d || isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

// SLA rules by job type:
//   Adapt (minor): Start +3 → CD, CD +2 → Media H/O, Media H/O +7 → Go Live
//   Adopt (new):   Start +5 → CD, CD +2 → Media H/O, Media H/O +10 → Go Live
//   Others:        use Adapt defaults
function getSlaRules() {
  const jt = (document.getElementById("jobType") || {}).value || "";
  if (jt === "Adopt") return { startToCd: 5, cdToLive: 2, liveToGo: 10 };
  return { startToCd: 3, cdToLive: 2, liveToGo: 7 };
}

// Forward-fill empty downstream date fields from any anchor date.
// If force=true, overwrite all downstream fields even if already set.
function slaFillDates(changedField, force) {
  const rules = getSlaRules();
  const startEl = document.getElementById("startDate");
  const cdEl = document.getElementById("cdDate");
  const liveEl = document.getElementById("liveDate");
  const goLiveEl = document.getElementById("goLiveDate");

  const startD =
    startEl && startEl.value ? new Date(startEl.value + "T00:00:00") : null;
  const cdD = cdEl && cdEl.value ? new Date(cdEl.value + "T00:00:00") : null;
  const liveD =
    liveEl && liveEl.value ? new Date(liveEl.value + "T00:00:00") : null;

  // Start Date changed → fill CD, Media H/O, Go Live if empty (or force)
  if (changedField === "startDate" && startD) {
    if (cdEl && (!cdEl.value || force))
      cdEl.value = dateToInputValue(addBizDays(startD, rules.startToCd));
    const newCd =
      cdEl && cdEl.value ? new Date(cdEl.value + "T00:00:00") : null;
    if (liveEl && (!liveEl.value || force) && newCd)
      liveEl.value = dateToInputValue(addBizDays(newCd, rules.cdToLive));
    const newLive =
      liveEl && liveEl.value ? new Date(liveEl.value + "T00:00:00") : null;
    if (goLiveEl && (!goLiveEl.value || force) && newLive)
      goLiveEl.value = dateToInputValue(addBizDays(newLive, rules.liveToGo));
  }

  // CD Date changed → fill Media H/O (and Go Live if empty/force)
  if (changedField === "cdDate" && cdD) {
    if (liveEl && (!liveEl.value || force))
      liveEl.value = dateToInputValue(addBizDays(cdD, rules.cdToLive));
    const newLive =
      liveEl && liveEl.value ? new Date(liveEl.value + "T00:00:00") : null;
    if (goLiveEl && (!goLiveEl.value || force) && newLive)
      goLiveEl.value = dateToInputValue(addBizDays(newLive, rules.liveToGo));
  }

  // Media H/O changed → fill Go Live if empty (or force)
  if (changedField === "liveDate" && liveD) {
    if (goLiveEl && (!goLiveEl.value || force))
      goLiveEl.value = dateToInputValue(addBizDays(liveD, rules.liveToGo));
  }
}

function saveJob() {
  const baseId = editingJobId || Date.now();
  const job = {
    id: baseId,
    name: document.getElementById("jobName").value.trim() || "Untitled Job",
    cp: document.getElementById("cp").value.trim(),
    producer: document.getElementById("producer").value.trim(),
    marketer: document.getElementById("marketer").value.trim(),
    risk: document.getElementById("risk")
      ? document.getElementById("risk").value.trim()
      : "",
    mediaPartner: document.getElementById("mediaPartner")
      ? document.getElementById("mediaPartner").value.trim()
      : "",
    priority: parseInt(document.getElementById("priority").value) || 1,
    lob: document.getElementById("lob").value.trim(),
    jobType: document.getElementById("jobType").value,
    startDate: getDateFromInput("startDate"),
    cdDate: getDateFromInput("cdDate"),
    liveDate: getDateFromInput("liveDate"),
    goLiveDate: getDateFromInput("goLiveDate"),
    fxfAssets: parseFloat(document.getElementById("fxfAssets").value) || 0,
    socialAssets:
      parseFloat(document.getElementById("socialAssets").value) || 0,
    displayAssets:
      parseFloat(document.getElementById("displayAssets").value) || 0,
    staticAssets:
      parseFloat(document.getElementById("staticAssets").value) || 0,
    cdOnlyAssets:
      parseFloat(document.getElementById("cdOnlyAssets").value) || 0,
    totalAssets: parseFloat(document.getElementById("totalAssets").value) || 0,
    loe: parseFloat(document.getElementById("loe").value) || 1,
    devMinutesSocial: parseMinutes(
      document.getElementById("devMinutesSocial").value
    ),
    devMinutesDisplay: parseMinutes(
      document.getElementById("devMinutesDisplay").value
    ),
    devMinutesStatic: parseMinutes(
      document.getElementById("devMinutesStatic").value
    ),
    reviewMinutes: parseMinutes(document.getElementById("reviewMinutes").value),
    qaMinutes: parseMinutes(document.getElementById("qaMinutes").value),
    fxfMinutes: parseMinutes(document.getElementById("fxfMinutes").value),
    cdMinutes: parseMinutes(document.getElementById("cdMinutes").value),
    cdDeliveryMinutes: parseMinutes(
      document.getElementById("cdDeliveryMinutes").value
    ),
    estRounds: parseInt(document.getElementById("estRounds")?.value) || 1,
    cdPlacements:
      parseFloat(document.getElementById("cdPlacements").value) || 0,
    vacationTrack: document.getElementById("vacationTrack").value || "all",
    vacationPerson: document.getElementById("vacationPerson").value.trim(),
    assigneeSocial: document.getElementById("assigneeSocial").value.trim(),
    assigneeDisplay: document.getElementById("assigneeDisplay").value.trim(),
    assigneeStatic: document.getElementById("assigneeStatic").value.trim(),
    assigneeReview: document.getElementById("assigneeReview").value.trim(),
    assigneeQa: document.getElementById("assigneeQa").value.trim(),
    assigneeCd: document.getElementById("assigneeCd").value.trim(),
    assigneeAd: document.getElementById("assigneeAd")
      ? document.getElementById("assigneeAd").value.trim()
      : "",
    assigneeContent: document.getElementById("assigneeContent")
      ? document.getElementById("assigneeContent").value.trim()
      : "",
    notes: document.getElementById("jobNotes").value.trim(),
  };

  const nowStamp = new Date().toISOString();
  const byStamp = currentUserName || "Unknown";

  if (editingJobId) {
    const idx = jobs.findIndex((j) => j.id === editingJobId);
    // Preserve original createdAt/createdBy; stamp updatedAt
    const existing = idx !== -1 ? jobs[idx] : null;
    if (existing) {
      job.createdAt = existing.createdAt || nowStamp;
      job.createdBy = existing.createdBy || byStamp;
    } else {
      job.createdAt = nowStamp;
      job.createdBy = byStamp;
    }
    job.updatedAt = nowStamp;
    job.updatedBy = byStamp;
    // ── LOB ownership warning ──
    const myLobs = getMyLobs();
    if (
      myLobs.length > 0 &&
      job.lob &&
      !myLobs.includes(job.lob.toUpperCase())
    ) {
      const lobLabel = myLobGroup === "BUS" ? "BUS" : "FIB / MOB";
      alert(
        "\u26a0\ufe0f  This job is assigned to " +
          job.lob +
          ", which is outside your LOB group (" +
          lobLabel +
          ").\nYour change has been saved locally but will NOT be written to the shared file."
      );
      // Save locally only — skip shared file sync
      if (idx !== -1) {
        jobs[idx] = job;
      } else {
        jobs.push(job);
      }
      editingJobId = null;
      renderSchedule();
      saveStateToStorage();
      clearForm();
      var _srfp1 = document.getElementById("srFilterPhase");
      if (_srfp1) _srfp1.value = "active";
      showView("status");
      return;
    }
    if (idx !== -1) {
      jobs[idx] = job;
    } else {
      jobs.push(job);
    }
    editingJobId = null;
  } else {
    // New job — check LOB ownership
    const myLobsNew = getMyLobs();
    if (
      myLobsNew.length > 0 &&
      job.lob &&
      !myLobsNew.includes(job.lob.toUpperCase())
    ) {
      const lobLabelNew = myLobGroup === "BUS" ? "BUS" : "FIB / MOB";
      alert(
        "⚠️  This job is assigned to " +
          job.lob +
          ", which is outside your LOB group (" +
          lobLabelNew +
          ").\nYour change has been saved locally but will NOT be written to the shared file."
      );
      job.createdAt = nowStamp;
      job.createdBy = byStamp;
      jobs.push(job);
      renderSchedule();
      saveStateToStorage();
      clearForm();
      var _srfp2 = document.getElementById("srFilterPhase");
      if (_srfp2) _srfp2.value = "active";
      showView("status");
      return;
    }
    job.createdAt = nowStamp;
    job.createdBy = byStamp;
    jobs.push(job);
  }
  renderSchedule();
  saveStateToStorage();
  clearForm();
  var srfp = document.getElementById("srFilterPhase");
  if (srfp) srfp.value = "active";
  showView("status");
}

function clearForm() {
  document.getElementById("jobName").value = "";
  document.getElementById("cp").value = "";
  document.getElementById("producer").value = "";
  document.getElementById("marketer").value = "";
  if (document.getElementById("risk"))
    document.getElementById("risk").value = "";
  if (document.getElementById("mediaPartner"))
    document.getElementById("mediaPartner").value = "";
  document.getElementById("priority").value = "1";
  document.getElementById("lob").value = "";
  document.getElementById("jobType").value = "Adapt";
  document.getElementById("startDate").value = "";
  document.getElementById("cdDate").value = "";
  document.getElementById("liveDate").value = "";
  if (document.getElementById("goLiveDate"))
    document.getElementById("goLiveDate").value = "";
  document.getElementById("fxfAssets").value = "";
  document.getElementById("socialAssets").value = "0";
  document.getElementById("displayAssets").value = "0";
  document.getElementById("staticAssets").value = "0";
  document.getElementById("cdOnlyAssets").value = "0";
  document.getElementById("totalAssets").value = "0";
  document.getElementById("loe").value = "1";
  document.getElementById("devMinutesSocial").value = "30";
  document.getElementById("devMinutesDisplay").value = "30";
  document.getElementById("devMinutesStatic").value = "15";
  document.getElementById("reviewMinutes").value = "10";
  document.getElementById("qaMinutes").value = "5";
  document.getElementById("fxfMinutes").value = "30";
  document.getElementById("cdMinutes").value = "10";
  document.getElementById("cdDeliveryMinutes").value = "10";
  if (document.getElementById("estRounds"))
    document.getElementById("estRounds").value = "1";
  document.getElementById("cdPlacements").value = "0";
  document.getElementById("vacationTrack").value = "all";
  document.getElementById("vacationPerson").value = "";
  document.getElementById("assigneeSocial").value = "";
  document.getElementById("assigneeDisplay").value = "";
  document.getElementById("assigneeStatic").value = "";
  document.getElementById("assigneeReview").value = "";
  document.getElementById("assigneeQa").value = "";
  document.getElementById("assigneeCd").value = "";
  if (document.getElementById("assigneeAd"))
    document.getElementById("assigneeAd").value = "";
  if (document.getElementById("assigneeContent"))
    document.getElementById("assigneeContent").value = "";
  document.getElementById("jobNotes").value = "";
  recalcJobMetrics();
}

document.getElementById("saveJobBtn").addEventListener("click", saveJob);
document.getElementById("clearFormBtn").addEventListener("click", clearForm);
const deleteJobBtn = document.getElementById("deleteJobBtn");
if (deleteJobBtn) {
  deleteJobBtn.addEventListener("click", () => {
    if (editingJobId == null) {
      alert(
        "Load a job to edit before deleting. Use the Calendar view or another entry point to select an existing job."
      );
      return;
    }
    const job = jobs.find((j) => j.id === editingJobId);
    const name = job && job.name ? job.name : "Untitled Job";
    const confirmed = window.confirm(`Delete job "${name}" from the schedule?`);
    if (!confirmed) return;

    const idx = jobs.findIndex((j) => j.id === editingJobId);
    if (idx !== -1) {
      jobs.splice(idx, 1);
    }
    if (currentModalJobId === editingJobId) {
      currentModalJobId = null;
    }
    editingJobId = null;
    clearForm();
    renderSchedule();
    saveStateToStorage();
    showView("calendar");
  });
}

// Calendar state & team capacity (weekly hours)
let currentHorizonDays = 42; // 6 weeks
let anchorDate = new Date();
const STORAGE_KEY = "studioSchedulerState_v1";
// Optional baked-in snapshot so a shared HTML can open pre-populated.
// This has been filled with your current scheduler state.
const EMBEDDED_STATE = { "jobs": [], "anchorDate": null, "currentHorizonDays": 42 };
// NOTE: Real data is loaded from the WP REST API by SS_WP.init() below.
const TEAM_CAPACITY = {
  // Weekly available man-hours for the team by track
  socialPerWeek: 80,
  displayPerWeek: 80,
  staticPerWeek: 60,
  reviewPerWeek: 32,
  qaPerWeek: 32,
  cdPerWeek: 60,
};
// Weekly available hours per individual assignee (edit as needed)
const DEFAULT_ASSIGNEE_WEEKLY_CAPACITY = 32;
const ASSIGNEE_CAPACITY = {
  MoDev_1: 32,
  MoDev_2: 32,
  MoDev_3: 32,
  MoDev_4: 32,
  MoDev_5: 32,
  // Add more assignees here as needed, e.g. "QA_Lead": 35
};

// Maps a team member's name to their function group for vacation capacity.
// 'social+display' reduces both Social and Display tracks.
const PERSON_GROUP_MAP = {
  "Keith Mallett": "social+display",
  "Eric Howell": "social+display",
  "Neal Lee": "social+display",
  "Ariel Manigsaca": "social+display",
  "Aaron Sterczewski": "social+display",
  "Jeremy Hagan": "statics",
  "Angela Gomez": "statics",
  "Joe Wilk": "review",
  "Bradley Lammie": "review",
  "Chris Depietro": "review",
  "Joe Brown": "qa",
  "Tracy McClendon": "qa",
};

// ── File System Access API (OneDrive auto-save) ──────────────────────────
const IDB_NAME = "studioSchedulerFS";
const IDB_STORE = "handles";
const IDB_KEY = "dataFile";
let connectedFileHandle = null;
let _fsaStatus = "disconnected"; // 'disconnected' | 'saving' | 'connected'
let currentUserName =
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("schedulerUserName")) ||
  "";
let inMemoryLastEditedAt = null;
let pollIntervalId = null;

// Expose currentUserName as a live getter so api-adapter can always read it
Object.defineProperty(window, 'currentUserName', {
    get: function() { return currentUserName; },
    set: function(val) { currentUserName = val; }
});

// ── LOB ownership groups ─────────────────────────────────────────────
const LOB_GROUPS = {
  BUS: ["BUS"],
  FIB_MOB: ["FIB", "MOB"],
};
let myLobGroup =
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("schedulerLobGroup")) ||
  null;
// myLobGroup is a key of LOB_GROUPS ('BUS' or 'FIB_MOB')
function getMyLobs() {
  if (currentUserRole === "admin") return []; // admin sees and edits all LOBs
  if (currentUserRole === "manager" && currentUserLobs.length > 0)
    return currentUserLobs;
  return myLobGroup ? LOB_GROUPS[myLobGroup] || [] : [];
}
function isMyLob(lob) {
  const mine = getMyLobs();
  return mine.length === 0 || mine.includes((lob || "").toUpperCase());
}
// ── Role-based access control ────────────────────────────────────────
// roles: 'admin' | 'manager' | 'view-dev' | 'view-designer' | 'view-creative'
//         | 'view-proofing' | 'view-qa' | 'view-cd' | 'view-marketer' | 'view'
let users = []; // [{name, role, lobs:[]}] — loaded from JSON
let currentUserRole = "view"; // default until resolved
let currentUserLobs = []; // LOBs this user can edit (managers only)
let currentUserFunctions = []; // functions[] from team panel for current user
let srSortCol = "startDate"; // default: sort within LOB groups by start date
let srSortDir = "asc"; // 'asc' | 'desc'

// Normalize a raw role string from Excel/JSON into a canonical role key
function normalizeRoleStr(raw) {
  const r = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-/]+/g, "-");
  // 'admin, manager' or 'admin,manager' — admin wins
  if (r.includes("admin") || r === "administrator") return "admin";
  if (r === "lob-manager" || r === "lob manager" || r === "lobmanager")
    return "lob-manager";
  if (r === "manager" || r === "producer") return "manager";
  if (r.includes("designer")) return "view-designer";
  if (r.includes("dev") || r.includes("developer")) return "view-dev";
  if (r.includes("creative")) return "view-creative";
  if (r.includes("proofing") || r.includes("proofer")) return "view-proofing";
  if (r.includes("qa") || r === "view-qa") return "view-qa";
  if (r.includes("-cd") || r === "view-cd" || r.includes("content-delivery"))
    return "view-cd";
  if (r.includes("marketer") || r.includes("marketing")) return "view-marketer";
  return "view";
}

// Returns true if role should see calendar-only UI (no Status Report, no edit)
function isViewRole(role) {
  return String(role || "").startsWith("view-") || role === "view";
}

// Returns true if role should have calendar bar dimming applied (only explicit sub-roles)
function isDimRole(role) {
  return String(role || "").startsWith("view-");
}

function resolveUserRole(name) {
  const nameTrimmed = (name || "").trim();
  // Never grant elevated access to blank or unknown names
  if (!nameTrimmed || nameTrimmed.toLowerCase() === "unknown") {
    currentUserRole = "view";
    currentUserLobs = [];
    return;
  }
  // Bootstrap mode: no users list and no file connected yet — first-time setup only
  if (!users || users.length === 0) {
    // In WordPress mode, never grant admin in bootstrap — 
    // wait for users to load from the API
    currentUserRole = "view";
    currentUserLobs = [];
    return;
  }

  if (!name) {
    currentUserRole = "view";
    currentUserLobs = [];
    return;
  }
  const nameLower = name.trim().toLowerCase();
  // 1) Exact match, 2) Stored name starts with entered name (first-name login),
  // 3) Entered name starts with stored name (full name typed, stored as first name).
  // Intentionally NOT using .includes() in both directions — that is too loose for role security.
  const match =
    users.find((u) => (u.name || "").trim().toLowerCase() === nameLower) ||
    users.find((u) =>
      (u.name || "")
        .trim()
        .toLowerCase()
        .startsWith(nameLower + " ")
    ) ||
    users.find((u) =>
      nameLower.startsWith((u.name || "").trim().toLowerCase() + " ")
    );
  if (!match) {
    currentUserRole = "view";
    currentUserLobs = [];
    currentUserFunctions = [];
    return;
  }
  currentUserRole = normalizeRoleStr(match.role || "view");
  currentUserFunctions = Array.isArray(match.functions) ? match.functions : [];
  if (Array.isArray(match.lobs)) {
    currentUserLobs = match.lobs
      .map((l) => (l || "").trim().toUpperCase())
      .filter(Boolean);
  } else if (typeof match.lobs === "string" && match.lobs.trim()) {
    currentUserLobs = match.lobs
      .split(",")
      .map((l) => l.trim().toUpperCase())
      .filter(Boolean);
  } else {
    currentUserLobs = [];
  }
  if (currentUserRole === "manager" && currentUserLobs.length > 0) {
    myLobGroup = currentUserLobs.join("_");
    localStorage.setItem("schedulerLobGroup", myLobGroup);
  } else if (currentUserRole === "admin") {
    myLobGroup = null;
    localStorage.removeItem("schedulerLobGroup");
  }
}
window.resolveUserRole = resolveUserRole;

function canEditLob(lob) {
  if (currentUserRole === "admin" || currentUserRole === "manager") return true;
  if (currentUserRole === "lob-manager") {
    return (
      currentUserLobs.length === 0 ||
      currentUserLobs.includes("ALL") ||
      currentUserLobs.includes((lob || "").toUpperCase())
    );
  }
  return false;
}

function applyRoleUI() {
  const role = currentUserRole;
  const isView = isViewRole(role);

  // Status Report tab — only admin + manager + lob-manager
  const statusTab = document.querySelector('.tab-bar .tab[data-view="status"]');
  if (statusTab) statusTab.style.display = isView ? "none" : "";

  // Job Input tab — always hidden (Status Report is the edit surface)
  const inputTab = document.querySelector('.tab-bar .tab[data-view="input"]');
  if (inputTab) inputTab.style.display = "none";

  // Connect to JSON — available to ALL roles (view users need it to load data)
  const connectBtn = document.getElementById("connectFileBtn");
  //console.log('connectBtn found:', connectBtn); 
  if (connectBtn) connectBtn.style.display = "";

  // Calendar toolbar data buttons — hidden for view roles; disabled (but visible) for non-admin edit roles
  const calDataIds = [
    "exportJsonBtn",
    "mergeJsonBtn",
    "importExcelBtn",
    "importUsersExcelBtn",
  ];
  calDataIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (isView) {
      btn.style.display = "none";
      return;
    }
    btn.style.display = "";
    btn.disabled = role !== "admin";
    btn.style.opacity = role === "admin" ? "1" : "0.35";
    btn.style.cursor = role === "admin" ? "pointer" : "not-allowed";
  });

  // Calendar bottom sections — hidden for view roles
  ["unscheduledPanel", "capacitySummary", "assigneeSummary"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = isView ? "none" : "";
  });

  // Team & Resources panel — hidden for LOB Managers and view roles
  const isLobManager = role === "lob-manager";
  const teamCard = document.getElementById("teamPanelCard");
  if (teamCard) teamCard.style.display = isView || isLobManager ? "none" : "";

  // SR toolbar buttons — hidden for view roles
  // LOB Managers can add jobs but cannot import/merge/export JSON
  [
    "srImportJsonBtn",
    "srMergeJsonBtn",
    "srExportJsonBtn",
    "srExportXlsxBtn",
    "srAddJobBtn",
  ].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (isView) {
      btn.style.display = "none";
      return;
    }
    const isDataBtn = [
      "srImportJsonBtn",
      "srMergeJsonBtn",
      "srExportJsonBtn",
      "srExportXlsxBtn",
    ].includes(id);
    btn.style.display = isLobManager && isDataBtn ? "none" : "";
  });

  // Job form action buttons
  ["deleteJobBtn", "jobModalDeleteBtn", "saveJobBtn", "clearFormBtn"].forEach(
    (id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = isView;
      btn.style.opacity = isView ? "0.35" : "1";
      btn.style.cursor = isView ? "not-allowed" : "pointer";
    }
  );

  // Edit Job button in modal — hidden for view roles
  const editBtn = document.getElementById("jobModalEditBtn");
  if (editBtn) editBtn.style.display = isView ? "none" : "";

  // Comments section in modal — visible only for view roles
  const commentsSection = document.getElementById("jobModalCommentsSection");
  if (commentsSection) commentsSection.style.display = isView ? "" : "none";

  // Nav badge
  const roleEl = document.getElementById("navRoleBadge");
  if (roleEl) {
    const ROLE_LABELS = {
      admin: "Admin",
      manager: "Manager",
      "lob-manager": "LOB Manager",
      "view-dev": "Dev",
      "view-designer": "Designer",
      "view-creative": "Creative",
      "view-proofing": "Proofing",
      "view-qa": "QA",
      "view-cd": "CD",
      "view-marketer": "Marketer",
      view: "View",
    };
    const ROLE_COLORS = {
      admin: "#ef4444",
      manager: "#f97316",
      "lob-manager": "#d97706",
      "view-dev": "#0ea5e9",
      "view-designer": "#8b5cf6",
      "view-creative": "#ec4899",
      "view-proofing": "#14b8a6",
      "view-qa": "#f59e0b",
      "view-cd": "#22c55e",
      "view-marketer": "#6366f1",
      view: "#6b7280",
    };
    roleEl.textContent = ROLE_LABELS[role] || role;
    roleEl.style.background = ROLE_COLORS[role] || "#6b7280";
  }

  // If view role is currently on status tab, redirect to calendar
  if (isView) {
    const activeTab = document.querySelector(".tab-bar .tab.active");
    if (activeTab && activeTab.dataset.view === "status") showView("calendar");
  }
}
window.applyRoleUI = applyRoleUI;

function refreshDatalistsFromUsers() {
  if (!users || !users.length) return;
  // If a user has a functions[] array, use that; otherwise fall back to role-based mapping
  const hasFn = (u, key) => {
    if (Array.isArray(u.functions) && u.functions.length)
      return u.functions.includes(key);
    // Legacy role-based fallback
    const r = (u.role || "").toLowerCase();
    const legacyMap = {
      social: ["view-dev", "view-designer"],
      display: ["view-dev", "view-designer"],
      static: ["view-dev", "view-designer"],
      creative: ["view-creative"],
      proofing: ["view-proofing", "view-qa"],
      qa: ["view-qa", "view-cd"],
      cd: ["view-cd"],
      producer: ["admin", "manager"],
      cp: ["admin", "manager"],
      marketer: ["view-marketer"],
    };
    return (legacyMap[key] || []).includes(r);
  };
  const map = {
    dlProducer: (u) => hasFn(u, "producer"),
    dlCp: (u) => hasFn(u, "cp"),
    dlSocial: (u) => hasFn(u, "social"),
    dlDisplay: (u) => hasFn(u, "display"),
    dlStatics: (u) => hasFn(u, "static"),
    dlCreative: (u) => hasFn(u, "creative"),
    dlProofing: (u) => hasFn(u, "proofing"),
    dlQA: (u) => hasFn(u, "qa"),
    dlContent: (u) => hasFn(u, "cd"),
    dlMarketer: (u) => hasFn(u, "marketer"),
    vacationPersonList: (u) => true,
  };
  Object.entries(map).forEach(([id, filter]) => {
    const dl = document.getElementById(id);
    if (!dl) return;
    const names = users
      .filter(filter)
      .map((u) => u.name)
      .filter(Boolean);
    dl.innerHTML = names.map((n) => `<option value="${n}"></option>`).join("");
  });
  // Populate the all-resources datalist for the schedule Resource filter
  const dlAll = document.getElementById("dlAllResources");
  if (dlAll) {
    const allNames = [...new Set(users.map((u) => u.name).filter(Boolean))];
    dlAll.innerHTML = allNames
      .map((n) => `<option value="${n}"></option>`)
      .join("");
  }
  // Re-render team panel if it's open
  if (
    document.getElementById("teamPanelBody") &&
    document.getElementById("teamPanelBody").style.display !== "none"
  ) {
    renderTeamPanel();
  }
}

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
async function getStoredHandle() {
  try {
    const db = await openHandleDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}
async function storeHandle(handle) {
  try {
    const db = await openHandleDB();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch (e) {
    /* non-fatal */
  }
}

function updateFsaStatusUI(savedTime) {
  const el = document.getElementById("fsaStatus");
  const btn = document.getElementById("connectFileBtn");
  if (!el) return;
  if (!connectedFileHandle) {
    el.textContent = "\u25CB Not connected";
    el.style.color = "var(--muted)";
    if (btn) {
      btn.textContent = "Connect to JSON";
      btn.style.background = "#ef4444";
      btn.style.color = "#fff";
      btn.style.borderColor = "#ef4444";
    }
  } else if (_fsaStatus === "saving") {
    el.textContent = "\u2191 Saving\u2026";
    el.style.color = "#f97316";
    if (btn) {
      btn.textContent = "Connected to JSON";
      btn.style.background = "#22c55e";
      btn.style.color = "#fff";
      btn.style.borderColor = "#22c55e";
    }
  } else {
    const t =
      savedTime ||
      new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    el.textContent = "\u25CF Connected \u2014 Saved " + t;
    el.style.color = "#22c55e";
    if (btn) {
      btn.textContent = "Connected to JSON";
      btn.style.background = "#22c55e";
      btn.style.color = "#fff";
      btn.style.borderColor = "#22c55e";
    }
  }
}

function ensureUserName() {
  if (!currentUserName || currentUserName === "Unknown") {
    let name = "";
    while (!name) {
      name = (window.prompt("Enter your name to continue:") || "").trim();
      if (!name) alert("A name is required to use the scheduler.");
    }
    currentUserName = name;
    localStorage.setItem("schedulerUserName", currentUserName);
  }
  const el = document.getElementById("fsaUserDisplay");
  if (el) el.textContent = "(" + currentUserName + ")";
  const navEl = document.getElementById("navUserDisplay");
  if (navEl) navEl.textContent = "\ud83d\udc64 " + currentUserName;
  resolveUserRole(currentUserName);
  applyRoleUI();
  return currentUserName;
}

function changeUserName() {
  const name = (
    window.prompt("Change your name:", currentUserName) || ""
  ).trim();
  if (name) {
    currentUserName = name;
    localStorage.setItem("schedulerUserName", currentUserName);
    resolveUserRole(currentUserName);
    applyRoleUI();
    // Update all name display elements directly
    const navUser = document.getElementById("navUserDisplay");
    if (navUser) navUser.textContent = currentUserName;
    const fsaUser = document.getElementById("fsaUserDisplay");
    if (fsaUser) fsaUser.textContent = currentUserName;
  }
}

window.changeUserName = changeUserName;

const navUserNotYou = document.getElementById("navUserNotYou");
if (navUserNotYou) navUserNotYou.addEventListener("click", changeUserName);


function startFsaPoll() {
  stopFsaPoll();
  pollIntervalId = setInterval(checkForExternalUpdates, 900000); // check every 15 minutes
}
function stopFsaPoll() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

function showUpdateBanner(editedBy, editedAt) {
  const banner = document.getElementById("updateBanner");
  const msg = document.getElementById("updateBannerMsg");
  if (!banner || !msg) return;
  const t =
    editedAt instanceof Date
      ? editedAt.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })
      : String(editedAt);
  msg.textContent =
    "\u26A0\uFE0F  " +
    (editedBy || "Someone") +
    " updated the schedule at " +
    t +
    ". Reload to get the latest?";
  banner.style.display = "flex";
  banner.style.alignItems = "center";
  banner.style.justifyContent = "space-between";
}

async function checkForExternalUpdates() {
  if (!connectedFileHandle) return;
  try {
    const perm = await connectedFileHandle.queryPermission({
      mode: "readwrite",
    });
    if (perm !== "granted") return;
    const file = await connectedFileHandle.getFile();
    const text = await file.text();
    if (!text || !text.trim()) return;
    const payload = JSON.parse(text);
    if (!payload || !payload.lastEditedAt) return;
    const fileTime = new Date(payload.lastEditedAt);
    if (isNaN(fileTime)) return;
    if (
      inMemoryLastEditedAt &&
      fileTime > inMemoryLastEditedAt &&
      payload.lastEditedBy !== currentUserName
    ) {
      showUpdateBanner(payload.lastEditedBy, fileTime);
    }
  } catch (e) {
    /* silent */
  }
}

async function saveToConnectedFile() {
  return SS_WP.saveToApi();
}

async function connectToDataFile() {
  SS_WP.loadFromApi();
}

async function initFsaConnection() {
  if (!window.showOpenFilePicker) return;
  try {
    const handle = await getStoredHandle();
    if (!handle) return;
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      connectedFileHandle = handle;
      try {
        const file = await handle.getFile();
        const text = await file.text();
        if (text && text.trim()) {
          const payload = JSON.parse(text);
          if (payload && Array.isArray(payload.jobs)) {
            applyLoadedState(payload, { fromEmbedded: false });
            saveStateToStorage();
            renderSchedule();
          }
        }
      } catch (e) {
        /* fall back to localStorage data already loaded */
      }
      _fsaStatus = "connected";
      updateFsaStatusUI();
      const udEl = document.getElementById("fsaUserDisplay");
      if (udEl && currentUserName)
        udEl.textContent = "(" + currentUserName + ")";
      startFsaPoll();
    } else {
      // Permission needs re-prompt — show as disconnected; user can reconnect
      updateFsaStatusUI();
    }
  } catch (e) {
    console.warn("Could not restore FSA handle", e);
  }
}
// ── End File System Access API ────────────────────────────────────────────

function jumpToToday() {
  anchorDate = new Date();
  renderSchedule();
  saveStateToStorage();
}

function shiftWeek(direction) {
  const d = anchorDate ? new Date(anchorDate) : new Date();
  d.setDate(d.getDate() + direction * 7);
  anchorDate = d;
  renderSchedule();
  saveStateToStorage();
}

document.getElementById("todayBtn").addEventListener("click", jumpToToday);
document
  .getElementById("prevWeekBtn")
  .addEventListener("click", () => shiftWeek(-1));
document
  .getElementById("nextWeekBtn")
  .addEventListener("click", () => shiftWeek(1));

function getMondayStart(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = base.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = (day + 6) % 7; // days since Monday
  base.setDate(base.getDate() - diffToMonday);
  return base;
}

function makeDayRange(start, days) {
  const arr = [];
  const base = getMondayStart(start);
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    arr.push(d);
  }
  return arr;
}

function formatDayLabel(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getJobColor(job, index, palette) {
  return null; // background applied via CSS class
}

function getJobBarClass(job) {
  const jobType = (job.jobType || "").trim();
  if (jobType === "Vacation") return "vacation-bar";
  const lob = (job.lob || "").trim().toLowerCase();
  if (lob.startsWith("mob")) return "job-bar-mob";
  if (lob.startsWith("bus")) return "job-bar-bus";
  if (lob.startsWith("fib")) return "job-bar-fib";
  if (lob.startsWith("fnt") || lob.startsWith("first")) return "job-bar-fnt";
  return "job-bar-mob";
}

function getLobBadgeClass(lob) {
  const l = (lob || "").trim().toLowerCase();
  if (l.startsWith("mob")) return "lob-badge lob-badge-mob";
  if (l.startsWith("bus")) return "lob-badge lob-badge-bus";
  if (l.startsWith("fib")) return "lob-badge lob-badge-fib";
  if (l.startsWith("fnt") || l.startsWith("first"))
    return "lob-badge lob-badge-fnt";
  return "lob-badge lob-badge-mob";
}

function formatDateForDisplay(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString();
}

function formatDateForBar(d) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function getUtilClass(pct) {
  if (!isFinite(pct) || pct < 0) return "";
  if (pct <= 49) return "util-low";
  if (pct <= 74) return "util-mid";
  return "util-high";
}

function buildStatePayload() {
  const serializedJobs = jobs.map((j) => ({
    ...j,
    startDate: j.startDate ? j.startDate.toISOString() : null,
    cdDate: j.cdDate ? j.cdDate.toISOString() : null,
    liveDate: j.liveDate ? j.liveDate.toISOString() : null,
  }));
  const now = new Date();
  inMemoryLastEditedAt = now;
  return {
    jobs: serializedJobs,
    anchorDate: anchorDate ? anchorDate.toISOString() : null,
    currentHorizonDays,
    users: users,
    lastEditedBy: currentUserName || "Unknown",
    lastEditedAt: now.toISOString(),
  };
}
window.buildStatePayload = buildStatePayload;

function saveStateToStorage() {
  if (typeof localStorage === "undefined") return;
  try {
    const payload = buildStatePayload();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Unable to save scheduler state", e);
  }
  // Also write to connected OneDrive file (async, fire-and-forget)
  saveToConnectedFile();
}

function applyLoadedState(payload, options = {}) {
  if (!payload) return;
  const { fromEmbedded = false } = options;
  jobs.length = 0;
  if (Array.isArray(payload.jobs)) {
    payload.jobs.forEach((j) => {
      jobs.push({
        ...j,
        startDate: j.startDate ? new Date(j.startDate) : null,
        cdDate: j.cdDate ? new Date(j.cdDate) : null,
        liveDate: j.liveDate ? new Date(j.liveDate) : null,
        goLiveDate: j.goLiveDate ? new Date(j.goLiveDate) : null,
      });
    });
  }
  // For embedded snapshots, we'll re-anchor to "today" instead of using the
  // saved anchorDate so weeks line up with the current calendar week.
  if (!fromEmbedded && payload.anchorDate) {
    const d = new Date(payload.anchorDate);
    if (!isNaN(d)) anchorDate = d;
  }
  if (
    typeof payload.currentHorizonDays === "number" &&
    payload.currentHorizonDays > 0
  ) {
    currentHorizonDays = payload.currentHorizonDays;
  }
  // Capture the file's edit timestamp for staleness detection
  if (payload.lastEditedAt) {
    const t = new Date(payload.lastEditedAt);
    if (!isNaN(t)) inMemoryLastEditedAt = t;
  }
  // Load users list and re-resolve current user's role
  // Only overwrite if the JSON actually has users — don't let an empty file wipe a freshly imported list
  if (Array.isArray(payload.users) && payload.users.length > 0) {
    users = payload.users;
    resolveUserRole(currentUserName);
    applyRoleUI();
    refreshDatalistsFromUsers();
  } else if (users.length > 0) {
    // Keep existing in-memory users, just re-resolve role
    resolveUserRole(currentUserName);
    applyRoleUI();
  }
}
window.applyLoadedState = applyLoadedState;

function loadStateFromStorage() {
  let payload = null;
  let fromEmbedded = false;
  // Prefer any saved state in localStorage; fall back to baked-in snapshot
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        payload = JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Unable to load scheduler state", e);
    }
  }

  if (!payload && EMBEDDED_STATE && typeof EMBEDDED_STATE === "object") {
    payload = EMBEDDED_STATE;
    fromEmbedded = true;
  }

  if (!payload) {
    return;
  }

  applyLoadedState(payload, { fromEmbedded });

  // If we loaded from an embedded snapshot, reset the anchorDate to "today"
  // so the 6-week window and utilization weeks are aligned to the current week.
  if (fromEmbedded) {
    anchorDate = new Date();
  }

  // Ensure localStorage is kept in sync with the baked-in snapshot/state
  if (typeof localStorage !== "undefined") {
    try {
      // Persist the (possibly re-anchored) state for subsequent loads
      const toStore = fromEmbedded ? buildStatePayload() : payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      console.warn("Unable to persist scheduler state to localStorage", e);
    }
  }

  renderSchedule();
}

function computeJobHours(job) {
  const social = job.socialAssets || 0;
  const display = job.displayAssets || 0;
  const statics = job.staticAssets || 0;
  const cdOnly = job.cdOnlyAssets || 0;
  const total = job.totalAssets || social + display + statics + cdOnly;
  const loe = job.loe || 1;
  const devSocialM = job.devMinutesSocial || 0;
  const devDisplayM = job.devMinutesDisplay || 0;
  const devStaticM = job.devMinutesStatic || 0;
  const reviewM = job.reviewMinutes || 0;
  const qaM = job.qaMinutes || 0;
  const cdM = job.cdMinutes || 0;
  const cdPlacements = job.cdPlacements || 0;
  const cdBasis = cdPlacements > 0 ? cdPlacements : total;
  const reductionFactor = 0.75;

  const socialDevMins =
    social > 0
      ? devSocialM * loe + (social - 1) * (devSocialM * reductionFactor * loe)
      : 0;
  const displayDevMins =
    display > 0
      ? devDisplayM * loe +
        (display - 1) * (devDisplayM * reductionFactor * loe)
      : 0;

  const socialDevH = socialDevMins / 60;
  const displayDevH = displayDevMins / 60;
  const staticDevH = (statics * devStaticM * loe) / 60;
  const reviewH = (total * reviewM * loe) / 60;
  const qaH = (total * qaM * loe) / 60;
  const cdH = (cdBasis * cdM) / 60;

  return { socialDevH, displayDevH, staticDevH, reviewH, qaH, cdH };
}

function loadJobIntoForm(job) {
  document.getElementById("jobName").value = job.name || "";
  document.getElementById("cp").value = job.cp || "";
  document.getElementById("producer").value = job.producer || "";
  document.getElementById("marketer").value = job.marketer || "";
  if (document.getElementById("risk"))
    document.getElementById("risk").value = job.risk || "";
  if (document.getElementById("mediaPartner"))
    document.getElementById("mediaPartner").value = job.mediaPartner || "";
  document.getElementById("priority").value = String(job.priority || "1");
  document.getElementById("lob").value = job.lob || "";
  document.getElementById("jobType").value = job.jobType || "Adapt";
  document.getElementById("startDate").value = job.startDate
    ? job.startDate.toISOString().slice(0, 10)
    : "";
  document.getElementById("cdDate").value = job.cdDate
    ? job.cdDate.toISOString().slice(0, 10)
    : "";
  document.getElementById("liveDate").value = job.liveDate
    ? job.liveDate.toISOString().slice(0, 10)
    : "";
  if (document.getElementById("goLiveDate"))
    document.getElementById("goLiveDate").value = job.goLiveDate
      ? job.goLiveDate.toISOString().slice(0, 10)
      : "";
  if (document.getElementById("fxfAssets"))
    document.getElementById("fxfAssets").value = String(job.fxfAssets ?? "");
  document.getElementById("socialAssets").value = String(job.socialAssets ?? 0);
  document.getElementById("displayAssets").value = String(
    job.displayAssets ?? 0
  );
  document.getElementById("staticAssets").value = String(job.staticAssets ?? 0);
  document.getElementById("cdOnlyAssets").value = String(job.cdOnlyAssets ?? 0);
  document.getElementById("totalAssets").value = String(job.totalAssets ?? 0);
  document.getElementById("loe").value = String(job.loe ?? 1);
  document.getElementById("devMinutesSocial").value = String(
    job.devMinutesSocial ?? 30
  );
  document.getElementById("devMinutesDisplay").value = String(
    job.devMinutesDisplay ?? 30
  );
  document.getElementById("devMinutesStatic").value = String(
    job.devMinutesStatic ?? 15
  );
  document.getElementById("reviewMinutes").value = String(
    job.reviewMinutes ?? 10
  );
  document.getElementById("qaMinutes").value = String(job.qaMinutes ?? 5);
  if (document.getElementById("fxfMinutes"))
    document.getElementById("fxfMinutes").value = String(job.fxfMinutes ?? 30);
  document.getElementById("cdMinutes").value = String(job.cdMinutes ?? 10);
  if (document.getElementById("cdDeliveryMinutes"))
    document.getElementById("cdDeliveryMinutes").value = String(
      job.cdDeliveryMinutes ?? 10
    );
  if (document.getElementById("estRounds"))
    document.getElementById("estRounds").value = String(job.estRounds ?? 1);
  document.getElementById("cdPlacements").value = String(job.cdPlacements ?? 0);
  document.getElementById("vacationTrack").value = job.vacationTrack || "all";
  document.getElementById("vacationPerson").value = job.vacationPerson || "";
  document.getElementById("assigneeSocial").value = job.assigneeSocial || "";
  document.getElementById("assigneeDisplay").value = job.assigneeDisplay || "";
  document.getElementById("assigneeStatic").value = job.assigneeStatic || "";
  document.getElementById("assigneeReview").value = job.assigneeReview || "";
  document.getElementById("assigneeQa").value = job.assigneeQa || "";
  document.getElementById("assigneeCd").value = job.assigneeCd || "";
  if (document.getElementById("assigneeAd"))
    document.getElementById("assigneeAd").value = job.assigneeAd || "";
  if (document.getElementById("assigneeContent"))
    document.getElementById("assigneeContent").value =
      job.assigneeContent || "";
  document.getElementById("jobNotes").value = job.notes || "";
  recalcJobMetrics();
}

function addJobComment(jobId, text) {
  const job = jobs.find((j) => String(j.id) === String(jobId));
  if (!job || !text.trim()) return;
  if (!Array.isArray(job.comments)) job.comments = [];
  job.comments.push({
    author: currentUserName || "Unknown",
    text: text.trim(),
    timestamp: new Date().toISOString(),
  });
  saveStateToStorage();
  renderJobComments(jobId);
}

function renderJobComments(jobId) {
  const job = jobs.find((j) => String(j.id) === String(jobId));
  const list = document.getElementById("jobModalCommentsList");
  if (!list) return;
  const comments = (job && job.comments) || [];
  if (!comments.length) {
    list.innerHTML =
      '<div style="font-size:0.78rem; color:#9ca3af; padding:4px 0;">No comments yet.</div>';
    return;
  }
  list.innerHTML = comments
    .map((c) => {
      const d = new Date(c.timestamp);
      const diff = Date.now() - d.getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      const ago =
        mins < 1
          ? "just now"
          : mins < 60
          ? mins + "m ago"
          : hrs < 24
          ? hrs + "h ago"
          : days < 7
          ? days + "d ago"
          : d.toLocaleDateString();
      const isMe =
        (c.author || "").trim().toLowerCase() ===
        (currentUserName || "").trim().toLowerCase();
      return `<div style="padding:6px 8px; margin-bottom:6px; border-radius:6px; background:${
        isMe ? "#eff6ff" : "#f9fafb"
      }; border:1px solid ${isMe ? "#bfdbfe" : "#e5e7eb"};">
          <div style="font-size:0.7rem; color:#6b7280; margin-bottom:2px;"><strong style="color:#111827;">${
            c.author
          }</strong> &middot; ${ago}</div>
          <div style="font-size:0.82rem; color:#111827; white-space:pre-wrap;">${c.text.replace(
            /</g,
            "&lt;"
          )}</div>
        </div>`;
    })
    .join("");
  list.scrollTop = list.scrollHeight;
}

function openJobModal(job) {
  const backdrop = document.getElementById("jobModal");
  if (!backdrop) return;

  currentModalJobId = job.id;

  // Row 1: title
  const titleEl = document.getElementById("jobModalTitle");
  if (titleEl) titleEl.textContent = job.name || "Untitled Job";

  // Row 2: LOB / Priority / Type / LOE badges
  const lobBadge = document.getElementById("jobModalLobBadge");
  const prioBadge = document.getElementById("jobModalPriorityBadge");
  const typeBadge = document.getElementById("jobModalTypeBadge");
  const loeBadge = document.getElementById("jobModalLoeBadge");
  const LOB_BADGE_COLORS = {
    MOB: "#009FDB",
    FIB: "#2D7E24",
    BUS: "#FF9900",
    FNT: "#DB0000",
  };
  const PRIO_COLORS = {
    1: "#ef4444",
    2: "#f97316",
    3: "#22c55e",
    4: "#06b6d4",
  };
  if (lobBadge) {
    lobBadge.textContent = job.lob || "—";
    lobBadge.style.background =
      LOB_BADGE_COLORS[(job.lob || "").toUpperCase()] || "#6b7280";
  }
  if (prioBadge) {
    prioBadge.textContent = job.priority ? "P" + job.priority : "—";
    prioBadge.style.background = PRIO_COLORS[job.priority] || "#6b7280";
  }
  if (typeBadge) typeBadge.textContent = job.jobType || "—";
  if (loeBadge)
    loeBadge.textContent = job.loe ? "LOE " + job.loe + "\u00d7" : "—";

  // Row 3: people
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "—";
  };
  set("jobModalCp", job.cp);
  set("jobModalProducer", job.producer);
  set("jobModalMarketer", job.marketer);

  // Row 4: dates
  set("jobModalStart", formatDateForDisplay(job.startDate));
  set("jobModalCd", formatDateForDisplay(job.cdDate));
  set("jobModalLive", formatDateForDisplay(job.liveDate));
  set("jobModalGoLive", formatDateForDisplay(job.goLiveDate));

  // Row 5: resources
  set("jobModalAssigneeSocial", job.assigneeSocial);
  set("jobModalAssigneeDisplay", job.assigneeDisplay);
  set("jobModalAssigneeStatic", job.assigneeStatic);
  set("jobModalAssigneeReview", job.assigneeReview);
  set("jobModalAssigneeQa", job.assigneeQa);
  set("jobModalAssigneeCd", job.assigneeCd);
  set("jobModalAssigneeContent", job.assigneeContent);

  // Row 6: asset counts
  const social = job.socialAssets || 0;
  const display = job.displayAssets || 0;
  const statics = job.staticAssets || 0;
  const cdOnly = job.cdOnlyAssets || 0;
  const total = job.totalAssets || social + display + statics + cdOnly;
  set("jobModalAssetSocial", String(social));
  set("jobModalAssetDisplay", String(display));
  set("jobModalAssetStatic", String(statics));
  set("jobModalAssetCdOnly", String(cdOnly));
  set("jobModalTotalAssets", String(total));

  // Row 7: estimated hours
  const loe = job.loe || 1;
  const reductionFactor = 0.75;
  const devSocialM = job.devMinutesSocial || 0;
  const devDisplayM = job.devMinutesDisplay || 0;
  const devStaticM = job.devMinutesStatic || 0;
  const revM = job.reviewMinutes || 0;
  const qaM = job.qaMinutes || 0;
  const cdM = job.cdMinutes || 0;
  const socialDevH =
    social > 0
      ? (devSocialM * loe +
          (social - 1) * (devSocialM * reductionFactor * loe)) /
        60
      : 0;
  const displayDevH =
    display > 0
      ? (devDisplayM * loe +
          (display - 1) * (devDisplayM * reductionFactor * loe)) /
        60
      : 0;
  const staticDevH = (statics * devStaticM * loe) / 60;
  const revH = (total * revM * loe) / 60;
  const qaH = (total * qaM * loe) / 60;
  const cdH = (total * cdM * loe) / 60;
  set("jobModalSocialDevH", socialDevH.toFixed(1));
  set("jobModalDisplayDevH", displayDevH.toFixed(1));
  set("jobModalStaticDevH", staticDevH.toFixed(1));
  set("jobModalReviewH", revH.toFixed(1));
  set("jobModalQAH", qaH.toFixed(1));
  set("jobModalCDH", cdH.toFixed(1));
  const cdBasisVal = job.cdPlacements > 0 ? job.cdPlacements : total;
  set(
    "jobModalCDPlacements",
    job.cdPlacements > 0
      ? cdBasisVal + " placements"
      : cdBasisVal + " (from total assets)"
  );

  // Created row
  const createdRow = document.getElementById("jobModalCreatedRow");
  const createdAtEl = document.getElementById("jobModalCreatedAt");
  const createdByEl = document.getElementById("jobModalCreatedBy");
  if (createdRow) {
    if (job.createdAt) {
      const ct = new Date(job.createdAt);
      const diff = Date.now() - ct.getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      const timeAgo =
        mins < 1
          ? "just now"
          : mins < 60
          ? mins + "m ago"
          : hrs < 24
          ? hrs + "h ago"
          : days < 7
          ? days + "d ago"
          : ct.toLocaleDateString();
      if (createdAtEl) createdAtEl.textContent = timeAgo;
      if (createdByEl) createdByEl.textContent = job.createdBy || "Unknown";
      createdRow.style.display = "";
    } else {
      createdRow.style.display = "none";
    }
  }

  // Notes
  const notesRow = document.getElementById("jobModalNotesRow");
  const notesEl = document.getElementById("jobModalNotes");
  if (notesRow && notesEl) {
    const notes = (job.notes || "").trim();
    notesEl.textContent = notes;
    notesRow.style.display = notes ? "" : "none";
  }

  // Comments (view roles)
  if (isViewRole(currentUserRole)) {
    renderJobComments(job.id);
    const input = document.getElementById("jobModalCommentInput");
    const submit = document.getElementById("jobModalCommentSubmit");
    if (input) input.value = "";
    if (submit) {
      // Replace to remove any old listener
      const fresh = submit.cloneNode(true);
      submit.parentNode.replaceChild(fresh, submit);
      fresh.addEventListener("click", () => {
        const txt = document.getElementById("jobModalCommentInput");
        if (txt && txt.value.trim()) {
          addJobComment(job.id, txt.value);
          txt.value = "";
        }
      });
    }
  }

  backdrop.classList.add("show");
}

function closeJobModal() {
  const backdrop = document.getElementById("jobModal");
  if (backdrop) backdrop.classList.remove("show");
}

function openAssigneeBreakdownModal(key) {
  const data = _assigneeBreakdown[key];
  if (!data) return;
  const modal = document.getElementById("assigneeBreakdownModal");
  const titleEl = document.getElementById("assigneeBreakdownTitle");
  const subtitleEl = document.getElementById("assigneeBreakdownSubtitle");
  const bodyEl = document.getElementById("assigneeBreakdownBody");
  if (!modal || !titleEl || !subtitleEl || !bodyEl) return;
  titleEl.textContent = data.name;
  subtitleEl.textContent = data.weekLabel;
  if (!data.jobs || !data.jobs.length) {
    bodyEl.innerHTML =
      '<p style="color:var(--muted);">No job details available.</p>';
  } else {
    const rows = data.jobs
      .map(
        (j) =>
          `<tr><td style="padding:6px 10px;">${
            j.jobName || "Untitled"
          }</td><td style="padding:6px 10px;">${
            j.track
          }</td><td style="padding:6px 10px; text-align:right;">${
            Math.round(j.hours * 10) / 10
          }h</td></tr>`
      )
      .join("");
    bodyEl.innerHTML = `<table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
          <thead><tr style="border-bottom:1px solid rgba(30,64,175,0.4);">
            <th style="padding:6px 10px; text-align:left;">Job</th>
            <th style="padding:6px 10px; text-align:left;">Track</th>
            <th style="padding:6px 10px; text-align:right;">Hours</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
  }
  modal.classList.add("show");
}

function closeAssigneeBreakdownModal() {
  const modal = document.getElementById("assigneeBreakdownModal");
  if (!modal) return;
  modal.classList.remove("show");
}

function openStatusDrillModal(cardType, lob) {
  const boardEl = document.getElementById("statusBoard");
  if (!boardEl || !boardEl._drillData) return;
  const data = boardEl._drillData;
  const jobList =
    cardType === "new"
      ? lob === "OTHER"
        ? data.newOther
        : data.new[lob] || []
      : lob === "OTHER"
      ? data.startingOther
      : data.starting[lob] || [];
  const titleEl = document.getElementById("statusDrillTitle");
  const bodyEl = document.getElementById("statusDrillBody");
  const modal = document.getElementById("statusDrillModal");
  if (!titleEl || !bodyEl || !modal) return;
  titleEl.textContent =
    (cardType === "new" ? "New Jobs (48h)" : "Starting This Week") +
    " \u2014 " +
    lob;
  if (!jobList.length) {
    bodyEl.innerHTML =
      '<p style="color:var(--muted); padding:8px 0;">No jobs in this group.</p>';
  } else {
    bodyEl.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;table-layout:fixed;">' +
      '<thead><tr style="background:#f9fafb;">' +
      '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:38%;">Job</th>' +
      '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:10%;">Type</th>' +
      '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:14%;">Start</th>' +
      '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:14%;">CD</th>' +
      '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:24%;">Added By</th>' +
      "</tr></thead><tbody>" +
      jobList
        .map(function (job) {
          const typeAbbr =
            {
              Adapt: "ADP",
              Adopt: "CAA",
              AssetOrigination: "AO",
              AdHocRequest: "AHR",
              ContentDeliveryOnly: "CDO",
              "Creative Adaptation/Adoption": "CAA",
              "Creative Origination": "AO",
              "Trafficking Only": "CDO",
            }[job.jobType] ||
            job.jobType ||
            "\u2014";
          return (
            '<tr style="border-bottom:1px solid #f3f4f6;cursor:pointer;" data-job-id="' +
            job.id +
            '">' +
            '<td style="padding:6px 10px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' +
            (job.name || "") +
            '">' +
            (job.name || "Untitled") +
            "</td>" +
            '<td style="padding:6px 10px;">' +
            typeAbbr +
            "</td>" +
            '<td style="padding:6px 10px;">' +
            (job.startDate ? job.startDate.toLocaleDateString() : "\u2014") +
            "</td>" +
            '<td style="padding:6px 10px;">' +
            (job.cdDate ? job.cdDate.toLocaleDateString() : "\u2014") +
            "</td>" +
            '<td style="padding:6px 10px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
            (job.createdBy || "\u2014") +
            "</td>" +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table>";
    bodyEl.querySelectorAll("tr[data-job-id]").forEach(function (row) {
      row.addEventListener("click", function () {
        const id = Number(row.getAttribute("data-job-id"));
        const job = jobs.find(function (j) {
          return j.id === id;
        });
        if (!job) return;
        closeStatusDrillModal();
        openJobModal(job);
      });
    });
  }
  modal.classList.add("show");
}

function closeStatusDrillModal() {
  const modal = document.getElementById("statusDrillModal");
  if (modal) modal.classList.remove("show");
}

function renderSchedule() {
  const grid = document.getElementById("scheduleGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const capacityEl = document.getElementById("capacitySummary");
  if (capacityEl) capacityEl.innerHTML = "";
  const assigneeEl = document.getElementById("assigneeSummary");
  if (assigneeEl) assigneeEl.innerHTML = "";
  _assigneeBreakdown = {}; // reset per render

  const weeksCount = Math.max(1, Math.round(currentHorizonDays / 7));
  const baseMonday = getMondayStart(anchorDate);

  const palette = [
    "#3b82f6",
    "#ec4899",
    "#22c55e",
    "#f97316",
    "#8b5cf6",
    "#06b6d4",
  ];

  const windowLabel = document.getElementById("windowLabel");
  if (windowLabel) {
    const windowStart = new Date(baseMonday);
    const windowEnd = new Date(baseMonday);
    windowEnd.setDate(windowEnd.getDate() + weeksCount * 7 - 1);
    const startStr = windowStart.toLocaleDateString();
    const endStr = windowEnd.toLocaleDateString();
    windowLabel.textContent = `Showing ${weeksCount} week${
      weeksCount > 1 ? "s" : ""
    }: ${startStr} – ${endStr}`;
  }

  // ── Status Board 
  const statusBoardEl = document.getElementById("statusBoard");
  if (statusBoardEl) {
    const LOBS = ["MOB", "FIB", "BUS", "FNT"];
    const LOB_COLORS = {
      MOB: "#009FDB",
      FIB: "#2D7E24",
      BUS: "#FF9900",
      FNT: "#DB0000",
    };
    const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;
    const now = Date.now();

    // Week-start (this Mon) and week-end (this Sun)
    const thisWeekStart = getMondayStart(new Date());
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);

    // Count new jobs (≤48h) per LOB — all jobs, not just visible
    const newByLob = {};
    // Count jobs starting this week per LOB — all jobs
    const startingByLob = {};
    LOBS.forEach((l) => {
      newByLob[l] = 0;
      startingByLob[l] = 0;
    });
    let newOther = 0,
      startingOther = 0;

    // Per-LOB job lists for drill-down
    const newJobsByLob = {};
    const startingJobsByLob = {};
    LOBS.forEach((l) => {
      newJobsByLob[l] = [];
      startingJobsByLob[l] = [];
    });
    const newJobsOther = [],
      startingJobsOther = [];

    jobs.forEach(function (job) {
      if (job.jobType === "Vacation") return;
      const lob = (job.lob || "").toUpperCase();
      const isNew =
        job.createdAt &&
        now - new Date(job.createdAt).getTime() < NEW_WINDOW_MS;
      const startingThisWeek =
        job.startDate &&
        job.startDate >= thisWeekStart &&
        job.startDate <= thisWeekEnd;
      if (isNew) {
        if (LOBS.includes(lob)) {
          newByLob[lob]++;
          newJobsByLob[lob].push(job);
        } else {
          newOther++;
          newJobsOther.push(job);
        }
      }
      if (startingThisWeek) {
        if (LOBS.includes(lob)) {
          startingByLob[lob]++;
          startingJobsByLob[lob].push(job);
        } else {
          startingOther++;
          startingJobsOther.push(job);
        }
      }
    });

    // Store for drill-down clicks
    statusBoardEl._drillData = {
      new: newJobsByLob,
      newOther: newJobsOther,
      starting: startingJobsByLob,
      startingOther: startingJobsOther,
    };

    function lobRows(countObj, other, cardType) {
      let rows = LOBS.map(function (l) {
        const n = countObj[l] || 0;
        const color = LOB_COLORS[l];
        return (
          '<div class="status-lob-row" data-drill="' +
          cardType +
          "|" +
          l +
          '">' +
          '<span style="display:flex;align-items:center;gap:5px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' +
          color +
          ';display:inline-block;flex-shrink:0;"></span>' +
          '<span style="font-weight:600;color:#374151;">' +
          l +
          "</span></span>" +
          '<span class="status-count' +
          (n === 0 ? " status-count-zero" : "") +
          '">' +
          n +
          "</span>" +
          "</div>"
        );
      }).join("");
      if (other > 0) {
        rows +=
          '<div class="status-lob-row" data-drill="' +
          cardType +
          '|OTHER"><span style="color:#6b7280;">Other</span><span class="status-count">' +
          other +
          "</span></div>";
      }
      return rows;
    }

    // Estimated Utilization — current week (week index 0, computed inline before weekUtil is fully built)
    const curWeekStart = new Date(baseMonday);
    const curWeekFri = new Date(curWeekStart);
    curWeekFri.setDate(curWeekFri.getDate() + 4);
    const cwMonStr = curWeekStart.getMonth() + 1 + "/" + curWeekStart.getDate();
    const cwFriStr =
      curWeekFri.getMonth() !== curWeekStart.getMonth()
        ? curWeekFri.getMonth() + 1 + "/" + curWeekFri.getDate()
        : String(curWeekFri.getDate());
    const curWeekLabel = cwMonStr + "-" + cwFriStr;
    const TRACKS = [
      { key: "social", label: "Social Dev", cap: TEAM_CAPACITY.socialPerWeek },
      {
        key: "display",
        label: "Display Dev",
        cap: TEAM_CAPACITY.displayPerWeek,
      },
      {
        key: "statics",
        label: "Statics Dev",
        cap: TEAM_CAPACITY.staticPerWeek,
      },
      { key: "review", label: "Review", cap: TEAM_CAPACITY.reviewPerWeek },
      { key: "qa", label: "QA", cap: TEAM_CAPACITY.qaPerWeek },
      { key: "cd", label: "CD", cap: TEAM_CAPACITY.cdPerWeek },
    ];
    // Compute current-week hours from visibleJobs snapshot (jobs starting this week for dev tracks)
    const cwHours = {
      social: 0,
      display: 0,
      statics: 0,
      review: 0,
      qa: 0,
      cd: 0,
    };
    const cwJobs = {
      social: [],
      display: [],
      statics: [],
      review: [],
      qa: [],
      cd: [],
    };
    const curWeekEnd = new Date(curWeekStart);
    curWeekEnd.setDate(curWeekEnd.getDate() + 6);
    getFilteredJobs().forEach(function (job) {
      if (job.jobType === "Vacation") return;
      const h = computeJobHours(job);
      if (
        job.startDate &&
        job.startDate >= curWeekStart &&
        job.startDate <= curWeekEnd
      ) {
        if (h.socialDevH) {
          cwHours.social += h.socialDevH;
          cwJobs.social.push(job);
        }
        if (h.displayDevH) {
          cwHours.display += h.displayDevH;
          cwJobs.display.push(job);
        }
        if (h.staticDevH) {
          cwHours.statics += h.staticDevH;
          cwJobs.statics.push(job);
        }
        if (h.reviewH) {
          cwHours.review += h.reviewH;
          cwJobs.review.push(job);
        }
        if (h.qaH) {
          cwHours.qa += h.qaH;
          cwJobs.qa.push(job);
        }
        if (h.cdH) {
          cwHours.cd += h.cdH;
          cwJobs.cd.push(job);
        }
      }
    });
    // Store utilization job lists for drill-down clicks
    statusBoardEl._utilData = cwJobs;
    function utilRow(track) {
      const used = cwHours[track.key] || 0;
      const cap = track.cap || 1;
      const pct = Math.min(Math.round((used / cap) * 100), 999);
      const color = pct >= 90 ? "#dc2626" : pct >= 65 ? "#b45309" : "#16a34a";
      const barW = Math.min(pct, 100);
      return (
        '<div class="status-lob-row" data-util-track="' +
        track.key +
        '" data-util-label="' +
        track.label +
        '" style="display:flex;align-items:center;gap:6px;padding:4px 2px;cursor:pointer;" title="Click to see jobs">' +
        '<span style="min-width:72px;font-size:0.75rem;font-weight:600;color:#374151;">' +
        track.label +
        "</span>" +
        '<div style="flex:1;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;">' +
        '<div style="height:100%;width:' +
        barW +
        "%;background:" +
        color +
        ';border-radius:3px;"></div>' +
        "</div>" +
        '<span style="min-width:34px;text-align:right;font-size:0.75rem;font-weight:700;color:' +
        color +
        ';">' +
        pct +
        "%</span>" +
        "</div>"
      );
    }

    statusBoardEl.innerHTML =
      '<div class="status-board">' +
      '<div class="status-card">' +
      '<div class="status-card-title"><span style="display:inline-block;background:#7C3AED;color:#fff;font-size:0.6rem;font-weight:800;padding:2px 8px;border-radius:20px;letter-spacing:0.07em;vertical-align:middle;margin-right:5px;">NEW</span>Jobs (Last 48h)</div>' +
      lobRows(newByLob, newOther, "new") +
      "</div>" +
      '<div class="status-card">' +
      `<div class="status-card-title"><img src="${SS_API.brandUrl}CalendarIcon.svg" alt="" style="height:2.5em;width:auto;vertical-align:middle;margin-right:5px;opacity:0.7;">Starting This Week</div>` +
      lobRows(startingByLob, startingOther, "starting") +
      "</div>" +
      '<div class="status-card" style="min-width:210px;">' +
      '<div class="status-card-title">&#x26A1; Est. Weekly Utilization: Week of ' +
      curWeekLabel +
      "</div>" +
      TRACKS.map(utilRow).join("") +
      "</div>" +
      "</div>";
  }
  // ── End Status Board ─────────────────────────────────────────────────────
  const weekUtil = [];
  const horizonEnd = new Date(baseMonday);
  horizonEnd.setDate(horizonEnd.getDate() + weeksCount * 7 - 1);

  for (let w = 0; w < weeksCount; w++) {
    const ws = new Date(baseMonday);
    ws.setDate(ws.getDate() + w * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    weekUtil.push({
      start: ws,
      end: we,
      social: 0,
      socialJobs: [],
      display: 0,
      displayJobs: [],
      statics: 0,
      staticsJobs: [],
      review: 0,
      reviewJobs: [],
      qa: 0,
      qaJobs: [],
      cd: 0,
      cdJobs: [],
    });
  }

  const visibleJobs = getFilteredJobs();

  // Vacation capacity adjustments (all jobs, unaffected by filters)
  const vacationCapAdj = Array.from({ length: weeksCount }, () => ({
    social: 0,
    display: 0,
    statics: 0,
    review: 0,
    qa: 0,
    cd: 0,
  }));
  jobs.forEach((job) => {
    if (job.jobType !== "Vacation") return;
    const vacStart = job.startDate;
    const vacEnd = job.cdDate || job.startDate;
    if (!vacStart || !vacEnd) return;
    const track = (job.vacationTrack || "all").toLowerCase();
    for (let w = 0; w < weeksCount; w++) {
      const ws = weekUtil[w].start;
      const weFri = new Date(ws);
      weFri.setDate(ws.getDate() + 4);
      const oStart = vacStart > ws ? vacStart : ws;
      const oEnd = vacEnd < weFri ? vacEnd : weFri;
      let workdays = 0;
      if (oStart <= oEnd) {
        const d = new Date(oStart);
        while (d <= oEnd) {
          const dow = d.getDay();
          if (dow >= 1 && dow <= 5) workdays++;
          d.setDate(d.getDate() + 1);
        }
      }
      if (!workdays) continue;
      // Use actual person hours (8h/day) rather than a fraction of team capacity
      const personHours = workdays * 8;
      const adj = vacationCapAdj[w];
      if (track === "all" || track === "social" || track === "social+display")
        adj.social += personHours;
      if (track === "all" || track === "display" || track === "social+display")
        adj.display += personHours;
      if (track === "all" || track === "statics" || track === "static")
        adj.statics += personHours;
      if (track === "all" || track === "review") adj.review += personHours;
      if (track === "all" || track === "qa") adj.qa += personHours;
      if (track === "all" || track === "cd") adj.cd += personHours;
    }
  });

  // Per-week assignee utilization: array of Maps keyed by assignee name
  const assigneeWeekUtil = Array.from({ length: weeksCount }, () => new Map());

  visibleJobs.forEach((job) => {
    const hours = computeJobHours(job);

    // Dev work (Social, Display, Statics) is tied to the START DATE week
    if (job.startDate) {
      const sd = new Date(
        job.startDate.getFullYear(),
        job.startDate.getMonth(),
        job.startDate.getDate()
      );
      if (sd >= baseMonday && sd <= horizonEnd) {
        const diffDev = Math.floor((sd - baseMonday) / (1000 * 60 * 60 * 24));
        const devWeekIdx = Math.floor(diffDev / 7);
        if (devWeekIdx >= 0 && devWeekIdx < weekUtil.length) {
          const devBucket = weekUtil[devWeekIdx];
          const jn = job.name || "Untitled";
          if (hours.socialDevH) {
            devBucket.social += hours.socialDevH;
            devBucket.socialJobs.push({ jobName: jn, hours: hours.socialDevH });
          }
          if (hours.displayDevH) {
            devBucket.display += hours.displayDevH;
            devBucket.displayJobs.push({
              jobName: jn,
              hours: hours.displayDevH,
            });
          }
          if (hours.staticDevH) {
            devBucket.statics += hours.staticDevH;
            devBucket.staticsJobs.push({
              jobName: jn,
              hours: hours.staticDevH,
            });
          }
          if (hours.reviewH) {
            devBucket.review += hours.reviewH;
            devBucket.reviewJobs.push({ jobName: jn, hours: hours.reviewH });
          }
          if (hours.qaH) {
            devBucket.qa += hours.qaH;
            devBucket.qaJobs.push({ jobName: jn, hours: hours.qaH });
          }
        }
      }
    }

    // CD work is tied to the CD date week, or Live date if CD is missing,
    // and finally Start date as a last fallback
    const cdAnchor = job.cdDate || job.liveDate || job.startDate;
    if (cdAnchor) {
      const cdDay = new Date(
        cdAnchor.getFullYear(),
        cdAnchor.getMonth(),
        cdAnchor.getDate()
      );
      if (cdDay >= baseMonday && cdDay <= horizonEnd) {
        const diffCd = Math.floor((cdDay - baseMonday) / (1000 * 60 * 60 * 24));
        const cdWeekIdx = Math.floor(diffCd / 7);
        if (cdWeekIdx >= 0 && cdWeekIdx < weekUtil.length) {
          const cdBucket = weekUtil[cdWeekIdx];
          if (hours.cdH) {
            cdBucket.cd += hours.cdH;
            cdBucket.cdJobs.push({
              jobName: job.name || "Untitled",
              hours: hours.cdH,
            });
          }
        }
      }
    }

    // Aggregate hours by individual assignee per week
    function addAssigneeHoursForWeek(weekIdx, field, fieldHours, trackLabel) {
      if (weekIdx == null || weekIdx < 0 || weekIdx >= assigneeWeekUtil.length)
        return;
      const raw = (job[field] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!raw.length || !fieldHours) return;
      const share = fieldHours / raw.length;
      const weekMap = assigneeWeekUtil[weekIdx];
      raw.forEach((name) => {
        const entry = weekMap.get(name) || { hours: 0, jobs: [] };
        entry.hours += share;
        entry.jobs.push({
          jobId: job.id,
          jobName: job.name,
          track: trackLabel,
          hours: share,
        });
        weekMap.set(name, entry);
      });
    }

    // Dev + review + QA hours go into the dev week; CD hours into the CD week
    if (job.startDate) {
      const sd = new Date(
        job.startDate.getFullYear(),
        job.startDate.getMonth(),
        job.startDate.getDate()
      );
      if (sd >= baseMonday && sd <= horizonEnd) {
        const diffDev = Math.floor((sd - baseMonday) / (1000 * 60 * 60 * 24));
        const devWeekIdx = Math.floor(diffDev / 7);
        if (devWeekIdx >= 0 && devWeekIdx < weekUtil.length) {
          addAssigneeHoursForWeek(
            devWeekIdx,
            "assigneeSocial",
            hours.socialDevH,
            "Social"
          );
          addAssigneeHoursForWeek(
            devWeekIdx,
            "assigneeDisplay",
            hours.displayDevH,
            "Display"
          );
          addAssigneeHoursForWeek(
            devWeekIdx,
            "assigneeStatic",
            hours.staticDevH,
            "Static"
          );
          addAssigneeHoursForWeek(
            devWeekIdx,
            "assigneeReview",
            hours.reviewH,
            "Review"
          );
          addAssigneeHoursForWeek(
            devWeekIdx,
            "assigneeAd",
            hours.qaH,
            "Creative"
          );
          addAssigneeHoursForWeek(
            devWeekIdx,
            "assigneeQa",
            hours.reviewH,
            "Proofing"
          );
          addAssigneeHoursForWeek(devWeekIdx, "assigneeCd", hours.cdH, "QA");
        }
      }
    }

    if (cdAnchor) {
      const cdDay = new Date(
        cdAnchor.getFullYear(),
        cdAnchor.getMonth(),
        cdAnchor.getDate()
      );
      if (cdDay >= baseMonday && cdDay <= horizonEnd) {
        const diffCd = Math.floor((cdDay - baseMonday) / (1000 * 60 * 60 * 24));
        const cdWeekIdx = Math.floor(diffCd / 7);
        if (cdWeekIdx >= 0 && cdWeekIdx < weekUtil.length) {
          // assigneeCd (QA) attribution is handled in the dev week block above;
          // this block now handles only the Content Delivery person (assigneeContent).
          addAssigneeHoursForWeek(
            cdWeekIdx,
            "assigneeContent",
            hours.cdH,
            "CD"
          );
        }
      }
    }
  });

  if (
    capacityEl &&
    weekUtil.length > 0 &&
    visibleJobs.length > 0 &&
    !isViewRole(currentUserRole)
  ) {
    const vacAdjKeyMap = {
      Social: "social",
      Display: "display",
      Statics: "statics",
      "Creative Review": "review",
      "Quality Assurance": "qa",
      "Content Delivery": "cd",
    };
    function utilCell(used, cap, jobs, trackKey, wi) {
      if (!used) return '<td class="util-cell-empty">—</td>';
      const adjKey = vacAdjKeyMap[trackKey];
      const vacAdj =
        adjKey && vacationCapAdj[wi] ? vacationCapAdj[wi][adjKey] || 0 : 0;
      const effectiveCap = Math.max(0, cap - vacAdj);
      const pct = effectiveCap ? Math.round((used / effectiveCap) * 100) : 0;
      const cls =
        pct >= 75
          ? "util-cell-high"
          : pct >= 50
          ? "util-cell-mid"
          : "util-cell-low";
      const over = effectiveCap && used > effectiveCap;
      const bkey = "track||" + trackKey + "||" + wi;
      const wLabel =
        "WK " +
        (wi + 1) +
        ": " +
        weekUtil[wi].start.toLocaleDateString(undefined, {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        });
      _assigneeBreakdown[bkey] = {
        name: trackKey,
        weekLabel: wLabel,
        jobs: (jobs || []).map((j) => ({
          jobName: j.jobName,
          track: trackKey,
          hours: j.hours,
        })),
      };
      return `<td class="${cls}" style="cursor:pointer;" data-breakdown-key="${bkey}">${Math.round(
        used
      )}/${effectiveCap} (${pct}%)${
        over
          ? ' <span style="font-size:0.7rem;">+' +
            Math.round(used - effectiveCap) +
            "h</span>"
          : ""
      }${
        vacAdj
          ? ' <span style="font-size:0.65rem; opacity:0.7;">(-' +
            vacAdj +
            "h PTO)</span>"
          : ""
      }</td>`;
    }
    const wkHeaders = weekUtil
      .map(
        (w, i) =>
          `<th>WK ${i + 1}: ${w.start.toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
            year: "numeric",
          })}</th>`
      )
      .join("");
    const html = `<table class="util-table">
          <thead><tr><th>Est. Weekly Utilization</th>${wkHeaders}</tr></thead>
          <tbody>
            <tr><td>Social</td>${weekUtil
              .map((w, wi) =>
                utilCell(
                  w.social,
                  TEAM_CAPACITY.socialPerWeek,
                  w.socialJobs,
                  "Social",
                  wi
                )
              )
              .join("")}</tr>
            <tr><td>Display</td>${weekUtil
              .map((w, wi) =>
                utilCell(
                  w.display,
                  TEAM_CAPACITY.displayPerWeek,
                  w.displayJobs,
                  "Display",
                  wi
                )
              )
              .join("")}</tr>
            <tr><td>Statics</td>${weekUtil
              .map((w, wi) =>
                utilCell(
                  w.statics,
                  TEAM_CAPACITY.staticPerWeek,
                  w.staticsJobs,
                  "Statics",
                  wi
                )
              )
              .join("")}</tr>
            <tr><td>Creative Review</td>${weekUtil
              .map((w, wi) =>
                utilCell(
                  w.review,
                  TEAM_CAPACITY.reviewPerWeek,
                  w.reviewJobs,
                  "Creative Review",
                  wi
                )
              )
              .join("")}</tr>
            <tr><td>Quality Assurance</td>${weekUtil
              .map((w, wi) =>
                utilCell(
                  w.qa,
                  TEAM_CAPACITY.qaPerWeek,
                  w.qaJobs,
                  "Quality Assurance",
                  wi
                )
              )
              .join("")}</tr>
            <tr><td>Content Delivery</td>${weekUtil
              .map((w, wi) =>
                utilCell(
                  w.cd,
                  TEAM_CAPACITY.cdPerWeek,
                  w.cdJobs,
                  "Content Delivery",
                  wi
                )
              )
              .join("")}</tr>
          </tbody>
        </table>`;
    capacityEl.innerHTML = html;
  }

  // Per-assignee utilization by week (using filtered jobs only)
  if (assigneeEl && !isViewRole(currentUserRole)) {
    let hasAny = false;
    assigneeWeekUtil.forEach((map) => {
      if (map.size > 0) hasAny = true;
    });

    if (!hasAny) {
      assigneeEl.innerHTML =
        '<div style="padding:8px 10px; font-size:0.8rem; color:var(--muted);">No assignee bookings in current window.</div>';
    } else {
      const allAssignees = new Set();
      assigneeWeekUtil.forEach((map) =>
        map.forEach((_, name) => allAssignees.add(name))
      );
      const sortedAssignees = Array.from(allAssignees).sort();
      function assigneeCell(name, weekMap, wi) {
        const data = weekMap.get(name);
        if (!data || !data.hours) return '<td class="util-cell-empty">—</td>';
        const used = data.hours;
        const cap = ASSIGNEE_CAPACITY[name] ?? DEFAULT_ASSIGNEE_WEEKLY_CAPACITY;
        const pct = cap ? Math.round((used / cap) * 100) : 0;
        const over = cap && used > cap;
        const cls =
          pct >= 75
            ? "util-cell-high"
            : pct >= 50
            ? "util-cell-mid"
            : "util-cell-low";
        // Store breakdown data for modal
        const key = name + "||" + wi;
        _assigneeBreakdown[key] = {
          name,
          weekLabel:
            "WK " +
            (wi + 1) +
            ": " +
            weekUtil[wi].start.toLocaleDateString(undefined, {
              month: "numeric",
              day: "numeric",
              year: "numeric",
            }),
          jobs: data.jobs || [],
        };
        return `<td class="${cls}" style="cursor:pointer;" data-breakdown-key="${key}">${Math.round(
          used
        )}/${cap} (${pct}%)${
          over
            ? ' <span style="font-size:0.7rem;">+' +
              Math.round(used - cap) +
              "h</span>"
            : ""
        }</td>`;
      }
      const wkHeaders = weekUtil
        .map(
          (w, i) =>
            `<th>WK ${i + 1}: ${w.start.toLocaleDateString(undefined, {
              month: "numeric",
              day: "numeric",
              year: "numeric",
            })}</th>`
        )
        .join("");
      const html = `<table class="util-table">
            <thead><tr><th>Resource Utilization</th>${wkHeaders}</tr></thead>
            <tbody>${sortedAssignees
              .map(
                (name) =>
                  `<tr><td>${name}</td>${assigneeWeekUtil
                    .map((weekMap, wi) => assigneeCell(name, weekMap, wi))
                    .join("")}</tr>`
              )
              .join("")}</tbody>
          </table>`;
      assigneeEl.innerHTML = html;
    }
  }

  // Scheduled Time Off panel
  const timeOffEl = document.getElementById("timeOffSummary");
  if (timeOffEl) {
    const vacJobs = jobs.filter((j) => j.jobType === "Vacation" && j.startDate);
    const windowVac = vacJobs.filter((j) => {
      const vs = j.startDate;
      const ve = j.liveDate || j.cdDate || vs;
      return vs <= horizonEnd && ve >= baseMonday;
    });
    if (!windowVac.length) {
      timeOffEl.style.display = "none";
    } else {
      function countWorkdays(start, end) {
        let count = 0;
        const d = new Date(start);
        while (d <= end) {
          const dow = d.getDay();
          if (dow >= 1 && dow <= 5) count++;
          d.setDate(d.getDate() + 1);
        }
        return count;
      }
      const toRows = windowVac
        .map((j) => {
          const vs = j.startDate ? j.startDate.toLocaleDateString() : "—";
          const veDate = j.cdDate || j.startDate;
          const ve = veDate ? veDate.toLocaleDateString() : "—";
          const trk = j.vacationTrack
            ? j.vacationTrack.charAt(0).toUpperCase() + j.vacationTrack.slice(1)
            : "All";
          const days = countWorkdays(j.startDate, veDate);
          const hrs = days * 8;
          return `<tr><td style="padding:6px 10px; font-weight:600;">${
            j.name || "Unknown"
          }</td><td style="padding:6px 10px;">${trk}</td><td style="padding:6px 10px;">${vs}</td><td style="padding:6px 10px;">${ve}</td><td style="padding:6px 10px; text-align:right;">${days}d / ${hrs}h</td></tr>`;
        })
        .join("");
      timeOffEl.style.display = "";
      timeOffEl.innerHTML = `<table class="util-table"><thead><tr><th style="padding:6px 10px;">Scheduled Time Off</th><th style="padding:6px 10px;">Function</th><th style="padding:6px 10px;">From</th><th style="padding:6px 10px;">To</th><th style="padding:6px 10px; text-align:right;">Days / Hours</th></tr></thead><tbody>${toRows}</tbody></table>`;
    }
  }

  // ── Unscheduled / out-of-window jobs panel ──────────────────────────────
  // Only jobs with NO dates at all go here; dated jobs live on the calendar.
  const unscheduled = visibleJobs.filter(function (job) {
    return !job.startDate && !job.cdDate && !job.liveDate;
  });
  const unscheduledPanel = document.getElementById("unscheduledPanel");
  if (unscheduledPanel) {
    if (unscheduled.length === 0 || isViewRole(currentUserRole)) {
      unscheduledPanel.style.display = "none";
      unscheduledPanel.innerHTML = "";
    } else {
      unscheduledPanel.style.display = "";
      const rows = unscheduled
        .map(function (job) {
          const lob = job.lob
            ? '<span class="' +
              getLobBadgeClass(job.lob) +
              '" style="margin-right:6px;">' +
              job.lob +
              "</span>"
            : "";
          const startFmt = job.startDate
            ? job.startDate.toLocaleDateString(undefined, {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "—";
          const cdFmt = job.cdDate
            ? job.cdDate.toLocaleDateString(undefined, {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "—";
          const liveFmt = job.liveDate
            ? job.liveDate.toLocaleDateString(undefined, {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "—";
          const editBtn =
            '<button type="button" style="font-size:0.7rem;padding:2px 8px;border-radius:4px;border:1px solid #009FDB;background:#fff;color:#00388F;cursor:pointer;" data-edit-id="' +
            job.id +
            '">Edit</button>';
          return (
            '<tr style="border-bottom:1px solid #f3f4f6;">' +
            '<td style="padding:5px 10px;font-size:0.8rem;font-weight:500;white-space:nowrap;">' +
            lob +
            job.name +
            "</td>" +
            '<td style="padding:5px 10px;font-size:0.78rem;color:#6b7280;">' +
            (job.producer || "—") +
            "</td>" +
            '<td style="padding:5px 10px;font-size:0.78rem;color:#6b7280;">' +
            startFmt +
            "</td>" +
            '<td style="padding:5px 10px;font-size:0.78rem;color:#6b7280;">' +
            cdFmt +
            "</td>" +
            '<td style="padding:5px 10px;font-size:0.78rem;color:#6b7280;">' +
            liveFmt +
            "</td>" +
            '<td style="padding:5px 10px;">' +
            editBtn +
            "</td>" +
            "</tr>"
          );
        })
        .join("");
      unscheduledPanel.innerHTML =
        '<div style="font-size:0.72rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.07em;padding:8px 10px 4px;border-bottom:1px solid #e5e7eb;">' +
        "Unscheduled / Beyond Window (" +
        unscheduled.length +
        ")</div>" +
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#f9fafb;">' +
        '<th style="text-align:left;padding:5px 10px;font-size:0.7rem;color:#6b7280;font-weight:700;">Job</th>' +
        '<th style="text-align:left;padding:5px 10px;font-size:0.7rem;color:#6b7280;font-weight:700;">Producer</th>' +
        '<th style="text-align:left;padding:5px 10px;font-size:0.7rem;color:#6b7280;font-weight:700;">Start</th>' +
        '<th style="text-align:left;padding:5px 10px;font-size:0.7rem;color:#6b7280;font-weight:700;">CD</th>' +
        '<th style="text-align:left;padding:5px 10px;font-size:0.7rem;color:#6b7280;font-weight:700;">Media H/O</th>' +
        '<th style="padding:5px 10px;"></th>' +
        "</tr></thead>" +
        "<tbody>" +
        rows +
        "</tbody></table></div>";
      // Wire edit buttons
      unscheduledPanel
        .querySelectorAll("button[data-edit-id]")
        .forEach(function (btn) {
          btn.addEventListener("click", function () {
            const id = Number(btn.getAttribute("data-edit-id"));
            const job = jobs.find(function (j) {
              return j.id === id;
            });
            if (!job) return;
            openJobInStatusReport(job.id);
          });
        });
    }
  }
  // ── End unscheduled panel ─────────────────────────────────────────────────

  if (visibleJobs.length === 0) {
    // Render a single empty week header so the calendar still shows structure
    const headerDays = makeDayRange(baseMonday, 5);
    const header = document.createElement("div");
    header.className = "schedule-header";
    headerDays.forEach((d) => {
      const col = document.createElement("div");
      col.textContent = formatDayLabel(d);
      header.appendChild(col);
    });
    grid.appendChild(header);

    const empty = document.createElement("div");
    empty.className = "schedule-row";
    const msg = document.createElement("div");
    msg.textContent =
      "No jobs match the current filters. Adjust filters or add a job on the input tab.";
    msg.style.gridColumn = "1 / span 5";
    empty.appendChild(msg);
    grid.appendChild(empty);
    return;
  }

  // For each week: render header, then all job rows for that week
  for (let w = 0; w < weeksCount; w++) {
    const weekStart = new Date(baseMonday);
    weekStart.setDate(weekStart.getDate() + w * 7);
    const weekDays = makeDayRange(weekStart, 5);

    const header = document.createElement("div");
    header.className = "schedule-header";
    weekDays.forEach((d) => {
      const col = document.createElement("div");
      col.textContent = formatDayLabel(d);
      header.appendChild(col);
    });
    grid.appendChild(header);

    visibleJobs.forEach((job, index) => {
      // Dateless jobs belong ONLY in the unscheduled panel — skip them here
      if (!job.startDate && !job.cdDate && !job.liveDate) return;

      const rawStart = job.startDate || job.cdDate || job.liveDate;
      const rawEnd = job.liveDate || job.cdDate || rawStart;

      const jobStart = new Date(
        rawStart.getFullYear(),
        rawStart.getMonth(),
        rawStart.getDate()
      );
      const jobEnd = new Date(
        rawEnd.getFullYear(),
        rawEnd.getMonth(),
        rawEnd.getDate()
      );

      let startIdx = null;
      let endIdx = null;
      weekDays.forEach((day, idx) => {
        const dayNorm = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate()
        );
        if (dayNorm >= jobStart && dayNorm <= jobEnd) {
          if (startIdx === null) startIdx = idx;
          endIdx = idx;
        }
      });

      if (startIdx === null || endIdx === null) return;

      const row = document.createElement("div");
      row.className = "schedule-row";
      const cells = [];
      weekDays.forEach(() => {
        const cell = document.createElement("div");
        row.appendChild(cell);
        cells.push(cell);
      });

      grid.appendChild(row);

      const firstCell = cells[startIdx];
      const lastCell = cells[endIdx];
      if (!firstCell || !lastCell) return;

      const isVacBar = job.jobType === "Vacation";
      const bar = document.createElement("div");
      bar.className = "job-bar" + (isVacBar ? " vacation-bar" : "");
      const cdLabel = formatDateForBar(job.cdDate);
      const liveLabel = formatDateForBar(job.liveDate);
      const jobTypeLabel = job.jobType || "";
      const lobLabel = job.lob || "";
      const typeAbbr =
        {
          Adapt: "ADP",
          Adopt: "CAA",
          AssetOrigination: "AO",
          AdHocRequest: "AHR",
          ContentDeliveryOnly: "CDO",
          "Creative Adaptation/Adoption": "CAA",
          "Creative Origination": "AO",
          "Trafficking Only": "CDO",
        }[jobTypeLabel] || jobTypeLabel;
      const isNew =
        job.createdAt &&
        Date.now() - new Date(job.createdAt).getTime() < 48 * 60 * 60 * 1000;
      if (isVacBar) {
        const vacLabel = job.vacationPerson ? job.vacationPerson : job.name;
        bar.innerHTML = `<span class="vac-badge">VAC</span>${vacLabel}  ·  ${formatDateForBar(
          job.startDate
        )} – ${liveLabel || formatDateForBar(job.cdDate)}`;
      } else {
        const pBadge = job.priority
          ? `<span class="priority-badge priority-${Number(job.priority)}">P${
              job.priority
            }</span>`
          : "";
        const lBadge = lobLabel
          ? `<span class="${getLobBadgeClass(lobLabel)}">${lobLabel}</span>`
          : "";
        const tBadge = typeAbbr
          ? `<span class="type-badge">${typeAbbr}</span>`
          : "";
        const newBadge = isNew ? '<span class="new-badge">New</span>' : "";
        const totalA = job.totalAssets ? ` · ${job.totalAssets} assets` : "";
        // Phase badge
        const PHASE_ABBR = {
          Discovery: "DISC",
          "Pre-Production": "PRE",
          "In Production": "PROD",
          "Post-Production": "POST",
          "Project Closeout": "CLSE",
          Completed: "DONE",
          Canceled: "CNCL",
        };
        const phaseAbbr = PHASE_ABBR[job.phase] || "";
        const phaseBadge = phaseAbbr
          ? `<span style="font-size:0.6rem;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(0,0,0,0.15);color:inherit;margin-right:3px;">${phaseAbbr}</span>`
          : "";
        // % progress bar overlay
        const pct = parseFloat(job.projectPct) || 0;
        const pctBar =
          pct > 0
            ? `<span style="position:absolute;bottom:0;left:0;height:3px;width:${Math.min(
                pct,
                100
              )}%;background:rgba(0,56,143,0.45);border-radius:0 0 0 4px;"></span>`
            : "";
        const barText = `${job.name}  ·  CD ${cdLabel}  ·  Media ${liveLabel}${totalA}`;
        bar.style.position = "relative";
        bar.style.overflow = "hidden";
        bar.innerHTML =
          newBadge + pBadge + lBadge + tBadge + phaseBadge + barText + pctBar;
      }
      bar.setAttribute("data-job-id", String(job.id));
      bar.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openJobModal(job);
      });

      const barClass = getJobBarClass(job);
      if (!bar.classList.contains("vacation-bar")) bar.classList.add(barClass);

      // Dim bars where the logged-in user is not assigned — anyone who isn't admin or manager
      if (currentUserRole !== "admin" && currentUserRole !== "manager") {
        const me = (currentUserName || "").trim().toLowerCase();
        const ROLE_FIELDS = {
          "view-dev": [
            job.assigneeSocial,
            job.assigneeDisplay,
            job.assigneeStatic,
          ],
          "view-designer": [
            job.assigneeSocial,
            job.assigneeDisplay,
            job.assigneeStatic,
          ],
          "view-creative": [job.assigneeReview],
          "view-proofing": [job.assigneeQa],
          "view-qa": [job.assigneeQa],
          "view-cd": [job.assigneeCd],
          "view-marketer": [job.marketer],
        };
        const fields = ROLE_FIELDS[currentUserRole] || [
          job.assigneeSocial,
          job.assigneeDisplay,
          job.assigneeStatic,
          job.assigneeReview,
          job.assigneeQa,
          job.assigneeCd,
          job.marketer,
          job.producer,
          job.cp,
        ];
        const inMyLob =
          currentUserLobs.length === 0 ||
          currentUserLobs.includes((job.lob || "").toUpperCase());
        // Debug: log once per render for first job only
        if (job === visibleJobs[0]) {
          console.group("🔍 Role Debug");
          console.log("Login name:", JSON.stringify(currentUserName));
          console.log("Role:", currentUserRole, "| LOBs:", currentUserLobs);
          console.log("me (lower):", me);
          console.log("inMyLob:", inMyLob, "| fields:", fields);
          console.log(
            "users list:",
            users.length ? users : "(empty — bootstrap mode)"
          );
          console.groupEnd();
        }
        if (me && me !== "unknown") {
          const isAssigned =
            inMyLob &&
            fields.some((f) => {
              const fLower = (f || "").trim().toLowerCase();
              if (!fLower) return false;
              return (
                fLower === me || fLower.includes(me) || me.includes(fLower)
              );
            });
          if (!isAssigned) {
            bar.style.opacity = "0.28";
            bar.style.filter = "grayscale(0.6)";
          }
        }
      } else if (job.phase === "Completed") {
        bar.style.opacity = "0.38";
        bar.style.filter = "grayscale(0.7)";
      }

      row.appendChild(bar);

      // Position after row is in the DOM so offsetLeft/offsetWidth are real
      requestAnimationFrame(() => {
        const left = firstCell.offsetLeft + 3;
        const right = lastCell.offsetLeft + lastCell.offsetWidth - 3;
        bar.style.left = left + "px";
        bar.style.width = right - left + "px";
      });
    });
  }
}
 window.renderSchedule   = renderSchedule;

// Tab switching between Input and Calendar
const inputView = document.getElementById("inputView");
const calendarView = document.getElementById("calendarView");
const tabButtons = document.querySelectorAll(".tab-bar .tab");
const jobModal = document.getElementById("jobModal");
const jobModalCloseBtn = document.getElementById("jobModalCloseBtn");
const jobModalEditBtn = document.getElementById("jobModalEditBtn");
const jobModalDeleteBtn = document.getElementById("jobModalDeleteBtn");
const filterLob = document.getElementById("filterLob");
const filterJobType = document.getElementById("filterJobType");
const filterJobName = document.getElementById("filterJobName");
const filterPhase = document.getElementById("filterPhase");
const filterResource = document.getElementById("filterResource");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const importJsonFile = document.getElementById("importJsonFile");

function getFilteredJobs() {
  const lobVal = ((filterLob && filterLob.value) || "").trim().toLowerCase();
  const typeVal = ((filterJobType && filterJobType.value) || "").trim();
  const jobNameVal = ((filterJobName && filterJobName.value) || "")
    .trim()
    .toLowerCase();
  const phaseVal = ((filterPhase && filterPhase.value) || "").trim();
  const resourceVal = ((filterResource && filterResource.value) || "")
    .trim()
    .toLowerCase();

  return jobs.filter((job) => {
    if (lobVal) {
      const jobLob = (job.lob || "").toLowerCase();
      if (!jobLob.startsWith(lobVal)) return false;
    }
    if (typeVal) {
      if ((job.jobType || "") !== typeVal) return false;
    }
    if (jobNameVal) {
      const name = (job.name || "").toLowerCase();
      if (!name.includes(jobNameVal)) return false;
    }
    if (phaseVal === "active") {
      const activePhases = ["Discovery", "Pre-Production", "In Production"];
      if (!activePhases.includes(job.phase || "")) return false;
    } else if (phaseVal) {
      if ((job.phase || "") !== phaseVal) return false;
    }
    if (resourceVal) {
      const assignees = [
        job.assigneeSocial,
        job.assigneeDisplay,
        job.assigneeStatic,
        job.assigneeAd,
        job.assigneeReview,
        job.assigneeQa,
        job.assigneeCd,
        job.assigneeContent,
        job.producer,
        job.cp,
        job.marketer,
      ].map((v) => (v || "").toLowerCase());
      if (!assignees.some((a) => a.includes(resourceVal))) return false;
    }
    return true;
  });
}

function exportScheduleToJson() {
  try {
    const payload = buildStatePayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    const userSlug = (currentUserName || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    a.download = `studio-schedule-${dateStamp}-${userSlug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Failed to export schedule JSON", e);
    alert("Unable to export schedule JSON.");
  }
}

function handleImportJsonFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const payload = JSON.parse(text);
      if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray(payload.jobs)
      ) {
        alert("Selected file does not look like a scheduler JSON export.");
        return;
      }
      applyLoadedState(payload, { fromEmbedded: false });
      saveStateToStorage();
      renderSchedule();
      showView("calendar");
    } catch (e) {
      console.error("Failed to import schedule JSON", e);
      alert("Unable to import schedule JSON.");
    } finally {
      // Allow selecting the same file again later
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function mergeFromJson(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || ""));
      if (!payload || !Array.isArray(payload.jobs)) {
        alert("Selected file does not look like a scheduler JSON export.");
        return;
      }
      const existingIds = new Set(jobs.map((j) => String(j.id)));
      let added = 0;
      payload.jobs.forEach((incoming) => {
        // Reconstruct date objects
        const j = {
          ...incoming,
          startDate: incoming.startDate ? new Date(incoming.startDate) : null,
          cdDate: incoming.cdDate ? new Date(incoming.cdDate) : null,
          liveDate: incoming.liveDate ? new Date(incoming.liveDate) : null,
          createdAt: incoming.createdAt || new Date().toISOString(),
          createdBy: incoming.createdBy || currentUserName || "Merge Import",
        };
        if (!existingIds.has(String(j.id))) {
          jobs.push(j);
          existingIds.add(String(j.id));
          added++;
        }
      });
      saveStateToStorage();
      renderSchedule();
      showView("calendar");
      alert(
        `Merge complete — ${added} new job${added !== 1 ? "s" : ""} added.`
      );
    } catch (e) {
      console.error("Failed to merge schedule JSON", e);
      alert("Unable to merge schedule JSON.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function showView(view) {
  if (!inputView || !calendarView) return;
  const statusReportView = document.getElementById("statusReportView");
  inputView.style.display = "none";
  calendarView.style.display = "none";
  if (statusReportView) statusReportView.style.display = "none";

  if (view === "calendar") {
    calendarView.style.display = "";
    renderSchedule();
  } else if (view === "status") {
    if (statusReportView) {
      statusReportView.style.display = "";
      renderStatusReport();
      renderTeamPanel();
    }
  } else {
    inputView.style.display = "";
  }
  if (document && document.body) {
    document.body.classList.add("input-view");
  }
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    showView(btn.dataset.view || "input");
  });
});

if (filterLob) {
  filterLob.addEventListener("change", renderSchedule);
}
if (filterJobType) {
  filterJobType.addEventListener("change", renderSchedule);
}
if (filterJobName) {
  filterJobName.addEventListener("input", () => {
    renderSchedule();
  });
}
if (filterPhase) {
  filterPhase.addEventListener("change", renderSchedule);
}
if (filterResource) {
  filterResource.addEventListener("input", renderSchedule);
}
if (exportJsonBtn) {
  exportJsonBtn.addEventListener("click", exportScheduleToJson);
}
const mergeJsonBtn = document.getElementById("mergeJsonBtn");
const mergeJsonFile = document.getElementById("mergeJsonFile");
if (mergeJsonBtn && mergeJsonFile) {
  mergeJsonBtn.addEventListener("click", () => {
    mergeJsonFile.click();
  });
  mergeJsonFile.addEventListener("change", mergeFromJson);
}

// Wire importJsonFile (calendar toolbar hidden input)
if (importJsonFile) {
  importJsonFile.addEventListener("change", handleImportJsonFileChange);
}

// Status Report toolbar — Import / Merge / Export JSON
const srImportJsonBtn = document.getElementById("srImportJsonBtn");
const srImportJsonFile = document.getElementById("srImportJsonFile");
const srMergeJsonBtn = document.getElementById("srMergeJsonBtn");
const srMergeJsonFile = document.getElementById("srMergeJsonFile");
const srExportJsonBtn = document.getElementById("srExportJsonBtn");

if (srImportJsonBtn && srImportJsonFile) {
  srImportJsonBtn.addEventListener("click", () => srImportJsonFile.click());
  srImportJsonFile.addEventListener("change", function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || ""));
        if (!payload || !Array.isArray(payload.jobs)) {
          alert("File does not look like a scheduler JSON export.");
          return;
        }
        applyLoadedState(payload, { fromEmbedded: false });
        saveStateToStorage();
        renderStatusReport();
        renderSchedule();
        alert(
          "Imported " +
            payload.jobs.length +
            " job" +
            (payload.jobs.length !== 1 ? "s" : "") +
            "."
        );
      } catch (e) {
        alert("Unable to read JSON file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  });
}

if (srMergeJsonBtn && srMergeJsonFile) {
  srMergeJsonBtn.addEventListener("click", () => srMergeJsonFile.click());
  srMergeJsonFile.addEventListener("change", function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || ""));
        if (!payload || !Array.isArray(payload.jobs)) {
          alert("File does not look like a scheduler JSON export.");
          return;
        }
        const existingIds = new Set(jobs.map((j) => String(j.id)));
        let added = 0;
        payload.jobs.forEach((incoming) => {
          const j = {
            ...incoming,
            startDate: incoming.startDate ? new Date(incoming.startDate) : null,
            cdDate: incoming.cdDate ? new Date(incoming.cdDate) : null,
            liveDate: incoming.liveDate ? new Date(incoming.liveDate) : null,
            goLiveDate: incoming.goLiveDate
              ? new Date(incoming.goLiveDate)
              : null,
          };
          if (!existingIds.has(String(j.id))) {
            jobs.push(j);
            existingIds.add(String(j.id));
            added++;
          }
        });
        saveStateToStorage();
        renderStatusReport();
        renderSchedule();
        alert(
          "Merged — " +
            added +
            " new job" +
            (added !== 1 ? "s" : "") +
            " added."
        );
      } catch (e) {
        alert("Unable to read JSON file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  });
}

if (srExportJsonBtn) {
  srExportJsonBtn.addEventListener("click", exportScheduleToJson);
}

if (jobModalCloseBtn) {
  jobModalCloseBtn.addEventListener("click", closeJobModal);
}
if (jobModal) {
  jobModal.addEventListener("click", (e) => {
    if (e.target === jobModal) {
      closeJobModal();
    }
  });
}
const statusDrillCloseBtn = document.getElementById("statusDrillCloseBtn");
const statusDrillModal = document.getElementById("statusDrillModal");
if (statusDrillCloseBtn)
  statusDrillCloseBtn.addEventListener("click", closeStatusDrillModal);
if (statusDrillModal)
  statusDrillModal.addEventListener("click", function (e) {
    if (e.target === statusDrillModal) closeStatusDrillModal();
  });
document.getElementById("statusBoard").addEventListener("click", function (e) {
  // LOB drill-down (New Jobs / Starting This Week)
  const drillRow = e.target.closest("[data-drill]");
  if (drillRow) {
    const parts = drillRow.getAttribute("data-drill").split("|");
    openStatusDrillModal(parts[0], parts[1]);
    return;
  }
  // Utilization track drill-down
  const utilRow = e.target.closest("[data-util-track]");
  if (utilRow) {
    const track = utilRow.getAttribute("data-util-track");
    const label = utilRow.getAttribute("data-util-label");
    const boardEl = document.getElementById("statusBoard");
    const jobList =
      (boardEl && boardEl._utilData && boardEl._utilData[track]) || [];
    const titleEl = document.getElementById("statusDrillTitle");
    const bodyEl = document.getElementById("statusDrillBody");
    const modal = document.getElementById("statusDrillModal");
    if (!titleEl || !bodyEl || !modal) return;
    titleEl.textContent = "Est. Utilization \u2014 " + label;
    if (!jobList.length) {
      bodyEl.innerHTML =
        '<p style="color:var(--muted);padding:8px 0;">No jobs contributing to this track this week.</p>';
    } else {
      bodyEl.innerHTML =
        '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;table-layout:fixed;">' +
        '<thead><tr style="background:#f9fafb;">' +
        '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:40%;">Job</th>' +
        '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:10%;">LOB</th>' +
        '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:14%;">Start</th>' +
        '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:14%;">CD</th>' +
        '<th style="text-align:left;padding:5px 10px;color:#6b7280;font-weight:700;width:22%;">Producer</th>' +
        "</tr></thead><tbody>" +
        jobList
          .map(function (job) {
            return (
              '<tr style="border-bottom:1px solid #f3f4f6;cursor:pointer;" data-job-id="' +
              job.id +
              '">' +
              '<td style="padding:6px 10px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' +
              (job.name || "") +
              '">' +
              (job.name || "Untitled") +
              "</td>" +
              '<td style="padding:6px 10px;">' +
              (job.lob || "\u2014") +
              "</td>" +
              '<td style="padding:6px 10px;">' +
              (job.startDate ? job.startDate.toLocaleDateString() : "\u2014") +
              "</td>" +
              '<td style="padding:6px 10px;">' +
              (job.cdDate ? job.cdDate.toLocaleDateString() : "\u2014") +
              "</td>" +
              '<td style="padding:6px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
              (job.producer || "\u2014") +
              "</td>" +
              "</tr>"
            );
          })
          .join("") +
        "</tbody></table>";
      bodyEl.querySelectorAll("tr[data-job-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          const id = Number(row.getAttribute("data-job-id"));
          const job = jobs.find(function (j) {
            return j.id === id;
          });
          if (!job) return;
          closeStatusDrillModal();
          openJobModal(job);
        });
      });
    }
    modal.classList.add("show");
  }
});

const assigneeBreakdownCloseBtn = document.getElementById(
  "assigneeBreakdownCloseBtn"
);
if (assigneeBreakdownCloseBtn) {
  assigneeBreakdownCloseBtn.addEventListener(
    "click",
    closeAssigneeBreakdownModal
  );
}
const assigneeBreakdownModal = document.getElementById(
  "assigneeBreakdownModal"
);
if (assigneeBreakdownModal) {
  assigneeBreakdownModal.addEventListener("click", (e) => {
    if (e.target === assigneeBreakdownModal) closeAssigneeBreakdownModal();
  });
}
const assigneeSummaryEl = document.getElementById("assigneeSummary");
if (assigneeSummaryEl) {
  assigneeSummaryEl.addEventListener("click", (e) => {
    const td = e.target.closest("td[data-breakdown-key]");
    if (!td) return;
    openAssigneeBreakdownModal(td.getAttribute("data-breakdown-key"));
  });
}
const capacitySummaryEl = document.getElementById("capacitySummary");
if (capacitySummaryEl) {
  capacitySummaryEl.addEventListener("click", (e) => {
    const td = e.target.closest("td[data-breakdown-key]");
    if (!td) return;
    openAssigneeBreakdownModal(td.getAttribute("data-breakdown-key"));
  });
}
if (jobModalDeleteBtn) {
  jobModalDeleteBtn.addEventListener("click", () => {
    if (currentModalJobId == null) {
      closeJobModal();
      return;
    }
    const job = jobs.find((j) => j.id === currentModalJobId);
    if (!job) {
      closeJobModal();
      return;
    }
    const confirmed = window.confirm(
      `Delete job "${job.name || "Untitled Job"}" from the schedule?`
    );
    if (!confirmed) return;

    const idx = jobs.findIndex((j) => j.id === currentModalJobId);
    if (idx !== -1) {
      jobs.splice(idx, 1);
    }
    if (editingJobId === currentModalJobId) {
      editingJobId = null;
    }
    currentModalJobId = null;
    closeJobModal();
    renderSchedule();
    saveStateToStorage();
  });
}
if (jobModalEditBtn) {
  jobModalEditBtn.addEventListener("click", () => {
    let job = null;
    if (currentModalJobId != null) {
      job = jobs.find((j) => j.id === currentModalJobId) || null;
    }
    if (!job) {
      const titleEl = document.getElementById("jobModalTitle");
      const name = titleEl ? titleEl.textContent || "" : "";
      if (name) {
        job = jobs.find((j) => j.name === name) || null;
      }
    }
    if (!job) {
      closeJobModal();
      return;
    }
    closeJobModal();
    openEditJobModal(job);
  });
}

const connectFileBtn = document.getElementById("connectFileBtn");
if (connectFileBtn) {
  connectFileBtn.addEventListener("click", connectToDataFile);
}

// ── Excel Import ─────────────────────────────────────────────────────────
const EXCEL_MAP_STORAGE_KEY = "studioSchedulerExcelMap_v2";
let _excelRows = [];
let _excelHeaders = [];
let _excelSheetNames = []; // raw sheet names in the workbook

const SCHED_FIELDS = [
  { value: "", label: "— ignore —" },
  { value: "wfId", label: "Workfront ID" },
  { value: "name", label: "Job Name" },
  { value: "phase", label: "Project Phase" },
  { value: "lob", label: "LOB (BUS / FIB / MOB / FNT)" },
  { value: "jobType", label: "Project Type" },
  { value: "projectTask", label: "Project Task" },
  { value: "startDate", label: "Start Date (Kickoff)" },
  { value: "cdDate", label: "CD Date (Handoff to CD)" },
  { value: "liveDate", label: "Media Hand Off Date (1876 → H+S)" },
  { value: "goLiveDate", label: "Target Go-Live Date" },
  { value: "marketer", label: "Marketer" },
  { value: "cp", label: "Client Partner" },
  { value: "producer", label: "Producer" },
  { value: "mediaPartner", label: "Media Partner" },
  { value: "risk", label: "Risk" },
  { value: "totalAssets", label: "Total Assets" },
  { value: "cdPlacements", label: "CD Placements (Line Count)" },
  { value: "loe", label: "LOE / Complexity" },
  { value: "scopeId", label: "Scope ID" },
  { value: "projectPct", label: "Project % Complete" },
  { value: "cpPct", label: "CP % Complete" },
  { value: "producerPct", label: "Producer % Complete" },
  { value: "statusNotes", label: "Current Status Notes" },
  { value: "riskNotes", label: "Risk Notes" },
  { value: "adpilerLink", label: "AdPiler Link" },
  { value: "bynderLink", label: "Bynder Link" },
  { value: "bynderArchiveLink", label: "Bynder Archive Link" },
  { value: "sharepointLink", label: "SharePoint Link" },
  { value: "notes", label: "Notes (appended)" },
];

function autoMapExcelHeader(raw) {
  const h = raw
    .toLowerCase()
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    h.includes("workfront") ||
    h === "wf id" ||
    h === "wfid" ||
    h === "wf#" ||
    h === "project id" ||
    h === "project #"
  )
    return "wfId";
  if (h.includes("project name")) return "name";
  if (h.includes("project phase")) return "phase";
  if (
    h === "lob" ||
    h === "line of business" ||
    h.startsWith("lob ") ||
    h.startsWith("lob\n")
  )
    return "lob";
  if (h.includes("project type")) return "jobType";
  if (h.includes("project task")) return "projectTask";
  if (h.includes("scope id") || h.includes("scope #")) return "scopeId";
  if (
    h.includes("project %") ||
    h === "project % complete" ||
    h.includes("proj %")
  )
    return "projectPct";
  if (
    (h.includes("cp %") || h.includes("client partner %")) &&
    h.includes("complete")
  )
    return "cpPct";
  if (h.includes("producer %") && h.includes("complete")) return "producerPct";
  if (h.includes("current status") || h.includes("status note"))
    return "statusNotes";
  if (h.includes("risk note")) return "riskNotes";
  if (h.includes("adpiler")) return "adpilerLink";
  if (h.includes("bynder") && h.includes("archive")) return "bynderArchiveLink";
  if (h.includes("bynder")) return "bynderLink";
  if (h.includes("sharepoint")) return "sharepointLink";
  if (
    h.includes("kickoff") ||
    h.includes("kick off") ||
    h === "start date" ||
    h.startsWith("start date") ||
    h.includes("project start") ||
    (h.startsWith("start") && !h.includes("re-start") && !h.includes("restart"))
  )
    return "startDate";
  if (
    h.includes("handoff to cd") ||
    h.includes("cd date") ||
    h.includes("cd hand")
  )
    return "cdDate";
  if (
    h.includes("h+s") ||
    h.includes("h&s") ||
    h.includes("h&amp;s") ||
    h.includes("1876 handoff") ||
    h.includes("handoff to h") ||
    h.includes("media hand") ||
    h.includes("media delivery") ||
    h.includes("media handoff") ||
    h.includes("1876") ||
    h.includes("to studio") ||
    h.includes("handoff to media")
  )
    return "liveDate";
  if (
    h.includes("go-live") ||
    h.includes("go live") ||
    h.includes("target go") ||
    (h.includes("live") && h.includes("cp"))
  )
    return "goLiveDate";
  if (h.startsWith("marketers") || h === "marketer") return "marketer";
  if (
    (h === "cp" || h.startsWith("cp ") || h.startsWith("cp\n")) &&
    !h.includes("%")
  )
    return "cp";
  if (
    (h === "producer" ||
      h.startsWith("producer ") ||
      h.startsWith("producer\n")) &&
    !h.includes("%")
  )
    return "producer";
  if (h.includes("media partner")) return "mediaPartner";
  if (h.includes("complexity")) return "loe";
  if (
    h.includes("project risk") ||
    (h.startsWith("risk") && !h.includes("note"))
  )
    return "risk";
  if (h.includes("risk note") || h.includes("status note")) return "notes";
  if (h.includes("asset count") || h.includes("total asset"))
    return "totalAssets";
  if (h.includes("line count") || h.includes("placement"))
    return "cdPlacements";
  return "";
}

function loadSavedExcelMap() {
  try {
    return JSON.parse(localStorage.getItem(EXCEL_MAP_STORAGE_KEY) || "{}");
  } catch (e) {
    return {};
  }
}
function saveExcelColumnMap(map) {
  try {
    localStorage.setItem(EXCEL_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {}
}

function handleExcelFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  event.target.value = "";
  const reader = new FileReader();
  reader.onload = function (e) {
    let wb;
    try {
      wb = XLSX.read(new Uint8Array(e.target.result), {
        type: "array",
        cellDates: true,
      });
    } catch (err) {
      alert(
        "Could not read the Excel file. Make sure it is a valid .xlsx or .xls file."
      );
      return;
    }
    const LOB_SHEET_MAP = { Business: "BUS", Fiber: "FIB", Mobility: "MOB" };
    const ALLOWED_SHEETS = new Set(Object.keys(LOB_SHEET_MAP));
    _excelRows = [];
    _excelSheetNames = wb.SheetNames.slice();
    const headerMap = new Map(); // header → first non-empty sample

    // Auto-detect the header row: scan first 10 rows for one containing known keywords.
    // Row 2 (index 1) is a common pattern when row 1 is a title/banner row.
    function findHeaderRowIndex(rows) {
      const SIGNALS = [
        "project name",
        "project type",
        "producer",
        "cp",
        "marketer",
        "kickoff",
        "phase",
        "job name",
        "job title",
        "title",
        "name",
        "lob",
        "status",
        "risk",
        "start date",
        "start",
        "task",
        "scope",
        "date",
        "live",
        "handoff",
        "asset",
        "percent",
        "%",
        "complete",
        "notes",
        "link",
        "ad",
        "media",
        "partner",
        "wf",
        "workfront",
      ];
      var bestIdx = 0,
        bestScore = -1;
      for (var i = 0; i < Math.min(12, rows.length); i++) {
        var cells = rows[i].map(function (c) {
          return String(c || "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
        });
        var nonEmpty = cells.filter(function (c) {
          return c.length > 0;
        }).length;
        if (nonEmpty === 0) continue;
        var sigScore = SIGNALS.filter(function (s) {
          return cells.some(function (c) {
            return c.includes(s);
          });
        }).length;
        // Weight: signal matches dominate; non-empty cell count breaks ties
        var score = sigScore * 100 + Math.min(nonEmpty, 99);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    wb.SheetNames.forEach(function (sheetName) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!rows || rows.length < 1) return;
      const headerRowIdx = findHeaderRowIndex(rows);
      const headers = rows[headerRowIdx].map(function (h) {
        return String(h || "")
          .replace(/\s+/g, " ")
          .trim();
      });

      // Always register every non-empty header — sample from first data row if it exists
      const firstDataRow = rows[headerRowIdx + 1] || [];
      headers.forEach(function (h, i) {
        if (h && !headerMap.has(h)) {
          const raw = firstDataRow[i];
          const s = String(
            raw instanceof Date ? raw.toLocaleDateString() : raw || ""
          );
          headerMap.set(h, s.length > 45 ? s.slice(0, 45) + "\u2026" : s);
        }
      });

      rows.slice(headerRowIdx + 1).forEach(function (row) {
        const obj = { __sheet__: sheetName };
        headers.forEach(function (h, i) {
          if (h) obj[h] = row[i];
        });
        _excelRows.push(obj);
      });
    });
    _excelHeaders = Array.from(headerMap.entries()).map(function (entry) {
      return { col: entry[0], sample: entry[1] };
    });

    // Hard fallback: if nothing was detected, take the first row with 2+ cells from any sheet
    if (_excelHeaders.length === 0) {
      wb.SheetNames.forEach(function (sheetName) {
        if (_excelHeaders.length > 0) return;
        const ws2 = wb.Sheets[sheetName];
        const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: "" });
        for (var i = 0; i < Math.min(15, rows2.length); i++) {
          var hdrs = rows2[i]
            .map(function (c) {
              return String(c || "")
                .replace(/\s+/g, " ")
                .trim();
            })
            .filter(function (h) {
              return h.length > 0;
            });
          if (hdrs.length >= 2) {
            hdrs.forEach(function (h) {
              var samp = rows2[i + 1]
                ? String(rows2[i + 1][rows2[i].indexOf(h)] || "")
                : "";
              headerMap.set(
                h,
                samp.length > 45 ? samp.slice(0, 45) + "\u2026" : samp
              );
            });
            _excelHeaders = Array.from(headerMap.entries()).map(function (e) {
              return { col: e[0], sample: e[1] };
            });
            rows2.slice(i + 1).forEach(function (row) {
              var obj = { __sheet__: sheetName };
              rows2[i].forEach(function (h, idx) {
                var k = String(h || "")
                  .replace(/\s+/g, " ")
                  .trim();
                if (k) obj[k] = row[idx];
              });
              _excelRows.push(obj);
            });
            break;
          }
        }
      });
    }

    openExcelMapModal();
  };
  reader.readAsArrayBuffer(file);
}

function openExcelMapModal() {
  // Populate sheet selector
  const sheetSel = document.getElementById("excelSheetSelector");
  if (sheetSel) {
    sheetSel.innerHTML =
      '<option value="__all__">All sheets</option>' +
      _excelSheetNames
        .map(function (n) {
          return '<option value="' + n + '">' + n + "</option>";
        })
        .join("");
    sheetSel.value = "__all__";
  }
  const savedMap = loadSavedExcelMap();
  const tbody = document.getElementById("excelMapTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  _excelHeaders.forEach(function (item) {
    const col = item.col;
    const sample = item.sample;
    const savedVal =
      savedMap[col] !== undefined ? savedMap[col] : autoMapExcelHeader(col);
    const dispCol = col.replace(/\n/g, " / ");
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f3f4f6";
    const opts = SCHED_FIELDS.map(function (f) {
      return (
        '<option value="' +
        f.value +
        '"' +
        (f.value === savedVal ? " selected" : "") +
        ">" +
        f.label +
        "</option>"
      );
    }).join("");
    tr.innerHTML =
      '<td style="padding:6px 10px; font-size:0.8rem; font-weight:500; color:#111827; vertical-align:middle;">' +
      dispCol +
      "</td>" +
      '<td style="padding:6px 10px; font-size:0.78rem; color:#6b7280; vertical-align:middle; word-break:break-all;">' +
      sample +
      "</td>" +
      '<td style="padding:6px 10px; vertical-align:middle;"><select data-col="' +
      col.replace(/&/g, "&amp;").replace(/"/g, "&quot;") +
      '" style="width:100%; font-size:0.8rem; height:30px; border-radius:4px; border:1px solid #cbd5e1; background:#fff; color:#111827; padding:2px 6px;">' +
      opts +
      "</select></td>";
    tbody.appendChild(tr);
  });
  const modal = document.getElementById("excelMapModal");
  if (modal) modal.classList.add("show");
  // Show Smart Merge option only for admins
  const smartMergeOpt = document.getElementById("smartMergeOption");
  if (smartMergeOpt) {
    smartMergeOpt.style.display = currentUserRole === "admin" ? "" : "none";
    // If currently selected and user is not admin, reset to append
    const checked = document.querySelector(
      'input[name="excelImportMode"]:checked'
    );
    if (
      checked &&
      checked.value === "smartmerge" &&
      currentUserRole !== "admin"
    ) {
      const appendEl = document.querySelector(
        'input[name="excelImportMode"][value="append"]'
      );
      if (appendEl) appendEl.checked = true;
    }
  }
}

function closeExcelMapModal() {
  const modal = document.getElementById("excelMapModal");
  if (modal) modal.classList.remove("show");
}

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val)) return null;
    // SheetJS delivers UTC-midnight dates; use UTC components so the calendar
    // date is preserved regardless of the browser's local timezone offset.
    return new Date(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate());
  }
  if (typeof val === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      if (d) return new Date(d.y, d.m - 1, d.d);
    } catch (e) {}
    return null;
  }
  const s = String(val).trim();
  if (!s) return null;
  // Treat common "not a date" placeholder strings as empty
  if (
    /^(n\/a|na|tbd|tbc|none|pending|sporadic|ongoing|varies|flex|flexible|continuous|various|-+)$/i.test(
      s
    )
  )
    return null;
  // Handle short date strings like "4/3" (no year) — append current year
  const shortDate = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortDate) {
    const y = new Date().getFullYear();
    const d2 = new Date(s + "/" + y);
    return isNaN(d2) ? null : d2;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function mapExcelJobType(val) {
  const v = String(val || "")
    .toLowerCase()
    .replace(/[\s_\-/]+/g, "");
  if (
    v.includes("traffickingonly") ||
    v.includes("trafficonly") ||
    v === "traffic" ||
    v.startsWith("trafficking")
  )
    return "ContentDeliveryOnly";
  if (v.includes("contentdelivery") || v.includes("cdonly"))
    return "ContentDeliveryOnly";
  if (v.includes("adhoc") || v.includes("adhocreq")) return "AdHocRequest";
  if (v.includes("origination") || v.includes("assetorigin"))
    return "AssetOrigination";
  // 'Creative Adaptation/Adoption' contains both — check adoption before adapt
  if (v.includes("adoption")) return "Adopt";
  if (v.includes("adapt")) return "Adapt";
  if (v.includes("adopt")) return "Adopt";
  return "Adapt";
}

function mapExcelLoe(val) {
  const s = String(val || "").trim();
  // Read the word BEFORE the parenthetical: "Normal (LOE: 1)" → "normal"
  const textPart = s.split("(")[0].toLowerCase().trim();
  if (textPart.includes("extreme")) return 2;
  if (textPart.includes("heavy")) return 1.5;
  if (textPart.includes("normal")) return 1;
  if (textPart.includes("light")) return 0.75;
  // Fallback: extract numeric from inside parens e.g. "(LOE: 1.5)"
  const loeMatch = s.match(/loe[:\s]+([\d.]+)/i);
  if (loeMatch) {
    const n = parseFloat(loeMatch[1]);
    if (!isNaN(n)) return n;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 1 : n;
}

function mapExcelPhase(val) {
  const v = String(val || "")
    .replace(/\s+/g, " ")
    .trim();
  const lv = v.toLowerCase();
  if (!lv) return "";
  if (lv === "discovery") return "Discovery";
  if (lv.includes("pre") && lv.includes("prod")) return "Pre-Production";
  if (
    lv.includes("in") &&
    lv.includes("prod") &&
    !lv.includes("post") &&
    !lv.includes("pre")
  )
    return "In Production";
  if (lv === "in production" || lv === "in-production" || lv === "production")
    return "In Production";
  if (lv.includes("post") && lv.includes("prod")) return "Post-Production";
  if (
    lv.includes("closeout") ||
    lv.includes("close out") ||
    lv.includes("close-out")
  )
    return "Project Closeout";
  if (lv === "completed" || lv === "complete" || lv === "done")
    return "Completed";
  if (lv === "canceled" || lv === "cancelled" || lv === "cancel")
    return "Canceled";
  // Return original with title-case as fallback so we don't lose the value
  return v;
}

function runExcelImport() {
  const tbody = document.getElementById("excelMapTableBody");
  if (!tbody) return;
  const colMap = {};
  tbody.querySelectorAll("select[data-col]").forEach(function (sel) {
    if (sel.value) colMap[sel.getAttribute("data-col")] = sel.value;
  });
  saveExcelColumnMap(colMap);

  const modeEl = document.querySelector(
    'input[name="excelImportMode"]:checked'
  );
  const importMode = modeEl ? modeEl.value : "append";
  const doReplace = importMode === "replace";
  const doSmartMerge = importMode === "smartmerge";

  // Filter by selected sheet
  const sheetSel = document.getElementById("excelSheetSelector");
  const selectedSheet = sheetSel ? sheetSel.value : "__all__";
  const LOB_SHEET_MAP = { Business: "BUS", Fiber: "FIB", Mobility: "MOB" };
  const rowsToImport =
    selectedSheet === "__all__"
      ? _excelRows
      : _excelRows.filter(function (r) {
          return r.__sheet__ === selectedSheet;
        });

  // Normalize colMap keys — guards against any stale keys that have raw newlines
  const normColMap = {};
  Object.keys(colMap).forEach(function (k) {
    normColMap[k.replace(/\s+/g, " ").trim()] = colMap[k];
  });

  function getCol(row, field) {
    const col = Object.keys(normColMap).find(function (k) {
      return normColMap[k] === field;
    });
    return col !== undefined ? row[col] : undefined;
  }

  const ALLOWED_LOBS = new Set(["BUS", "FIB", "MOB", "FNT"]);
  // Match sheet name to LOB regardless of case or abbreviation
  function sheetNameToLob(sheetName) {
    const n = (sheetName || "").trim();
    if (LOB_SHEET_MAP[n]) return LOB_SHEET_MAP[n];
    const nl = n.toLowerCase();
    if (nl === "mob" || nl.startsWith("mobil")) return "MOB";
    if (nl === "fib" || nl.startsWith("fiber") || nl.startsWith("fibre"))
      return "FIB";
    if (nl === "bus" || nl.startsWith("busine")) return "BUS";
    if (nl === "fnt" || nl.startsWith("first")) return "FNT";
    return null;
  }
  // Extract LOB from job name (e.g. "7346538_BUS_FirstNet..." → 'BUS')
  function lobFromName(name) {
    const m = String(name || "").match(/(?:^|_)(MOB|FIB|BUS|FNT)(?:_|$)/i);
    return m ? m[1].toUpperCase() : null;
  }
  const ACTIVE_PHASES = new Set([
    "discovery",
    "pre-production",
    "pre production",
    "in production",
    "in-production",
    "post-production",
    "post production",
    "project closeout",
    "closeout",
    "completed",
    "canceled",
    "cancelled",
  ]);

  let lobSkipped = 0;
  const incoming = [];
  rowsToImport.forEach(function (row) {
    const rawName = getCol(row, "name");
    const name = String(rawName || "").trim();
    if (!name) return;

    // Skip rows not in an active phase
    const phaseCol = Object.keys(normColMap).find(function (k) {
      return normColMap[k] === "phase";
    });
    if (phaseCol !== undefined) {
      const phase = String(row[phaseCol] || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      // Only skip rows where phase is explicitly set to a non-active value; blank = include
      if (phase && !ACTIVE_PHASES.has(phase)) return;
    }

    // Resolve LOB: mapped column (only if it IS a valid LOB) → sheet name → job name
    const rawLobCol = String(getCol(row, "lob") || "")
      .trim()
      .toUpperCase();
    const resolvedLob =
      (ALLOWED_LOBS.has(rawLobCol) ? rawLobCol : null) ||
      sheetNameToLob(row.__sheet__) ||
      lobFromName(name) ||
      "";
    if (!ALLOWED_LOBS.has(resolvedLob)) {
      lobSkipped++;
      return;
    }

    // Collect all columns mapped to 'notes'
    const notesParts = [];
    Object.keys(colMap).forEach(function (k) {
      if (colMap[k] === "notes") {
        const v = String(row[k] || "").trim();
        if (v) notesParts.push("[" + k.replace(/\n/g, " / ") + "] " + v);
      }
    });

    incoming.push({
      id: Date.now() + Math.random(),
      name,
      wfId: String(getCol(row, "wfId") || "").trim(),
      lob:
        (ALLOWED_LOBS.has(
          String(getCol(row, "lob") || "")
            .trim()
            .toUpperCase()
        )
          ? String(getCol(row, "lob")).trim().toUpperCase()
          : null) ||
        sheetNameToLob(row.__sheet__) ||
        lobFromName(name) ||
        (row.__sheet__ || "").toUpperCase().slice(0, 3),
      jobType: mapExcelJobType(getCol(row, "jobType")),
      loe: mapExcelLoe(getCol(row, "loe")),
      phase: mapExcelPhase(getCol(row, "phase")),
      projectTask: String(getCol(row, "projectTask") || "").trim(),
      scopeId: String(getCol(row, "scopeId") || "").trim(),
      projectPct: ((v) => (v > 0 && v <= 1 ? Math.round(v * 1000) / 10 : v))(
        parseFloat(getCol(row, "projectPct")) || 0
      ),
      cpPct: ((v) => (v > 0 && v <= 1 ? Math.round(v * 1000) / 10 : v))(
        parseFloat(getCol(row, "cpPct")) || 0
      ),
      producerPct: ((v) => (v > 0 && v <= 1 ? Math.round(v * 1000) / 10 : v))(
        parseFloat(getCol(row, "producerPct")) || 0
      ),
      statusNotes: String(getCol(row, "statusNotes") || "").trim(),
      riskNotes: String(getCol(row, "riskNotes") || "").trim(),
      adpilerLink: String(getCol(row, "adpilerLink") || "").trim(),
      bynderLink: String(getCol(row, "bynderLink") || "").trim(),
      bynderArchiveLink: String(getCol(row, "bynderArchiveLink") || "").trim(),
      sharepointLink: String(getCol(row, "sharepointLink") || "").trim(),
      cp: String(getCol(row, "cp") || "").trim(),
      producer: String(getCol(row, "producer") || "").trim(),
      marketer: String(getCol(row, "marketer") || "").trim(),
      mediaPartner: String(getCol(row, "mediaPartner") || "").trim(),
      risk: String(getCol(row, "risk") || "").trim(),
      startDate: parseExcelDate(getCol(row, "startDate")),
      cdDate: parseExcelDate(getCol(row, "cdDate")),
      liveDate: parseExcelDate(getCol(row, "liveDate")),
      goLiveDate: parseExcelDate(getCol(row, "goLiveDate")),
      totalAssets: parseFloat(getCol(row, "totalAssets")) || 0,
      cdPlacements: parseFloat(getCol(row, "cdPlacements")) || 0,
      socialAssets: 0,
      displayAssets: 0,
      staticAssets: 0,
      cdOnlyAssets: 0,
      priority: 2,
      devMinutesSocial: 30,
      devMinutesDisplay: 30,
      devMinutesStatic: 15,
      reviewMinutes: 10,
      qaMinutes: 5,
      cdMinutes: 10,
      vacationTrack: "all",
      vacationPerson: "",
      assigneeSocial: "",
      assigneeDisplay: "",
      assigneeStatic: "",
      assigneeReview: "",
      assigneeQa: "",
      assigneeCd: "",
      notes: notesParts.join("\n"),
      createdAt: new Date().toISOString(),
      createdBy: currentUserName || "Excel Import",
    });
  });

  // Excel-sourced fields that Smart Merge may update on existing jobs
  const EXCEL_UPDATE_FIELDS = [
    "name",
    "wfId",
    "lob",
    "jobType",
    "loe",
    "cp",
    "producer",
    "marketer",
    "mediaPartner",
    "risk",
    "startDate",
    "cdDate",
    "liveDate",
    "goLiveDate",
    "totalAssets",
    "cdPlacements",
  ];

  let smartAdded = 0,
    smartUpdated = 0;

  if (doReplace) {
    jobs.length = 0;
    incoming.forEach(function (j) {
      jobs.push(j);
    });
  } else if (doSmartMerge) {
    incoming.forEach(function (inj) {
      // Find match: prefer WF ID, fall back to name+LOB
      let existing = null;
      if (inj.wfId) {
        existing = jobs.find(function (j) {
          return j.wfId && j.wfId === inj.wfId;
        });
      }
      if (!existing) {
        existing = jobs.find(function (j) {
          return (
            j.name.toLowerCase() === inj.name.toLowerCase() &&
            (j.lob || "").toUpperCase() === (inj.lob || "").toUpperCase()
          );
        });
      }
      if (existing) {
        // Update Excel-sourced fields; preserve scheduler fields
        EXCEL_UPDATE_FIELDS.forEach(function (f) {
          if (inj[f] !== undefined && inj[f] !== null && inj[f] !== "") {
            existing[f] = inj[f];
          }
        });
        existing.updatedAt = new Date().toISOString();
        existing.updatedBy = currentUserName || "Excel Smart Merge";
        smartUpdated++;
      } else {
        // Brand new job
        jobs.push(inj);
        smartAdded++;
      }
    });
  } else {
    // Append only jobs whose name+lob combo doesn't already exist
    const existingKeys = new Set(
      jobs.map(function (j) {
        return j.name + "__" + j.lob;
      })
    );
    incoming.forEach(function (j) {
      const key = j.name + "__" + j.lob;
      if (!existingKeys.has(key)) {
        jobs.push(j);
        existingKeys.add(key);
      }
    });
  }

  saveStateToStorage();
  // On Replace: clear all filters so imported jobs are immediately visible
  if (doReplace) {
    if (filterLob) {
      filterLob.value = "";
    }
    if (filterJobType) {
      filterJobType.value = "";
    }
    if (filterJobName) {
      filterJobName.value = "";
    }
    if (filterPhase) {
      filterPhase.value = "";
    }
    if (filterResource) {
      filterResource.value = "";
    }
  }
  renderSchedule();
  closeExcelMapModal();
  showView("calendar");
  const total = rowsToImport.length;
  const named = rowsToImport.filter(function (r) {
    return String(getCol(r, "name") || "").trim();
  }).length;
  const phaseColKey = Object.keys(normColMap).find(function (k) {
    return normColMap[k] === "phase";
  });

  // Collect unique phase values actually found in the rows (for debugging mismatches)
  const uniquePhases = [];
  if (phaseColKey) {
    const seen = new Set();
    rowsToImport.forEach(function (r) {
      const v = String(r[phaseColKey] || "")
        .replace(/\s+/g, " ")
        .trim();
      if (v && !seen.has(v)) {
        seen.add(v);
        uniquePhases.push(v);
      }
    });
  }

  const skipped = phaseColKey
    ? rowsToImport.filter(function (r) {
        const n = String(r[phaseColKey] || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        return n && !ACTIVE_PHASES.has(n);
      }).length
    : 0;
  const added = doSmartMerge ? smartAdded : incoming.length;
  const dupes =
    !doReplace && !doSmartMerge
      ? incoming.length -
        (jobs.length - (doReplace ? 0 : jobs.length - incoming.length))
      : 0;
  const appendSkipped =
    !doReplace && !doSmartMerge ? named - skipped - added : 0;
  const DATE_FIELDS = {
    startDate: "Kickoff",
    cdDate: "CD Date",
    liveDate: "Media Hand Off",
    goLiveDate: "Go-Live",
  };
  const dateMappingLines = Object.keys(DATE_FIELDS)
    .map(function (f) {
      const col = Object.keys(normColMap).find(function (k) {
        return normColMap[k] === f;
      });
      return (
        "  " +
        DATE_FIELDS[f] +
        ": " +
        (col ? "\u2714 \u201C" + col + "\u201D" : "\u2716 NOT MAPPED")
      );
    })
    .join("\n");
  alert(
    "Excel import complete\n" +
      "\u2022 Rows in sheet: " +
      total +
      "\n" +
      "\u2022 Rows with a Job Name: " +
      named +
      "\n" +
      (phaseColKey
        ? "\u2022 Phase values found: " +
          (uniquePhases.length ? uniquePhases.join(", ") : "none") +
          "\n"
        : "\u2022 Phase column: NOT MAPPED\n") +
      (skipped ? "\u2022 Skipped (phase not active): " + skipped + "\n" : "") +
      (lobSkipped
        ? "\u2022 Skipped (LOB not BUS/FIB/MOB/FNT): " + lobSkipped + "\n"
        : "") +
      (doSmartMerge
        ? "\u2022 Jobs updated (existing): " +
          smartUpdated +
          "\n\u2022 Jobs added (new): " +
          smartAdded
        : "\u2022 Jobs added: " +
          added +
          (appendSkipped > 0
            ? "\n\u2022 Skipped (already exist): " +
              appendSkipped +
              "  \u2192 Use \u201CSmart Merge\u201D to update existing jobs"
            : "")) +
      (doReplace ? "\n(Previous jobs replaced.)" : "") +
      "\n\nDate columns detected:\n" +
      dateMappingLines
  );
}

// Wire up Excel import
const importExcelBtn = document.getElementById("importExcelBtn");
const importExcelFile = document.getElementById("importExcelFile");
if (importExcelBtn && importExcelFile) {
  importExcelBtn.addEventListener("click", function () {
    importExcelFile.click();
  });
  importExcelFile.addEventListener("change", handleExcelFileChange);
}

// Wire up Import Users Excel
const importUsersExcelBtn = document.getElementById("importUsersExcelBtn");
const importUsersExcelFile = document.getElementById("importUsersExcelFile");
if (importUsersExcelBtn && importUsersExcelFile) {
  importUsersExcelBtn.addEventListener("click", function () {
    if (currentUserRole !== "admin") return;
    importUsersExcelFile.click();
  });
  importUsersExcelFile.addEventListener("change", function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        function normalizeRole(raw) {
          return normalizeRoleStr(raw);
        }
        const loaded = rows
          .map((r) => ({
            name: String(
              r["Name"] || r["name"] || r["Names"] || r["names"] || ""
            ).trim(),
            role: normalizeRole(r["Role"] || r["role"]),
            lobs: String(r["LOBs"] || r["lobs"] || r["LOB"] || r["lob"] || "")
              .split(",")
              .map((s) => s.trim().toUpperCase())
              .filter((s) => s && s !== "ALL")
              .join(","),
          }))
          .filter((u) => u.name);
        if (loaded.length === 0) {
          alert(
            "No users found. Check that the file has a Name, Role, and LOBs column."
          );
          return;
        }
        users = loaded;
        resolveUserRole(currentUserName);
        applyRoleUI();
        saveStateToStorage();
        alert("Users imported: " + loaded.length + " users loaded.");
      } catch (err) {
        alert("Failed to import users: " + err.message);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
const excelMapCloseX = document.getElementById("excelMapCloseX");
const excelMapCancelBtn = document.getElementById("excelMapCancelBtn");
const excelMapImportBtn = document.getElementById("excelMapImportBtn");
const excelMapModal = document.getElementById("excelMapModal");
if (excelMapCloseX)
  excelMapCloseX.addEventListener("click", closeExcelMapModal);
if (excelMapCancelBtn)
  excelMapCancelBtn.addEventListener("click", closeExcelMapModal);
const excelMapResetBtn = document.getElementById("excelMapResetBtn");
if (excelMapResetBtn)
  excelMapResetBtn.addEventListener("click", function () {
    try {
      localStorage.removeItem(EXCEL_MAP_STORAGE_KEY);
    } catch (e) {}
    openExcelMapModal();
  });
if (excelMapImportBtn)
  excelMapImportBtn.addEventListener("click", runExcelImport);
if (excelMapModal)
  excelMapModal.addEventListener("click", function (e) {
    if (e.target === excelMapModal) closeExcelMapModal();
  });
// ── End Excel Import ──────────────────────────────────────────────────────

const updateBannerReloadBtn = document.getElementById("updateBannerReloadBtn");
const updateBannerDismissBtn = document.getElementById(
  "updateBannerDismissBtn"
);
if (updateBannerReloadBtn) {
  updateBannerReloadBtn.addEventListener("click", async () => {
    const banner = document.getElementById("updateBanner");
    if (banner) banner.style.display = "none";
    if (!connectedFileHandle) return;
    try {
      const file = await connectedFileHandle.getFile();
      const text = await file.text();
      const payload = JSON.parse(text);
      if (payload && Array.isArray(payload.jobs)) {
        applyLoadedState(payload, { fromEmbedded: false });
        saveStateToStorage();
        renderSchedule();
      }
    } catch (e) {
      console.error("Reload from file failed", e);
    }
  });
}
if (updateBannerDismissBtn) {
  updateBannerDismissBtn.addEventListener("click", () => {
    const banner = document.getElementById("updateBanner");
    if (banner) banner.style.display = "none";
    // Advance inMemoryLastEditedAt so this change doesn't re-trigger immediately
    inMemoryLastEditedAt = new Date();
  });
}

// Initial
ensureUserName(); // Prompt for name on first load so it is always set before any save/export
const navUserEl = document.getElementById("navUserDisplay");
if (navUserEl) navUserEl.addEventListener("click", changeUserName);
loadStateFromStorage();
resolveUserRole(currentUserName);
applyRoleUI();
recalcJobMetrics();
toggleJobTypeFields();
const _fpInit = document.getElementById("filterPhase");
if (_fpInit) _fpInit.value = "active";
const _srfpInit = document.getElementById("srFilterPhase");
if (_srfpInit) _srfpInit.value = "active";
showView("calendar");
// Restore OneDrive file connection from previous session (runs async after render)
// initFsaConnection(); the adapter handles initial load instead

// ── STATUS REPORT ────────────────────────────────────────────────────────

const CHECKLIST_KEYS = [
  { key: "wfJobOpened", label: "WF Job Opened" },
  { key: "placementFilters", label: "Placement Filters Confirmed" },
  { key: "creativeAssignments", label: "Creative Assignments for Placements" },
  { key: "startEndDates", label: "Creative Start/End Date Confirmed" },
  { key: "workingFiles", label: "Working Files Received" },
  { key: "creativeUpdates", label: "Creative Updates (If Needed)" },
  { key: "kickoffBrief", label: "Kickoff Brief Completed" },
  { key: "legalReview", label: "Legal Review (if needed)" },
  { key: "socialCopy", label: "Social Post Copy Received" },
  { key: "urlsSourceCodes", label: "URL's + Source Codes Received" },
  { key: "creativeRotation", label: "Creative Rotation" },
  { key: "taxonomy", label: "Creative Taxonomy Submitted/Received" },
  {
    key: "traffickingInstructions",
    label: "Trafficking Instructions Complete",
  },
];

const PROJECT_TYPES = [
  "Creative Origination",
  "Creative Adaptation/Adoption",
  "Trafficking Only",
];

const PHASE_OPTIONS = [
  "Discovery",
  "Pre-Production",
  "In Production",
  "Post-Production",
  "Project Closeout",
  "Completed",
  "Canceled",
];

const TASKS_BY_PHASE = {
  Discovery: ["Project Awaiting WF Request", "Received WF Request"],
  "Pre-Production": [
    "Gathering Kickoff Materials/Creating Brief",
    "Gathering Trafficking Sheet Materials",
    "Trafficking Sheet/Project Brief Handed Off",
    "Prekickoff Scheduled",
    "Project Set-up",
    "Kickoff Scheduled - Awaiting Additional Assets",
    "Kickoff Scheduled - All Assets Delivered",
  ],
  "In Production": [
    "Project Kickoff",
    "Creative Edits/Versioning",
    "Internal Review",
    "Creative Revisions",
    "Mech Prep",
    "Final Internal Review",
  ],
  "Post-Production": ["Package Files/QA", "File Release"],
  "Project Closeout": ["Upload to Bynder/Link Requested"],
  Completed: ["Completed"],
  Canceled: ["Canceled"],
};

// Flat list used by the % lookup tables (kept for backward compatibility)
const TASK_OPTIONS = Object.values(TASKS_BY_PHASE).flat();

const RISK_OPTIONS = ["On Track", "At Risk", "Delayed"];

// Mirrors the XLOOKUP formula for Project % Complete
const PCT_BY_TASK = {
  "Project Awaiting WF Request": 0.045,
  "Received WF Request": 0.09,
  "Pending Files From CM": 0.135,
  "Gathering Trafficking Sheet Materials": 0.135,
  "Gathering Kickoff Materials/Creating Brief": 0.18,
  "Trafficking Sheet/Project Brief Handed Off": 0.225,
  "Prekickoff Scheduled": 0.27,
  "Project Set-up": 0.315,
  "Kickoff Scheduled - Awaiting Additional Assets": 0.36,
  "Kickoff Scheduled - All Assets Delivered": 0.405,
  "Creative Reviewing Delivered Assets": 0.45,
  "Project Kickoff": 0.495,
  "Creative Versioning": 0.54,
  "Internal Review": 0.585,
  "Client/Marketer Review": 0.63,
  "Brand/Legal Review": 0.675,
  "Creative Revisions": 0.72,
  QA: 0.765,
  "CD Preparing to Traffic": 0.81,
  "CD Shipped Assets": 0.855,
  "Assets Live": 0.9,
  "Bynder Link Requested": 0.945,
  Complete: 1.0,
  "Trafficking Only Sheet/Project Brief Handed Off": 0.65,
};

// Mirrors the XLOOKUP formula for CP % Complete
const CP_PCT_BY_TASK = {
  "Project Awaiting WF Request": 0.1,
  "Received WF Request": 0.18,
  "Pending Files From CM": 0.29,
  "Gathering Kickoff Materials/Creating Brief": 0.41,
  "Trafficking Sheet/Project Brief Handed Off": 0.55,
  "Prekickoff Scheduled": 0.67,
  "Project Set-up": 0.75,
  "Kickoff Scheduled - Awaiting Additional Assets": 0.79,
  "Kickoff Scheduled - All Assets Delivered": 0.85,
  "Creative Reviewing Delivered Assets": 0.89,
  "Project Kickoff": 0.92,
  "Creative Versioning": 0.95,
  "Internal Review": 0.96,
  "Client/Marketer Review": 0.97,
  "Brand/Legal Review": 0.975,
  "Creative Revisions": 0.98,
  QA: 0.985,
  "CD Preparing to Traffic": 0.99,
  "CD Shipped to H+S": 0.99,
  "CD Shipped Assets": 0.99,
  "Assets Live": 0.99,
  "Bynder Link Requested": 0.99,
  Complete: 1.0,
  "Trafficking Only Sheet/Project Brief Handed Off": 0.9,
};

function taskToPct(task) {
  if (!task || !(task in PCT_BY_TASK)) return null;
  return Math.round(PCT_BY_TASK[task] * 1000) / 10; // returns 0–100
}
function taskToCpPct(task) {
  if (!task || !(task in CP_PCT_BY_TASK)) return null;
  return Math.round(CP_PCT_BY_TASK[task] * 1000) / 10;
}

// Mirrors the XLOOKUP formula for Producer % Complete
const PRODUCER_PCT_BY_TASK = {
  "Project Awaiting WF Request": 0.0,
  "Received WF Request": 0.05,
  "Pending Files From CM": 0.08,
  "Gathering Kickoff Materials/Creating Brief": 0.08,
  "Trafficking Sheet/Project Brief Handed Off": 0.08,
  "Prekickoff Scheduled": 0.1,
  "Project Set-up": 0.15,
  "Kickoff Scheduled - Awaiting Additional Assets": 0.2,
  "Kickoff Scheduled - All Assets Delivered": 0.25,
  "Creative Reviewing Delivered Assets": 0.28,
  "Project Kickoff": 0.35,
  "Creative Versioning": 0.5,
  "Internal Review": 0.65,
  "Client/Marketer Review": 0.7,
  "Brand/Legal Review": 0.75,
  "Creative Revisions": 0.8,
  QA: 0.85,
  "CD Preparing to Traffic": 0.9,
  "CD Shipped to H+S": 0.95,
  "CD Shipped Assets": 0.95,
  "Assets Live": 0.99,
  "Bynder Link Requested": 0.99,
  Complete: 1.0,
  "Trafficking Only Sheet/Project Brief Handed Off": 0.9,
};

function taskToProducerPct(task) {
  if (!task || !(task in PRODUCER_PCT_BY_TASK)) return null;
  return Math.round(PRODUCER_PCT_BY_TASK[task] * 1000) / 10;
}

function srDateStr(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "";
  const y = dt.getFullYear(),
    mo = String(dt.getMonth() + 1).padStart(2, "0"),
    da = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
function srParseDate(s) {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d) ? null : d;
}
function srRiskBadge(risk) {
  const r = (risk || "").toLowerCase();
  const cls = r.includes("track")
    ? "sr-risk-on-track"
    : r.includes("risk")
    ? "sr-risk-at-risk"
    : r.includes("delay")
    ? "sr-risk-delayed"
    : "sr-risk-on-track";
  return `<span class="sr-risk-badge ${cls}">${risk || "On Track"}</span>`;
}
// ── Team Panel ──────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager (All LOBs)" },
  { value: "lob-manager", label: "LOB Manager (Assigned LOBs only)" },
  { value: "view-dev", label: "Social / Display Dev" },
  { value: "view-designer", label: "Static Designer" },
  { value: "view-creative", label: "Creative" },
  { value: "view-proofing", label: "Proofing" },
  { value: "view-qa", label: "QA" },
  { value: "view-cd", label: "Content Delivery" },
  { value: "view-marketer", label: "Marketer" },
  { value: "view", label: "View Only" },
];

function roleLabel(val) {
  const r = ROLE_OPTIONS.find(
    (o) => o.value === (val || "").toLowerCase().trim()
  );
  return r ? r.label : val || "—";
}

const TEAM_LOBS = ["ALL", "BUS", "FIB", "MOB", "FNT"];

const TEAM_FUNCTIONS = [
  { key: "social", label: "Social Dev" },
  { key: "display", label: "Display Dev" },
  { key: "static", label: "Static Dev" },
  { key: "creative", label: "Creative" },
  { key: "proofing", label: "Proofing" },
  { key: "qa", label: "QA" },
  { key: "cd", label: "CD" },
  { key: "producer", label: "Producer" },
  { key: "cp", label: "CP" },
  { key: "marketer", label: "Marketer" },
];

function renderTeamPanel() {
  const tbody = document.getElementById("teamTableBody");
  if (!tbody) return;
  tbody.innerHTML = users
    .map((u, i) => {
      const roleOpts = ROLE_OPTIONS.map(
        (o) =>
          `<option value="${o.value}"${
            (u.role || "").toLowerCase() === o.value ? " selected" : ""
          }>${o.label}</option>`
      ).join("");
      const fns = Array.isArray(u.functions) ? u.functions : [];
      const lobArr = Array.isArray(u.lobs)
        ? u.lobs.map((l) => (l || "").toUpperCase())
        : typeof u.lobs === "string" && u.lobs.trim()
        ? u.lobs.split(",").map((l) => l.trim().toUpperCase())
        : [];
      const lobCheckboxes = TEAM_LOBS.map(
        (lob) =>
          `<label style="display:inline-flex;align-items:center;gap:3px;font-size:0.68rem;color:#374151;white-space:nowrap;margin-right:6px;cursor:pointer;">
            <input type="checkbox" data-team-lob="${i}" data-lob-key="${lob}" ${
            lobArr.includes(lob) ? "checked" : ""
          } style="accent-color:#009FDB;width:12px;height:12px;margin:0;cursor:pointer;">
            ${lob}
          </label>`
      ).join("");
      const checkboxes = TEAM_FUNCTIONS.map(
        (f) =>
          `<label style="display:inline-flex;align-items:center;gap:3px;font-size:0.68rem;color:#374151;white-space:nowrap;margin-right:6px;cursor:pointer;">
            <input type="checkbox" data-team-fn="${i}" data-fn-key="${f.key}" ${
            fns.includes(f.key) ? "checked" : ""
          } style="accent-color:#009FDB;width:12px;height:12px;margin:0;cursor:pointer;">
            ${f.label}
          </label>`
      ).join("");
      return `<tr style="border-bottom:1px solid #f3f4f6;" data-idx="${i}">
          <td style="padding:5px 8px;vertical-align:top;">
            <input type="text" value="${(u.name || "").replace(
              /"/g,
              "&quot;"
            )}" data-team-name="${i}"
              style="width:100%;font-size:0.82rem;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;color:#0f172a;">
          </td>
          <td style="padding:5px 8px;vertical-align:top;">
            <select data-team-role="${i}" style="width:100%;font-size:0.82rem;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;color:#0f172a;">
              <option value="">— select —</option>${roleOpts}
            </select>
          </td>
          <td style="padding:5px 8px;vertical-align:top;">
            <div style="display:flex;flex-wrap:wrap;gap:2px 0;">${checkboxes}</div>
          </td>
          <td style="padding:5px 8px;vertical-align:top;">
            <div style="display:flex;flex-wrap:wrap;gap:2px 0;">${lobCheckboxes}</div>
          </td>
          <td style="padding:5px 4px;text-align:center;vertical-align:top;">
            <button type="button" data-team-remove="${i}"
              style="font-size:0.9rem;background:none;border:none;cursor:pointer;color:#dc2626;padding:2px 6px;" title="Remove">&times;</button>
          </td>
        </tr>`;
    })
    .join("");

  // Wire name inputs
  tbody.querySelectorAll("[data-team-name]").forEach((el) => {
    el.addEventListener("change", () => {
      const idx = parseInt(el.dataset.teamName);
      if (users[idx]) users[idx].name = el.value.trim();
      refreshDatalistsFromUsers();
      saveStateToStorage();
    });
  });
  // Wire role selects
  tbody.querySelectorAll("[data-team-role]").forEach((el) => {
    el.addEventListener("change", () => {
      const idx = parseInt(el.dataset.teamRole);
      if (users[idx]) users[idx].role = el.value;
      refreshDatalistsFromUsers();
      saveStateToStorage();
    });
  });
  // Wire function checkboxes
  tbody.querySelectorAll("[data-team-fn]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = parseInt(cb.dataset.teamFn);
      const key = cb.dataset.fnKey;
      if (!users[idx]) return;
      if (!Array.isArray(users[idx].functions)) users[idx].functions = [];
      if (cb.checked) {
        if (!users[idx].functions.includes(key)) users[idx].functions.push(key);
      } else {
        users[idx].functions = users[idx].functions.filter((k) => k !== key);
      }
      refreshDatalistsFromUsers();
      saveStateToStorage();
    });
  });
  // Wire LOB checkboxes
  tbody.querySelectorAll("[data-team-lob]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = parseInt(cb.dataset.teamLob);
      const key = cb.dataset.lobKey;
      if (!users[idx]) return;
      if (!Array.isArray(users[idx].lobs)) users[idx].lobs = [];
      if (cb.checked) {
        if (!users[idx].lobs.includes(key)) users[idx].lobs.push(key);
      } else {
        users[idx].lobs = users[idx].lobs.filter((l) => l !== key);
      }
      resolveUserRole(currentUserName); // re-resolve in case current user changed their own LOBs
      refreshDatalistsFromUsers();
      saveStateToStorage();
    });
  });
  // Wire remove buttons
  tbody.querySelectorAll("[data-team-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.teamRemove);
      users.splice(idx, 1);
      refreshDatalistsFromUsers();
      saveStateToStorage();
      renderTeamPanel();
    });
  });
}

// Toggle collapse
document.getElementById("teamPanelToggle").addEventListener("click", () => {
  const body = document.getElementById("teamPanelBody");
  const chevron = document.getElementById("teamPanelChevron");
  const open = body.style.display !== "none";
  body.style.display = open ? "none" : "";
  chevron.textContent = open ? "▶ Show" : "▼ Hide";
  if (!open) renderTeamPanel();
});

// Add person
document.getElementById("teamAddRowBtn").addEventListener("click", () => {
  users.push({ name: "", role: "view", functions: [], lobs: [] });
  renderTeamPanel();
});

function srPctBar(pct) {
  const n = parseFloat(pct) || 0;
  const w = Math.min(100, Math.max(0, n));
  return `<div class="sr-pct-bar"><div class="sr-pct-bar-track"><div class="sr-pct-bar-fill" style="width:${w}%"></div></div><span style="font-size:0.7rem;color:#6b7280;white-space:nowrap">${n}%</span></div>`;
}

// Open the Status Report tab and expand+scroll to a specific job's detail panel
function openJobInStatusReport(jobId) {
  // Clear SR filters so the target job is guaranteed to be in the rendered table
  const srFilterName = document.getElementById("srFilterName");
  const srFilterLob = document.getElementById("srFilterLob");
  const srFilterType = document.getElementById("srFilterType");
  const srFilterPhase = document.getElementById("srFilterPhase");
  if (srFilterName) srFilterName.value = "";
  if (srFilterLob) srFilterLob.value = "";
  if (srFilterType) srFilterType.value = "";
  if (srFilterPhase) srFilterPhase.value = "";

  showView("status");
  // renderStatusReport writes innerHTML synchronously inside showView,
  // but two rAF frames ensure the browser has committed the new DOM nodes
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const id = String(jobId);
      const container = document.getElementById("srTable");
      if (!container) return;
      // Close any currently open detail rows
      container
        .querySelectorAll(".sr-detail-row")
        .forEach((r) => (r.style.display = "none"));
      container
        .querySelectorAll(".sr-expand-btn")
        .forEach((b) => b.classList.remove("open"));
      // Open the target row
      const detailRow = document.getElementById("sr-detail-" + id);
      const expandBtn = container.querySelector(
        `.sr-expand-btn[data-id="${id}"]`
      );
      if (detailRow) {
        detailRow.style.display = "";
        if (expandBtn) expandBtn.classList.add("open");
        detailRow.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    })
  );
}

// Returns true if the current user can expand/edit this job.
// Admins and managers always can.
// Anyone else with LOBs assigned is restricted to those LOBs.
// No LOBs assigned = safe fallback (sees all).
function canExpandJob(job) {
  const role = currentUserRole;
  if (role === "admin" || role === "manager") return true; // full access
  // lob-manager and all other roles: restricted by LOB if LOBs are assigned
  if (!currentUserLobs || currentUserLobs.length === 0) return true;
  if (currentUserLobs.includes("ALL")) return true;
  const jobLob = (job.lob || "").toUpperCase();
  return currentUserLobs.includes(jobLob);
}

function renderStatusReport() {
  const container = document.getElementById("srTable");
  if (!container) return;

  const lobFilter =
    (document.getElementById("srFilterLob") &&
      document.getElementById("srFilterLob").value) ||
    "";
  const typeFilter =
    (document.getElementById("srFilterType") &&
      document.getElementById("srFilterType").value) ||
    "";
  const phaseFilter =
    (document.getElementById("srFilterPhase") &&
      document.getElementById("srFilterPhase").value) ||
    "";
  const nameFilter = (
    (document.getElementById("srFilterName") &&
      document.getElementById("srFilterName").value) ||
    ""
  ).toLowerCase();

  let filtered = jobs.filter((j) => {
    if (lobFilter && (j.lob || "").toUpperCase() !== lobFilter.toUpperCase())
      return false;
    if (typeFilter && (j.jobType || "") !== typeFilter) return false;
    if (phaseFilter === "active") {
      const activePhases = ["discovery", "pre-production", "in production"];
      if (!activePhases.includes((j.phase || "").toLowerCase())) return false;
    } else if (
      phaseFilter &&
      (j.phase || "").toLowerCase() !== phaseFilter.toLowerCase()
    )
      return false;
    if (
      nameFilter &&
      !(j.name || "").toLowerCase().includes(nameFilter) &&
      !(j.wfId || "").toLowerCase().includes(nameFilter)
    )
      return false;
    return true;
  });

  // Group by LOB
  const LOB_ORDER = ["BUS", "MOB", "FIB", "FNT"];
  const grouped = {};
  filtered.forEach((j) => {
    const lob = (j.lob || "OTHER").toUpperCase();
    if (!grouped[lob]) grouped[lob] = [];
    grouped[lob].push(j);
  });

  // Sort within each LOB group: Phase first, then selected date column
  const PHASE_ORDER = [
    "Discovery",
    "Pre-Production",
    "In Production",
    "Post-Production",
    "Project Closeout",
    "Completed",
    "Canceled",
  ];
  function srPhaseVal(job) {
    const idx = PHASE_ORDER.indexOf(job.phase || "");
    return idx === -1 ? PHASE_ORDER.length : idx;
  }
  function toMs(raw) {
    if (!raw) return Infinity;
    const t = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
    return isNaN(t) ? Infinity : t;
  }
  function srDateVal(job) {
    // Primary date based on selected column; fallback to the other date so
    // jobs with only one date still sort meaningfully. True nulls go last.
    if (srSortCol === "startDate") {
      const t = toMs(job.startDate);
      return t !== Infinity ? t : toMs(job.goLiveDate || job.liveDate);
    } else {
      const t = toMs(job.goLiveDate || job.liveDate);
      return t !== Infinity ? t : toMs(job.startDate);
    }
  }
  function srSortGroup(arr) {
    return arr.slice().sort((a, b) => {
      // Primary: phase order
      const pDiff = srPhaseVal(a) - srPhaseVal(b);
      if (pDiff !== 0) return pDiff;
      // Secondary: date column (asc/desc)
      const av = srDateVal(a),
        bv = srDateVal(b);
      if (av === Infinity && bv === Infinity) return 0;
      if (av === Infinity) return 1;
      if (bv === Infinity) return -1;
      return srSortDir === "asc" ? av - bv : bv - av;
    });
  }

  const sortArrow = (col) =>
    srSortCol === col ? (srSortDir === "asc" ? " ▲" : " ▼") : " ⇅";
  const thStyle = "cursor:pointer;user-select:none;white-space:nowrap;";

  let html = `<table class="sr-table">
        <thead><tr>
          <th style="width:28px"></th>
          <th>Job Name</th>
          <th>LOB</th>
          <th>Phase</th>
          <th>Producer</th>
          <th>Risk</th>
          <th>Proj%</th>
          <th class="sr-sort-th" data-sort="startDate" style="${thStyle}">Start${sortArrow(
    "startDate"
  )}</th>
          <th class="sr-sort-th" data-sort="goLiveDate" style="${thStyle}">Go-Live${sortArrow(
    "goLiveDate"
  )}</th>
          <th>Status Notes</th>
        </tr></thead><tbody>`;

  const lobKeys = [
    ...LOB_ORDER.filter((l) => grouped[l]),
    ...Object.keys(grouped).filter((l) => !LOB_ORDER.includes(l)),
  ];

  lobKeys.forEach((lob) => {
    html += `<tr><td colspan="10" class="sr-lob-group-header">${lob}</td></tr>`;
    srSortGroup(grouped[lob]).forEach((job) => {
      const isCompleted = (job.phase || "") === "Completed";
      const rowCls = isCompleted ? "sr-completed" : "";
      const startStr = job.startDate
        ? job.startDate.toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          })
        : "—";
      const goLiveStr = job.goLiveDate
        ? job.goLiveDate.toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          })
        : job.liveDate
        ? job.liveDate.toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          })
        : "—";
      const notes = (job.statusNotes || "")
        .replace(/</g, "&lt;")
        .replace(/\n/g, " ");
      const noteSnippet = notes.length > 60 ? notes.slice(0, 60) + "…" : notes;
      const canExpand = canExpandJob(job);
      html += `<tr class="${rowCls}" data-sr-id="${job.id}">
            <td>${
              canExpand
                ? `<button class="sr-expand-btn" data-id="${job.id}" title="Expand">▶</button>`
                : `<span class="sr-lock-span" data-id="${job.id}" title="View only — outside your LOB assignment" style="font-size:0.7rem;color:#9ca3af;cursor:pointer;">🔒</span>`
            }</td>
            <td class="sr-job-name" style="font-weight:600;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${(
              job.name || ""
            ).replace(/"/g, "&quot;")}">${job.name || "Untitled"}</td>
            <td>${job.lob || "—"}</td>
            <td>${job.phase || "—"}</td>
            <td>${job.producer || "—"}</td>
            <td>${srRiskBadge(job.risk)}</td>
            <td style="min-width:90px">${srPctBar(job.projectPct || 0)}</td>
            <td style="white-space:nowrap">${startStr}</td>
            <td style="white-space:nowrap">${goLiveStr}</td>
            <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#6b7280;" title="${notes}">${
        noteSnippet || "—"
      }</td>
          </tr>
          <tr class="sr-detail-row" id="sr-detail-${
            job.id
          }" style="display:none" ${canExpand ? "" : 'data-readonly="true"'}>
            <td colspan="10">${buildDetailPanel(job)}</td>
          </tr>`;
    });
  });

  if (!filtered.length) {
    html += `<tr><td colspan="10" style="text-align:center;padding:24px;color:#9ca3af;">No jobs match the current filter.</td></tr>`;
  }

  html += "</tbody></table>";
  container.innerHTML = html;

  // Sortable date column headers
  container.querySelectorAll(".sr-sort-th").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (srSortCol === col) {
        srSortDir = srSortDir === "asc" ? "desc" : "asc";
      } else {
        srSortCol = col;
        srSortDir = "asc";
      }
      renderStatusReport();
    });
  });

  // Make out-of-LOB detail panels read-only
  container
    .querySelectorAll('.sr-detail-row[data-readonly="true"]')
    .forEach((detailTr) => {
      const panel = detailTr.querySelector(".sr-detail-inner");
      if (!panel) return;
      const notice = document.createElement("div");
      notice.style.cssText =
        "background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:0.8rem;color:#92400e;";
      notice.textContent =
        "🔒 View only — this job is outside your LOB assignment.";
      panel.insertBefore(notice, panel.firstChild);
      panel.querySelectorAll("input, select, textarea").forEach((el) => {
        el.disabled = true;
        el.style.background = "#f9fafb";
        el.style.color = "#6b7280";
        el.style.cursor = "not-allowed";
      });
      const saveRow = panel.querySelector(".sr-save-row");
      if (saveRow) saveRow.style.display = "none";
    });

  // Expand/collapse
  container.querySelectorAll(".sr-expand-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const detailRow = document.getElementById("sr-detail-" + id);
      const isOpen = detailRow.style.display !== "none";
      // Close all others
      container
        .querySelectorAll(".sr-detail-row")
        .forEach((r) => (r.style.display = "none"));
      container
        .querySelectorAll(".sr-expand-btn")
        .forEach((b) => b.classList.remove("open"));
      if (!isOpen) {
        detailRow.style.display = "";
        btn.classList.add("open");
      }
    });
  });

  // Lock icon — click to toggle read-only detail panel
  container.querySelectorAll(".sr-lock-span").forEach((span) => {
    span.addEventListener("click", () => {
      const id = span.dataset.id;
      const detailRow = document.getElementById("sr-detail-" + id);
      const isOpen = detailRow.style.display !== "none";
      container
        .querySelectorAll(".sr-detail-row")
        .forEach((r) => (r.style.display = "none"));
      container
        .querySelectorAll(".sr-expand-btn")
        .forEach((b) => b.classList.remove("open"));
      if (!isOpen) detailRow.style.display = "";
    });
  });

  // Save buttons inside detail panels
  container.querySelectorAll(".sr-save-btn").forEach((btn) => {
    btn.addEventListener("click", () => saveDetailPanel(btn.dataset.id));
  });
  container.querySelectorAll(".sr-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const job = jobs.find((j) => String(j.id) === String(btn.dataset.id));
      if (!job) return;
      if (!confirm(`Delete "${job.name}"?`)) return;
      jobs.splice(jobs.indexOf(job), 1);
      saveStateToStorage();
      renderStatusReport();
      renderSchedule();
    });
  });
  // SLA buttons in status report detail panels
  container.querySelectorAll(".sr-sla-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const jid = btn.dataset.jobid;
      const detailRow = document.getElementById("sr-detail-" + jid);
      if (!detailRow) return;
      const jobObj = jobs.find((j) => String(j.id) === String(jid));
      const jobType = jobObj ? jobObj.jobType || "" : "";
      const rules =
        jobType === "Adopt"
          ? { startToCd: 5, cdToLive: 2, liveToGo: 10 }
          : { startToCd: 3, cdToLive: 2, liveToGo: 7 };
      const gd = (f) => {
        const el = detailRow.querySelector('[data-f="' + f + '"]');
        return el && el.value ? new Date(el.value + "T00:00:00") : null;
      };
      const sd = (f, d) => {
        const el = detailRow.querySelector('[data-f="' + f + '"]');
        if (el && d) el.value = dateToInputValue(d);
      };
      const startD = gd("startDate");
      if (!startD) {
        alert("Set a Start / Kickoff Date first.");
        return;
      }
      const cdD = addBizDays(startD, rules.startToCd);
      sd("cdDate", cdD);
      const liveD = addBizDays(cdD, rules.cdToLive);
      sd("liveDate", liveD);
      sd("goLiveDate", addBizDays(liveD, rules.liveToGo));
      saveDetailPanel(jid, true);
    });
  });

  // Auto-save checkboxes
  container.querySelectorAll(".sr-checkbox").forEach((cb) => {
    cb.addEventListener("change", () =>
      saveDetailPanel(cb.dataset.jobid, true)
    );
  });

  // Estimated hours — compute on open and on any numeric input change
  function updateSrEstHours(jobId) {
    const detailRow = document.getElementById("sr-detail-" + jobId);
    if (!detailRow) return;
    // Read current field values from the panel
    const gn = (f) =>
      parseFloat(
        (detailRow.querySelector('[data-f="' + f + '"]') || {}).value
      ) || 0;
    const social = gn("socialAssets");
    const display = gn("displayAssets");
    const statics = gn("staticAssets");
    const cdOnly = gn("cdOnlyAssets");
    const total = social + display + statics + cdOnly;
    const loe = gn("loe") || 1;
    const fxf = gn("fxfMinutes");
    const hasFxf =
      (detailRow.querySelector('[data-f="hasFxf"]') || {}).value === "YES";
    const devSocM = gn("devMinutesSocial") || 30;
    const devDisM = gn("devMinutesDisplay") || 45;
    const devStaM = gn("devMinutesStatic") || 15;
    const revM = gn("reviewMinutes") || 10;
    const qaM = gn("qaMinutes") || 10;
    const cdM = gn("cdMinutes") || 10;
    const cdDelM = gn("cdDeliveryMinutes") || 10;
    const cdPlace = gn("cdPlacements");
    const cdBasis = cdPlace > 0 ? cdPlace : total;
    const rf = 0.75;

    // Rounds multiplier (applies to Social, Display, Static, Proofing, Creative)
    const roundsEl = detailRow.querySelector('[data-f="estRounds"]');
    const roundsN = parseInt((roundsEl || {}).value) || 1;
    const roundsMult = roundsN <= 1 ? 1 : (1 - Math.pow(0.7, roundsN)) / 0.3;
    const roundsLbl = document.getElementById("srRoundsLbl_" + jobId);
    if (roundsLbl)
      roundsLbl.textContent =
        roundsN +
        " round" +
        (roundsN > 1 ? "s" : "") +
        " · ×" +
        roundsMult.toFixed(2);

    const socH =
      (social > 0
        ? (devSocM * loe + (social - 1) * devSocM * rf * loe) / 60
        : 0) * roundsMult;
    const disH =
      (display > 0
        ? (devDisM * loe + (display - 1) * devDisM * rf * loe) / 60
        : 0) * roundsMult;
    const staH = ((statics * devStaM * loe) / 60) * roundsMult;
    const revH = ((total * revM * loe) / 60) * roundsMult; // Proofing
    const crvH = ((total * qaM * loe) / 60) * roundsMult; // Creative
    const fxfH = hasFxf ? fxf / 60 : 0;
    const qaH = (cdBasis * cdM) / 60; // QA — no rounds
    const cdH = (cdBasis * cdDelM) / 60 + fxfH; // CD — no rounds
    const totH = socH + disH + staH + revH + crvH + qaH + cdH;

    const set = (id, val) => {
      const el = document.getElementById(id + "_" + jobId);
      if (el) el.textContent = val.toFixed(1);
    };
    set("srH_social", socH);
    set("srH_display", disH);
    set("srH_static", staH);
    set("srH_review", revH);
    set("srH_creative", crvH);
    set("srH_qa", qaH);
    set("srH_cd", cdH);
    set("srH_total", totH);
  }

  // Run immediately for each open panel and wire inputs
  container.querySelectorAll(".sr-est-hours").forEach((el) => {
    const jid = el.dataset.jobid;
    updateSrEstHours(jid);
    const detailRow = document.getElementById("sr-detail-" + jid);
    if (!detailRow) return;
    detailRow.querySelectorAll("[data-f]").forEach((input) => {
      input.addEventListener("input", () => updateSrEstHours(jid));
      input.addEventListener("change", () => updateSrEstHours(jid));
    });
  });

  // Phase changes → repopulate Task dropdown
  container.querySelectorAll(".sr-phase-select").forEach((phaseSel) => {
    phaseSel.addEventListener("change", () => {
      const detailRow = document.getElementById(
        "sr-detail-" + phaseSel.dataset.jobid
      );
      if (!detailRow) return;
      const taskSel = detailRow.querySelector(".sr-task-select");
      if (taskSel) {
        const tasks = TASKS_BY_PHASE[phaseSel.value] || [];
        taskSel.innerHTML =
          `<option value="">—</option>` +
          tasks.map((t) => `<option>${t}</option>`).join("");
      }
    });
  });

  // Auto-fill Proj %, CP % and Producer % when Project Task changes
  container.querySelectorAll(".sr-task-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const detailRow = document.getElementById(
        "sr-detail-" + sel.dataset.jobid
      );
      if (!detailRow) return;
      const pct = taskToPct(sel.value);
      if (pct !== null) {
        const el = detailRow.querySelector('[data-f="projectPct"]');
        if (el) {
          el.value = pct;
          el.style.background = "#d1fae5";
        }
      }
      const cpPct = taskToCpPct(sel.value);
      if (cpPct !== null) {
        const el = detailRow.querySelector('[data-f="cpPct"]');
        if (el) {
          el.value = cpPct;
          el.style.background = "#d1fae5";
        }
      }
      const producerPct = taskToProducerPct(sel.value);
      if (producerPct !== null) {
        const el = detailRow.querySelector('[data-f="producerPct"]');
        if (el) {
          el.value = producerPct;
          el.style.background = "#d1fae5";
        }
      }
    });
  });
  // Auto-update Total Assets display when individual asset counts change
  container
    .querySelectorAll(
      '[data-f="socialAssets"],[data-f="displayAssets"],[data-f="staticAssets"],[data-f="cdOnlyAssets"]'
    )
    .forEach((inp) => {
      inp.addEventListener("input", () => {
        const detailRow = inp.closest(".sr-detail-row");
        if (!detailRow) return;
        const jobId = detailRow.id.replace("sr-detail-", "");
        const get = (f) =>
          parseFloat(detailRow.querySelector('[data-f="' + f + '"]')?.value) ||
          0;
        const total =
          get("socialAssets") +
          get("displayAssets") +
          get("staticAssets") +
          get("cdOnlyAssets");
        const display = document.getElementById("srTotalAssets_" + jobId);
        if (display) display.textContent = total;
        const hidden = detailRow.querySelector('[data-f="totalAssets"]');
        if (hidden) hidden.value = total;
      });
    });
}

function buildDetailPanel(job) {
  const cl = job.checklist || {};
  const checklistHtml = CHECKLIST_KEYS.map(
    (c) =>
      `<label class="sr-check-item">
          <input type="checkbox" class="sr-checkbox" data-jobid="${
            job.id
          }" data-key="${c.key}" ${cl[c.key] ? "checked" : ""}>
          ${c.label}
        </label>`
  ).join("");

  const phaseOpts = PHASE_OPTIONS.map(
    (p) => `<option ${(job.phase || "") == p ? "selected" : ""}>${p}</option>`
  ).join("");
  const riskOpts = RISK_OPTIONS.map(
    (r) => `<option ${(job.risk || "") == r ? "selected" : ""}>${r}</option>`
  ).join("");
  const typeOpts = PROJECT_TYPES.map(
    (t) => `<option ${(job.jobType || "") == t ? "selected" : ""}>${t}</option>`
  ).join("");

  // Build task options for current phase
  function buildTaskOpts(phase, currentTask) {
    const tasks = TASKS_BY_PHASE[phase] || TASK_OPTIONS;
    return (
      `<option value="">—</option>` +
      tasks
        .map(
          (t) => `<option ${currentTask === t ? "selected" : ""}>${t}</option>`
        )
        .join("")
    );
  }
  const lobOpts = ["BUS", "MOB", "FIB", "FNT"]
    .map(
      (l) => `<option ${(job.lob || "") == l ? "selected" : ""}>${l}</option>`
    )
    .join("");

  const row = (cols) =>
    `<div class="sr-detail-row-grid" style="display:grid;grid-template-columns:repeat(${
      cols.length
    },1fr);gap:8px 14px;margin-bottom:10px;">${cols.join("")}</div>`;
  const f = (label, inner) =>
    `<div class="sr-field"><label>${label}</label>${inner}</div>`;
  const inp = (df, val, type = "text", extra = "") =>
    `<input data-f="${df}" type="${type}" value="${val}" ${extra}>`;
  const sel = (df, opts, extra = "") =>
    `<select data-f="${df}" ${extra}>${opts}</select>`;

  return `<div class="sr-detail-inner" style="display:block;padding:16px 20px;">

        <!-- Row 1: Job Name/WF ID · LOB · Scope ID · Hispanic Market -->
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px 14px;margin-bottom:10px;">
          ${f(
            "Job Name / WF ID",
            `<input data-f="name" value="${(job.name || "").replace(
              /"/g,
              "&quot;"
            )}" style="width:100%">`
          )}
          ${f(
            "LOB",
            `<select data-f="lob"><option value="">—</option>${lobOpts}</select>`
          )}
          ${f("Scope ID", inp("scopeId", job.scopeId || ""))}
          ${f(
            "Hispanic Market",
            `<select data-f="includesHM"><option value="">—</option><option ${
              job.includesHM === "YES" ? "selected" : ""
            }>YES</option><option ${
              job.includesHM === "NO" ? "selected" : ""
            }>NO</option></select>`
          )}
        </div>

        <!-- Row 2: Marketer · Client Partner · Producer -->
        ${row([
          f("Marketer", inp("marketer", job.marketer || "")),
          f(
            "Client Partner",
            `<input data-f="cp"       value="${(job.cp || "").replace(
              /"/g,
              "&quot;"
            )}"       list="dlCp"       autocomplete="off" style="width:100%;">`
          ),
          f(
            "Producer",
            `<input data-f="producer" value="${(job.producer || "").replace(
              /"/g,
              "&quot;"
            )}" list="dlProducer" autocomplete="off" style="width:100%;">`
          ),
          f("Media Partner", inp("mediaPartner", job.mediaPartner || "")),
        ])}

        <!-- Row 3: Project Type · Project Phase · Complexity/LOE · Risk -->
        ${row([
          f(
            "Project Type",
            `<select data-f="jobType"><option value="">—</option>${typeOpts}</select>`
          ),
          f(
            "Project Phase",
            `<select data-f="phase" class="sr-phase-select" data-jobid="${job.id}">${phaseOpts}</select>`
          ),
          f("Complexity / LOE", inp("loe", job.loe || "", "text")),
          f("Risk", sel("risk", riskOpts)),
        ])}

        <!-- Row 4: Project Task · Proj% · CP% · Producer% -->
        ${row([
          f(
            "Project Task",
            `<select data-f="projectTask" class="sr-task-select" data-jobid="${
              job.id
            }">${buildTaskOpts(
              job.phase || "",
              job.projectTask || ""
            )}</select>`
          ),
          f(
            "Proj % Complete",
            inp(
              "projectPct",
              job.projectPct || 0,
              "number",
              'min="0" max="100" step="0.5"'
            )
          ),
          f(
            "Client Partner % Complete",
            inp(
              "cpPct",
              job.cpPct || 0,
              "number",
              'min="0" max="100" step="0.5"'
            )
          ),
          f(
            "Producer % Complete",
            inp(
              "producerPct",
              job.producerPct || 0,
              "number",
              'min="0" max="100" step="0.5"'
            )
          ),
        ])}

        <!-- Row 5: Dates -->
        <div style="display:flex;align-items:center;gap:8px;margin:6px 0 4px;">
          <div style="font-size:0.68rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Project Dates</div>
          <button type="button" class="sr-sla-btn" data-jobid="${
            job.id
          }" title="Auto-fill empty dates from Start Date using SLA rules"
            style="font-size:0.65rem;padding:1px 7px;height:20px;border-radius:4px;border:1px solid #009FDB;background:#fff;color:#009FDB;font-weight:700;cursor:pointer;line-height:1;">↻ SLA</button>
        </div>
        ${row([
          f(
            "Start / Kickoff Date",
            inp("startDate", srDateStr(job.startDate), "date")
          ),
          f("Handoff to CD", inp("cdDate", srDateStr(job.cdDate), "date")),
          f("Media Handoff", inp("liveDate", srDateStr(job.liveDate), "date")),
          f(
            "Target Go-Live",
            inp("goLiveDate", srDateStr(job.goLiveDate), "date")
          ),
        ])}

        <!-- Section: Scheduling -->
        <div style="display:flex;align-items:center;gap:10px;margin:10px 0 6px;">
          <div style="font-size:0.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">Scheduling</div>
          <label for="srRounds_${
            job.id
          }" style="font-size:0.68rem;font-weight:700;color:#00388F;white-space:nowrap;">Est. Rounds</label>
          <input id="srRounds_${
            job.id
          }" data-f="estRounds" type="range" min="1" max="5" step="1" value="${
    job.estRounds || 1
  }"
            style="width:100px;height:4px;accent-color:#009FDB;cursor:pointer;padding:0;background:none;border:none;box-shadow:none;">
          <span id="srRoundsLbl_${
            job.id
          }" style="font-size:0.72rem;font-weight:700;color:#009FDB;white-space:nowrap;">—</span>
        </div>

        <!-- Row 6: Assignees — Social Dev · Display Dev · Static Dev · Creative -->
        ${row([
          f(
            "Social Dev",
            `<input data-f="assigneeSocial"  value="${
              job.assigneeSocial || ""
            }"  list="dlSocial">`
          ),
          f(
            "Display Dev",
            `<input data-f="assigneeDisplay" value="${
              job.assigneeDisplay || ""
            }" list="dlDisplay">`
          ),
          f(
            "Static Dev",
            `<input data-f="assigneeStatic"  value="${
              job.assigneeStatic || ""
            }"  list="dlStatics">`
          ),
          f(
            "Creative",
            `<input data-f="assigneeAd"      value="${
              job.assigneeAd || ""
            }"      list="dlCreative">`
          ),
        ])}

        <!-- Row 7: Proofing · QA · Content Delivery -->
        ${row([
          f(
            "Proofing",
            `<input data-f="assigneeQa"      value="${
              job.assigneeQa || ""
            }"      list="dlProofing">`
          ),
          f(
            "QA",
            `<input data-f="assigneeCd"      value="${
              job.assigneeCd || ""
            }"      list="dlQA">`
          ),
          f(
            "Content Delivery",
            `<input data-f="assigneeContent" value="${
              job.assigneeContent || ""
            }" list="dlContent">`
          ),
          "<div></div>",
        ])}

        <!-- Row 8: Asset counts -->
        <div style="font-size:0.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:10px 0 6px;">Asset Counts</div>
        ${row([
          f(
            "FxF",
            `<select data-f="hasFxf" class="sr-fxf-toggle" data-jobid="${
              job.id
            }"><option value="">—</option><option ${
              job.hasFxf === "YES" ? "selected" : ""
            }>YES</option><option ${
              job.hasFxf === "NO" ? "selected" : ""
            }>NO</option></select>`
          ),
          f(
            "Social Assets",
            inp(
              "socialAssets",
              job.socialAssets || "",
              "number",
              'min="0" placeholder="0"'
            )
          ),
          f(
            "Display Assets",
            inp(
              "displayAssets",
              job.displayAssets || "",
              "number",
              'min="0" placeholder="0"'
            )
          ),
          f(
            "Static Assets",
            inp(
              "staticAssets",
              job.staticAssets || "",
              "number",
              'min="0" placeholder="0"'
            )
          ),
          f(
            "CD Only",
            inp(
              "cdOnlyAssets",
              job.cdOnlyAssets || "",
              "number",
              'min="0" placeholder="0"'
            )
          ),
          f(
            "CD Placements/Lines",
            inp(
              "cdPlacements",
              job.cdPlacements || "",
              "number",
              'min="0" placeholder="0"'
            )
          ),
          f(
            "Total Assets",
            `<div id="srTotalAssets_${
              job.id
            }" style="font-size:0.9rem;font-weight:700;color:#00388F;padding:4px 0;">${
              (job.socialAssets || 0) +
                (job.displayAssets || 0) +
                (job.staticAssets || 0) +
                (job.cdOnlyAssets || 0) ||
              job.totalAssets ||
              0
            }</div><input type="hidden" data-f="totalAssets" value="${
              (job.socialAssets || 0) +
                (job.displayAssets || 0) +
                (job.staticAssets || 0) +
                (job.cdOnlyAssets || 0) ||
              job.totalAssets ||
              0
            }">`
          ),
        ])}

        <!-- Row 9: Hour estimates (mins) -->
        <div style="font-size:0.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:10px 0 6px;">Task Time (mins)</div>
        ${row([
          f(
            "FxF",
            inp("fxfMinutes", job.fxfMinutes || 30, "number", 'min="0"')
          ),
          f(
            "Social",
            inp(
              "devMinutesSocial",
              job.devMinutesSocial || 30,
              "number",
              'min="0"'
            )
          ),
          f(
            "Display",
            inp(
              "devMinutesDisplay",
              job.devMinutesDisplay || 45,
              "number",
              'min="0"'
            )
          ),
          f(
            "Static",
            inp(
              "devMinutesStatic",
              job.devMinutesStatic || 15,
              "number",
              'min="0"'
            )
          ),
          f(
            "Proofing",
            inp("reviewMinutes", job.reviewMinutes || 10, "number", 'min="0"')
          ),
          f(
            "Creative",
            inp("qaMinutes", job.qaMinutes || 10, "number", 'min="0"')
          ),
          f("QA", inp("cdMinutes", job.cdMinutes || 10, "number", 'min="0"')),
          f(
            "CD",
            inp(
              "cdDeliveryMinutes",
              job.cdDeliveryMinutes || 10,
              "number",
              'min="0"'
            )
          ),
        ])}

        <!-- Estimated Hours (computed from assets × minutes) -->
        <div style="font-size:0.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:10px 0 6px;">Estimated Hours <span style="font-size:0.62rem;font-weight:500;color:#009FDB;text-transform:none;letter-spacing:0;">(rounds apply to Social/Display/Static/Proofing/Creative)</span></div>
        <div class="sr-est-hours" data-jobid="${
          job.id
        }" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          ${[
            "Social Dev",
            "Display Dev",
            "Static Dev",
            "Proofing",
            "Creative",
            "QA",
            "CD",
          ]
            .map((lbl, i) => {
              const keys = [
                "srH_social",
                "srH_display",
                "srH_static",
                "srH_review",
                "srH_creative",
                "srH_qa",
                "srH_cd",
              ];
              return `<div style="flex:1;min-width:70px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;text-align:center;">
              <div style="font-size:0.65rem;color:#6b7280;font-weight:700;text-transform:uppercase;">${lbl}</div>
              <div style="font-size:1rem;font-weight:700;color:#00388F;" id="${keys[i]}_${job.id}">—</div>
            </div>`;
            })
            .join("")}
          <div style="flex:1;min-width:80px;background:#e0f2fe;border:1px solid #009FDB;border-radius:6px;padding:6px 8px;text-align:center;">
            <div style="font-size:0.65rem;color:#00388F;font-weight:700;text-transform:uppercase;">Total</div>
            <div style="font-size:1rem;font-weight:700;color:#00388F;" id="srH_total_${
              job.id
            }">—</div>
          </div>
        </div>

        <!-- Links & extras -->
        <div style="font-size:0.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:10px 0 6px;">Links &amp; Details</div>
        ${row([
          f("SharePoint Link", inp("sharepointLink", job.sharepointLink || "")),
          f("Bynder Link", inp("bynderLink", job.bynderLink || "")),
        ])}
        ${row([
          f(
            "Bynder Archive Link",
            inp("bynderArchiveLink", job.bynderArchiveLink || "")
          ),
          f("AdPiler Link", inp("adpilerLink", job.adpilerLink || "")),
        ])}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-bottom:10px;">
          <div class="sr-field"><label>Current Status Notes</label><textarea data-f="statusNotes" rows="3" style="width:100%;font-size:0.8rem;padding:4px 8px;border:1px solid #d1d5db;border-radius:5px;font-family:inherit;">${
            job.statusNotes || ""
          }</textarea></div>
          <div class="sr-field"><label>Risk Notes</label><textarea data-f="riskNotes" rows="3" style="width:100%;font-size:0.8rem;padding:4px 8px;border:1px solid #d1d5db;border-radius:5px;font-family:inherit;">${
            job.riskNotes || ""
          }</textarea></div>
        </div>

        <!-- Trafficking Checklist -->
        <div class="sr-checklist">
          <div style="font-size:0.72rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Trafficking Checklist</div>
          <div class="sr-checklist-grid">${checklistHtml}</div>
        </div>

        <div class="sr-save-row">
          <button class="sr-delete-btn" data-id="${
            job.id
          }">🗑 Delete Job</button>
          <button class="sr-save-btn" data-id="${
            job.id
          }">✓ Save Changes</button>
        </div>
      </div>`;
}

function saveDetailPanel(jobId, silent) {
  const job = jobs.find((j) => String(j.id) === String(jobId));
  if (!job) return;
  if (!canExpandJob(job)) return; // LOB restriction — no write access
  const detailRow = document.getElementById("sr-detail-" + jobId);
  if (!detailRow) return;

  // Text / select fields
  detailRow.querySelectorAll("[data-f]").forEach((el) => {
    const f = el.dataset.f;
    const v = el.value;
    if (["startDate", "cdDate", "liveDate", "goLiveDate"].includes(f)) {
      job[f] = srParseDate(v);
    } else if (
      [
        "projectPct",
        "cpPct",
        "producerPct",
        "totalAssets",
        "cdPlacements",
        "socialAssets",
        "displayAssets",
        "staticAssets",
        "cdOnlyAssets",
        "fxfAssets",
        "fxfMinutes",
        "devMinutesSocial",
        "devMinutesDisplay",
        "devMinutesStatic",
        "reviewMinutes",
        "qaMinutes",
        "cdMinutes",
        "cdDeliveryMinutes",
      ].includes(f)
    ) {
      job[f] = v === "" ? null : parseFloat(v);
    } else {
      job[f] = v;
    }
  });

  // Checkboxes
  if (!job.checklist) job.checklist = {};
  detailRow.querySelectorAll(".sr-checkbox").forEach((cb) => {
    job.checklist[cb.dataset.key] = cb.checked;
  });

  saveStateToStorage();
  if (!silent) {
    renderStatusReport();
    renderSchedule();
  } else {
    // Just update the summary row in place
    const summaryRow = document.querySelector(`tr[data-sr-id="${jobId}"]`);
    if (summaryRow) {
      const riskTd = summaryRow.cells[5];
      if (riskTd) riskTd.innerHTML = srRiskBadge(job.risk);
      const pctTd = summaryRow.cells[6];
      if (pctTd) pctTd.innerHTML = srPctBar(job.projectPct || 0);
    }
  }
}

// New Job button — creates a blank job and opens its detail panel
const srAddJobBtn = document.getElementById("srAddJobBtn");
if (srAddJobBtn) {
  srAddJobBtn.addEventListener("click", openNewJobModal);
}

// SR filter listeners
["srFilterLob", "srFilterType", "srFilterPhase", "srFilterName"].forEach(
  (id) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener(
        id === "srFilterName" ? "input" : "change",
        renderStatusReport
      );
  }
);

// Export XLSX
const srExportXlsxBtn = document.getElementById("srExportXlsxBtn");
if (srExportXlsxBtn) {
  srExportXlsxBtn.addEventListener("click", exportStatusReportXlsx);
}

function exportStatusReportXlsx() {
  if (typeof XLSX === "undefined") {
    alert("SheetJS not loaded.");
    return;
  }
  const LOB_ORDER_EXP = ["BUS", "MOB", "FIB", "FNT"];
  const grouped = {};
  jobs.forEach((j) => {
    const lob = (j.lob || "OTHER").toUpperCase();
    if (!grouped[lob]) grouped[lob] = [];
    grouped[lob].push(j);
  });

  const headers = [
    "Project Name",
    "Project Type",
    "Project Phase",
    "Project Task",
    "Complexity",
    "Project % Complete",
    "CP % Complete",
    "Producer % Complete",
    "Project Risk",
    "Risk Notes",
    "Current Status Notes",
    "Project Kickoff Date",
    "Handoff to CD Date",
    "1876 Handoff/CD Ship Date",
    "Target Go-Live Date",
    "Marketers",
    "CP",
    "PRODUCER",
    "Media Partner",
    "Asset Count",
    "Line Count",
    "AdPiler Link",
    "Bynder Link",
    "Scope ID",
    "Includes Hispanic Market?",
  ].concat(CHECKLIST_KEYS.map((c) => c.label));

  const rows = [["BUSINESS"], headers];
  const lobKeys = [
    ...LOB_ORDER_EXP.filter((l) => grouped[l]),
    ...Object.keys(grouped).filter((l) => !LOB_ORDER_EXP.includes(l)),
  ];
  let activeSection = true;
  lobKeys.forEach((lob) => {
    grouped[lob].forEach((j) => {
      const isCompleted = (j.phase || "") === "Completed";
      if (activeSection && isCompleted) {
        rows.push(["COMPLETED PROJECTS GO UNDER HERE"]);
        activeSection = false;
      }
      const cl = j.checklist || {};
      const fmtDate = (d) =>
        d ? (d instanceof Date ? d : new Date(d)).toLocaleDateString() : "";
      rows.push(
        [
          j.name || "",
          j.jobType || "",
          j.phase || "",
          j.projectTask || "",
          j.loe || "",
          j.projectPct || 0,
          j.cpPct || 0,
          j.producerPct || 0,
          j.risk || "On Track",
          j.riskNotes || "",
          j.statusNotes || "",
          fmtDate(j.startDate),
          fmtDate(j.cdDate),
          fmtDate(j.liveDate),
          fmtDate(j.goLiveDate),
          j.marketer || "",
          j.cp || "",
          j.producer || "",
          j.mediaPartner || "",
          j.totalAssets || "",
          j.cdPlacements || "",
          j.adpilerLink || "",
          j.bynderLink || "",
          j.scopeId || "",
          j.includesHM || "",
        ].concat(CHECKLIST_KEYS.map((c) => (cl[c.key] ? "TRUE" : "FALSE")))
      );
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Status Report");
  XLSX.writeFile(
    wb,
    `1876_Status_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

// ── New Job Modal ─────────────────────────────────────────────────────────
let _modalJobId = null;

function openEditJobModal(job) {
  _modalJobId = job.id;
  _modalIsNew = false;
  const body = document.getElementById("jobFormModalBody");
  body.innerHTML =
    '<div id="sr-detail-' +
    job.id +
    '" class="sr-detail-row">' +
    buildDetailPanel(job) +
    "</div>";
  wireModalPanel(job.id);
  const titleEl = document.querySelector(
    '#jobFormModal div[style*="background:#00388F"] span'
  );
  if (titleEl) titleEl.textContent = "Edit Job";
  document.getElementById("jobFormModal").style.display = "";
}

function openNewJobModal() {
  _modalJobId = Date.now();
  _modalIsNew = true;
  const titleEl = document.querySelector(
    '#jobFormModal div[style*="background:#00388F"] span'
  );
  if (titleEl) titleEl.textContent = "New Job";
  const newJob = {
    id: _modalJobId,
    name: "",
    lob: "",
    phase: "Discovery",
    jobType: "",
    loe: "1",
    startDate: null,
    cdDate: null,
    liveDate: null,
    goLiveDate: null,
    producer: "",
    cp: "",
    marketer: "",
    mediaPartner: "",
    risk: "On Track",
    statusNotes: "",
    riskNotes: "",
    projectPct: 0,
    cpPct: 0,
    producerPct: 0,
    scopeId: "",
    adpilerLink: "",
    bynderLink: "",
    bynderArchiveLink: "",
    sharepointLink: "",
    includesHM: "",
    hasFxf: "NO",
    projectTask: "",
    totalAssets: null,
    cdPlacements: null,
    checklist: {},
    estRounds: 1,
    devMinutesSocial: 30,
    devMinutesDisplay: 45,
    devMinutesStatic: 15,
    reviewMinutes: 10,
    qaMinutes: 10,
    cdMinutes: 10,
    cdDeliveryMinutes: 10,
    fxfMinutes: 30,
    createdAt: new Date().toISOString(),
  };
  jobs.push(newJob);
  const body = document.getElementById("jobFormModalBody");
  body.innerHTML =
    '<div id="sr-detail-' +
    _modalJobId +
    '" class="sr-detail-row">' +
    buildDetailPanel(newJob) +
    "</div>";
  wireModalPanel(_modalJobId);
  document.getElementById("jobFormModal").style.display = "";
  // Clear name input and focus it
  const nameInput = body.querySelector('[data-f="name"]');
  if (nameInput) {
    nameInput.value = "";
    nameInput.focus();
  }
}

function closeJobFormModal(cancel) {
  if (cancel && _modalIsNew && _modalJobId != null) {
    const idx = jobs.findIndex((j) => String(j.id) === String(_modalJobId));
    if (idx !== -1) jobs.splice(idx, 1);
    saveStateToStorage();
  }
  _modalJobId = null;
  _modalIsNew = false;
  document.getElementById("jobFormModal").style.display = "none";
}

function wireModalPanel(jobId) {
  // Prefer the element inside the modal body to avoid duplicate-ID conflicts
  // with any inline status-report row that may be open at the same time.
  const _modalBody = document.getElementById("jobFormModalBody");
  const detailEl =
    (_modalBody &&
      _modalBody.querySelector('[id="sr-detail-' + jobId + '"]')) ||
    document.getElementById("sr-detail-" + jobId);
  if (!detailEl) return;
  // Hide the built-in save/delete row — modal footer has its own buttons
  const saveRow = detailEl.querySelector(".sr-save-row");
  if (saveRow) saveRow.style.display = "none";

  // Replace datalist-backed <input list="…"> with <select> so the full
  // list of resources is always visible — not filtered to the current value.
  detailEl.querySelectorAll("input[list]").forEach(function (inp) {
    const dl = document.getElementById(inp.getAttribute("list") || "");
    const currentVal = inp.value || "";
    const sel = document.createElement("select");
    // Preserve data-* attributes so saveDetailPanel still reads data-f
    Array.from(inp.attributes).forEach(function (a) {
      if (a.name.startsWith("data-")) sel.setAttribute(a.name, a.value);
    });
    if (inp.style.cssText) sel.style.cssText = inp.style.cssText;
    if (inp.className) sel.className = inp.className;
    // Build option list from the datalist
    const dlVals = dl
      ? Array.from(dl.options).map(function (o) {
          return o.value;
        })
      : [];
    // Preserve a value that isn't currently in the datalist (e.g. legacy name)
    const allVals = [""].concat(
      currentVal && !dlVals.includes(currentVal)
        ? [currentVal].concat(dlVals)
        : dlVals
    );
    sel.innerHTML = allVals
      .map(function (v) {
        return (
          '<option value="' +
          v.replace(/"/g, "&quot;") +
          '"' +
          (v === currentVal ? " selected" : "") +
          ">" +
          (v || "—") +
          "</option>"
        );
      })
      .join("");
    inp.parentNode.replaceChild(sel, inp);
  });

  // SLA button
  detailEl.querySelectorAll(".sr-sla-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const jid = btn.dataset.jobid;
      const jobObj = jobs.find(function (j) {
        return String(j.id) === String(jid);
      });
      const jobType = jobObj ? jobObj.jobType || "" : "";
      const rules =
        jobType === "Adopt"
          ? { startToCd: 5, cdToLive: 2, liveToGo: 10 }
          : { startToCd: 3, cdToLive: 2, liveToGo: 7 };
      const gd = function (f) {
        const el = detailEl.querySelector('[data-f="' + f + '"]');
        return el && el.value ? new Date(el.value + "T00:00:00") : null;
      };
      const sd = function (f, d) {
        const el = detailEl.querySelector('[data-f="' + f + '"]');
        if (el && d) el.value = dateToInputValue(d);
      };
      const startD = gd("startDate");
      if (!startD) {
        alert("Set a Start / Kickoff Date first.");
        return;
      }
      const cdD = addBizDays(startD, rules.startToCd);
      sd("cdDate", cdD);
      const liveD = addBizDays(cdD, rules.cdToLive);
      sd("liveDate", liveD);
      sd("goLiveDate", addBizDays(liveD, rules.liveToGo));
    });
  });

  // Checkboxes — silent save
  detailEl.querySelectorAll(".sr-checkbox").forEach(function (cb) {
    cb.addEventListener("change", function () {
      saveDetailPanel(cb.dataset.jobid, true);
    });
  });

  // Est hours computation (inline copy of updateSrEstHours logic)
  // Pre-resolve the output elements by walking detailEl directly — avoids any
  // document.getElementById confusion with duplicate IDs in the SR table.
  const _srHEls = {};
  [
    "srH_social",
    "srH_display",
    "srH_static",
    "srH_review",
    "srH_creative",
    "srH_qa",
    "srH_cd",
    "srH_total",
  ].forEach(function (key) {
    detailEl.querySelectorAll("div[id]").forEach(function (d) {
      if (d.id === key + "_" + jobId) _srHEls[key] = d;
    });
  });
  const _roundsLblEl = (function () {
    let found = null;
    detailEl.querySelectorAll("span[id]").forEach(function (s) {
      if (s.id === "srRoundsLbl_" + jobId) found = s;
    });
    return found;
  })();

  function calcModalEstHours() {
    const dr = detailEl;
    if (!dr) return;
    const gn = function (f) {
      return (
        parseFloat((dr.querySelector('[data-f="' + f + '"]') || {}).value) || 0
      );
    };
    const social = gn("socialAssets"),
      display = gn("displayAssets"),
      statics = gn("staticAssets"),
      cdOnly = gn("cdOnlyAssets");
    const total = social + display + statics + cdOnly;
    const loe = gn("loe") || 1;
    const fxf = gn("fxfMinutes"),
      hasFxf = (dr.querySelector('[data-f="hasFxf"]') || {}).value === "YES";
    const devSocM = gn("devMinutesSocial") || 30,
      devDisM = gn("devMinutesDisplay") || 45,
      devStaM = gn("devMinutesStatic") || 15;
    const revM = gn("reviewMinutes") || 10,
      qaM = gn("qaMinutes") || 10,
      cdM = gn("cdMinutes") || 10,
      cdDelM = gn("cdDeliveryMinutes") || 10;
    const cdPlace = gn("cdPlacements"),
      cdBasis = cdPlace > 0 ? cdPlace : total,
      rf = 0.75;
    const roundsEl = dr.querySelector('[data-f="estRounds"]');
    const roundsN = parseInt((roundsEl || {}).value) || 1;
    const roundsMult = roundsN <= 1 ? 1 : (1 - Math.pow(0.7, roundsN)) / 0.3;
    if (_roundsLblEl)
      _roundsLblEl.textContent =
        roundsN +
        " round" +
        (roundsN > 1 ? "s" : "") +
        " \u00d7" +
        roundsMult.toFixed(2);
    const socH =
      (social > 0
        ? (devSocM * loe + (social - 1) * devSocM * rf * loe) / 60
        : 0) * roundsMult;
    const disH =
      (display > 0
        ? (devDisM * loe + (display - 1) * devDisM * rf * loe) / 60
        : 0) * roundsMult;
    const staH = ((statics * devStaM * loe) / 60) * roundsMult;
    const revH = ((total * revM * loe) / 60) * roundsMult;
    const crvH = ((total * qaM * loe) / 60) * roundsMult;
    const fxfH = hasFxf ? fxf / 60 : 0;
    const qaH = (cdBasis * cdM) / 60;
    const cdH = (cdBasis * cdDelM) / 60 + fxfH;
    const totH = socH + disH + staH + revH + crvH + qaH + cdH;
    const vals = {
      srH_social: socH,
      srH_display: disH,
      srH_static: staH,
      srH_review: revH,
      srH_creative: crvH,
      srH_qa: qaH,
      srH_cd: cdH,
      srH_total: totH,
    };
    Object.keys(vals).forEach(function (k) {
      if (_srHEls[k]) _srHEls[k].textContent = vals[k].toFixed(1);
    });
  }
  calcModalEstHours();
  detailEl.querySelectorAll("[data-f]").forEach(function (input) {
    input.addEventListener("input", function () {
      calcModalEstHours();
    });
    input.addEventListener("change", function () {
      calcModalEstHours();
    });
  });

  // Phase → repopulate Task dropdown
  detailEl.querySelectorAll(".sr-phase-select").forEach(function (phaseSel) {
    phaseSel.addEventListener("change", function () {
      const taskSel = detailEl.querySelector(".sr-task-select");
      if (taskSel) {
        const tasks = TASKS_BY_PHASE[phaseSel.value] || [];
        taskSel.innerHTML =
          '<option value="">\u2014</option>' +
          tasks
            .map(function (t) {
              return "<option>" + t + "</option>";
            })
            .join("");
      }
    });
  });

  // Task → pct auto-fill
  detailEl.querySelectorAll(".sr-task-select").forEach(function (sel) {
    sel.addEventListener("change", function () {
      const pct = taskToPct(sel.value);
      if (pct !== null) {
        const el = detailEl.querySelector('[data-f="projectPct"]');
        if (el) {
          el.value = pct;
          el.style.background = "#d1fae5";
        }
      }
      const cpPct = taskToCpPct(sel.value);
      if (cpPct !== null) {
        const el = detailEl.querySelector('[data-f="cpPct"]');
        if (el) {
          el.value = cpPct;
          el.style.background = "#d1fae5";
        }
      }
      const prodPct = taskToProducerPct(sel.value);
      if (prodPct !== null) {
        const el = detailEl.querySelector('[data-f="producerPct"]');
        if (el) {
          el.value = prodPct;
          el.style.background = "#d1fae5";
        }
      }
    });
  });

  // Total assets auto-update
  detailEl
    .querySelectorAll(
      '[data-f="socialAssets"],[data-f="displayAssets"],[data-f="staticAssets"],[data-f="cdOnlyAssets"]'
    )
    .forEach(function (inp) {
      inp.addEventListener("input", function () {
        const get = function (f) {
          return (
            parseFloat(
              (detailEl.querySelector('[data-f="' + f + '"]') || {}).value
            ) || 0
          );
        };
        const tot =
          get("socialAssets") +
          get("displayAssets") +
          get("staticAssets") +
          get("cdOnlyAssets");
        const dispEl = document.getElementById("srTotalAssets_" + jobId);
        if (dispEl) dispEl.textContent = tot;
        const hidden = detailEl.querySelector('[data-f="totalAssets"]');
        if (hidden) hidden.value = tot;
      });
    });
}

// Wire modal footer buttons + Esc + backdrop via event delegation (modal HTML is after this script)
document.addEventListener("click", function (e) {
  if (e.target && e.target.id === "jobFormModalClose") {
    closeJobFormModal(true);
    return;
  }
  if (e.target && e.target.id === "jobFormModalCancel") {
    closeJobFormModal(true);
    return;
  }
  if (e.target && e.target.id === "jobFormModalSave") {
    if (_modalJobId == null) return;
    saveDetailPanel(String(_modalJobId), true);
    closeJobFormModal(false);
    var srfp = document.getElementById("srFilterPhase");
    if (srfp) srfp.value = "active";
    renderStatusReport();
    renderSchedule();
    return;
  }
  if (e.target && e.target.id === "jobFormModal") {
    closeJobFormModal(true);
    return;
  }
});
document.addEventListener("keydown", function (e) {
  if (
    e.key === "Escape" &&
    document.getElementById("jobFormModal").style.display !== "none"
  )
    closeJobFormModal(true);
});


SS_WP.init();
}); // end DOMContentLoaded
