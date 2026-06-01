<?php
/**
 * Shortcode template for 1876 Production Suite.
 * Rendered by p1876_render_shortcode() via [1876_scheduler] shortcode.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$logo_png = P1876_URL . 'assets/brand/1876_Productions_WM_RGB_Pos.png';
$logo_svg = P1876_URL . 'assets/brand/1876-logo.svg';
?>
<div id="ss-root">

  <!-- ── Navbar ─────────────────────────────────────────────────────────── -->
  <div class="navbar">
    <div class="navbar-inner">
      <div class="brand">
        <img src="<?php echo esc_url( $logo_png ); ?>"
             alt="1876 Productions"
             class="logo"
             onerror="this.onerror=null; this.src='<?php echo esc_url( $logo_svg ); ?>'">
      </div>
      <div class="nav-title">Studio Production Scheduler <span class="small"><?php echo esc_html( P1876_VERSION ); ?></span></div>
      <div class="spacer"></div>

      <div class="nav-user-group">
        <span id="navRoleBadge" class="nav-role-badge">View</span>
        <div id="navUserDisplay"
             title="Click to change your name"
             class="nav-user-btn">
        </div>
        <span id="navUserNotYou"
              title="Click to change your name"
              class="nav-not-you"
              style="display:none;">
          Not you?
        </span>
      </div>

      <div class="nav-db-group">
        <span id="fsaStatus" class="nav-status-text">&#9675; Loading&hellip;</span>
        <button id="connectFileBtn" class="nav-connect-btn">Connect to Database</button>
      </div>

    </div>
  </div>

  <!-- ── App shell ──────────────────────────────────────────────────────── -->
  <div class="app-shell">

    <div class="header">
      <div>
        <div class="subtitle">
          Project Capacity and Schedule Planning for Development, Creative Review,
          QA, and Content Delivery. This provides a 6-week view.
        </div>
      </div>
      <div class="pill">v<?php echo esc_html( P1876_VERSION ); ?> &middot; Live</div>
    </div>

    <div class="tab-bar">
      <button type="button" class="tab active" data-view="calendar">Calendar</button>
      <button type="button" class="tab"         data-view="status">Status Report</button>
    </div>

  </div>

  <div id="inputView" class="layout">
    <div class="card">
      <div class="card-inner">
        <h2 id="formTitle" style="margin-top:0; margin-bottom:4px;">New / Edit Job</h2>
        <div class="card-description" style="margin-bottom:10px;">To create or edit a calendar entry please fill out the fields below.</div>

        <div class="form-section-label">Project Information</div>
        <div class="row" id="rowInfo">
          <div>
            <input id="jobName" placeholder="Job Name / WF ID">
          </div>
          <div>
            <select id="lob">
              <option value="">LOB</option>
              <option value="MOB">MOB</option>
              <option value="FIB">FIB</option>
              <option value="BUS">BUS</option>
              <option value="FNT">FNT</option>
            </select>
          </div>
          <div>
            <select id="jobType">
              <option value="Adapt">Adapt</option>
              <option value="Adopt">Adopt</option>
              <option value="AssetOrigination">Asset Origination</option>
              <option value="AdHocRequest">Ad Hoc Request</option>
              <option value="ContentDeliveryOnly">Content Delivery Only</option>
              <option value="Vacation">Vacation / Time Off</option>
            </select>
          </div>
        </div>

        <div class="form-dates-header">
          <div class="form-section-label" style="margin:0;">Project Dates</div>
          <button type="button" id="slaFillBtn" class="btn-sla" title="Auto-fill empty dates from Start Date using SLA rules">&#8635; SLA</button>
        </div>
        <div class="date-btn-row">
          <div class="date-btn-wrap">
            <label for="startDate">Start Date</label>
            <input id="startDate" type="date">
          </div>
          <div class="date-btn-wrap">
            <label for="cdDate" id="cdDateLabel">CD Hand Off</label>
            <input id="cdDate" type="date">
          </div>
          <div class="date-btn-wrap" id="fieldLiveDate">
            <label for="liveDate">Media Hand Off</label>
            <input id="liveDate" type="date">
          </div>
          <div class="date-btn-wrap">
            <label for="goLiveDate">Live Date</label>
            <input id="goLiveDate" type="date">
          </div>
        </div>

        <div class="row" style="align-items:center;">
          <div>
            <select id="loe">
              <option value="0.75">LOE: Light (0.75&times;)</option>
              <option value="1" selected>LOE: Normal (1.0&times;)</option>
              <option value="1.5">LOE: Heavy (1.5&times;)</option>
              <option value="2">LOE: Extreme (2.0&times;)</option>
            </select>
          </div>
          <div>
            <select id="risk">
              <option value="">Risk</option>
              <option value="On Track">On Track</option>
              <option value="At Risk">At Risk</option>
              <option value="Off Track">Off Track</option>
            </select>
          </div>
          <div id="fieldPriority">
            <select id="priority">
              <option value="">Priority</option>
              <option value="1">1 &ndash; Highest</option>
              <option value="2">2 &ndash; High</option>
              <option value="3">3 &ndash; Low</option>
              <option value="4">4 &ndash; Lowest</option>
            </select>
          </div>
          <div class="form-divider-v"></div>
          <div style="flex:1;">
            <input id="mediaPartner" placeholder="Media Partner" style="width:100%;">
          </div>
          <div id="fieldMarketer" style="flex:1;">
            <input id="marketer" list="dlMarketer" placeholder="Marketer" style="width:100%;">
          </div>
        </div>

        <div class="row" id="vacationOnlyFields" style="display:none;">
          <div>
            <input id="vacationPerson" list="vacationPersonList" placeholder="Person" autocomplete="off">
            <datalist id="vacationPersonList"></datalist>
          </div>
          <div>
            <label for="vacationTrack">Function Group Affected</label>
            <select id="vacationTrack">
              <option value="all">All Groups</option>
              <option value="social+display">Social + Display (Dev)</option>
              <option value="social">Social</option>
              <option value="display">Display</option>
              <option value="statics">Statics</option>
              <option value="review">Creative Review</option>
              <option value="qa">Quality Assurance</option>
              <option value="cd">Content Delivery</option>
            </select>
          </div>
        </div>

        <div class="form-section-label" id="sectionResources">Resources</div>
        <datalist id="dlSocial"></datalist>
        <datalist id="dlDisplay"></datalist>
        <datalist id="dlStatics"></datalist>
        <datalist id="dlCreative"></datalist>
        <datalist id="dlProofing"></datalist>
        <datalist id="dlQA"></datalist>
        <datalist id="dlContent"></datalist>
        <datalist id="dlProducer"></datalist>
        <datalist id="dlCp"></datalist>
        <datalist id="dlMarketer"></datalist>
        <div class="row" id="jobOnlyAssignee1">
          <div id="fieldCp">
            <input id="cp" list="dlCp" placeholder="CP">
          </div>
          <div>
            <input id="producer" list="dlProducer" placeholder="Producer">
          </div>
          <div>
            <input id="assigneeAd" list="dlCreative" placeholder="Creative">
          </div>
          <div>
            <input id="assigneeSocial" list="dlSocial" placeholder="Social">
          </div>
          <div>
            <input id="assigneeDisplay" list="dlDisplay" placeholder="Display">
          </div>
          <div>
            <input id="assigneeStatic" list="dlStatics" placeholder="Static">
          </div>
        </div>
        <input type="hidden" id="assigneeReview">
        <div class="row" id="jobOnlyAssignee2">
          <div>
            <input id="assigneeQa" list="dlProofing" placeholder="Proofing">
          </div>
          <div>
            <input id="assigneeCd" list="dlQA" placeholder="QA">
          </div>
          <div>
            <input id="assigneeContent" list="dlContent" placeholder="Content">
          </div>
        </div>

        <div class="form-section-label" id="sectionAssets">Number of Assets</div>
        <div class="row" id="jobOnlyAssets">
          <div><input id="fxfAssets"     type="number" min="0" value="" placeholder="FxF"></div>
          <div><input id="socialAssets"  type="number" min="0" value="" placeholder="Social"></div>
          <div><input id="displayAssets" type="number" min="0" value="" placeholder="Display"></div>
          <div><input id="staticAssets"  type="number" min="0" value="" placeholder="Statics"></div>
          <div><input id="cdOnlyAssets"  type="number" min="0" value="" placeholder="CD Only"></div>
          <div><input id="cdPlacements"  type="number" min="0" value="" placeholder="CD Place"></div>
        </div>
        <input type="hidden" id="totalAssets" value="0">

        <div class="form-tasktime-header">
          <div class="form-section-label" id="sectionTaskTime" style="margin:0;">Task Time (in mins)</div>
          <div class="est-rounds-group">
            <label for="estRounds" class="est-rounds-label">Est. Rounds</label>
            <input id="estRounds" type="range" min="1" max="5" step="1" value="1" class="est-rounds-slider">
            <span id="estRoundsLabel" class="est-rounds-value">1 (&times;1.00)</span>
          </div>
        </div>
        <div class="row" id="jobOnlyMinutes">
          <div><div class="field-label">FxF</div>     <input id="fxfMinutes"          type="number" min="0" value="30"></div>
          <div><div class="field-label">Social</div>  <input id="devMinutesSocial"    type="number" min="0" value="30"></div>
          <div><div class="field-label">Display</div> <input id="devMinutesDisplay"   type="number" min="0" value="45"></div>
          <div><div class="field-label">Static</div>  <input id="devMinutesStatic"    type="number" min="0" value="15"></div>
          <div><div class="field-label">Proofing</div><input id="reviewMinutes"       type="number" min="0" value="10"></div>
          <div><div class="field-label">Creative</div><input id="qaMinutes"           type="number" min="0" value="10"></div>
          <div><div class="field-label">QA</div>      <input id="cdMinutes"           type="number" min="0" value="10"></div>
          <div><div class="field-label">CD</div>      <input id="cdDeliveryMinutes"   type="number" min="0" value="10"></div>
        </div>

        <span id="socialDevHours"  style="display:none;">0.0</span>
        <span id="displayDevHours" style="display:none;">0.0</span>
        <span id="staticDevHours"  style="display:none;">0.0</span>
        <span id="reviewHours"     style="display:none;">0.0</span>
        <span id="qaHours"         style="display:none;">0.0</span>
        <span id="cdHours"         style="display:none;">0.0</span>

        <div class="form-section-label">Project Notes</div>
        <div>
          <textarea id="jobNotes" placeholder="Add any notes or context for this job&hellip;" class="job-notes-textarea"></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="btn" id="saveJobBtn">Save Job to Schedule</button>
          <div class="form-actions-right">
            <button type="button" class="btn btn-secondary" id="clearFormBtn">Clear Form</button>
            <button type="button" class="btn btn-secondary btn-danger-outline" id="deleteJobBtn">Delete Job</button>
          </div>
        </div>
      </div>
    </div>

    <div class="summary-card" id="jobSummarySidebar">
      <h3>Project Summary</h3>
      <div class="summary-label" id="sumJobName">JOB ID / WF #</div>

      <div class="summary-kpi-row">
        <div class="summary-kpi-cell">
          <div class="summary-kpi-title">Total Assets</div>
          <div class="summary-kpi-value" id="sumTotalAssets">0</div>
        </div>
        <div class="summary-kpi-cell">
          <div class="summary-kpi-title">LOE</div>
          <div class="summary-kpi-value" id="sumLoe">&mdash;</div>
        </div>
        <div class="summary-kpi-cell">
          <div class="summary-kpi-title">Priority</div>
          <div class="summary-kpi-value" id="sumPriority">&mdash;</div>
        </div>
      </div>

      <hr class="summary-divider">
      <div class="summary-dates">
        <p><span class="lbl">Start Date:</span> <span id="sumStartDate">00/00/0000</span></p>
        <p><span class="lbl">CD Hand Off:</span> <span id="sumCdDate">00/00/0000</span></p>
        <p><span class="lbl">Media Hand Off:</span> <span id="sumLiveDate">00/00/0000</span></p>
        <p><span class="lbl">Live Date:</span> <span id="sumGoLiveDate">00/00/0000</span></p>
      </div>

      <hr class="summary-divider">
      <div class="summary-hours-title">Estimated Project Hours</div>
      <div class="summary-asset-grid" id="sumAssetGrid">
        <div class="summary-asset-cell"><span class="lbl">Social</span><span class="num" id="sumSocial">0</span></div>
        <div class="summary-asset-cell"><span class="lbl">Display</span><span class="num" id="sumDisplay">0</span></div>
        <div class="summary-asset-cell"><span class="lbl">Statics</span><span class="num" id="sumStatics">0</span></div>
        <div class="summary-asset-cell"><span class="lbl">Proofing</span><span class="num" id="sumProofing">0</span></div>
        <div class="summary-asset-cell"><span class="lbl">Creative</span><span class="num" id="sumCreative">0</span></div>
        <div class="summary-asset-cell"><span class="lbl">CD</span><span class="num" id="sumCD">0</span></div>
      </div>

      <div class="summary-kpi-row" style="margin-top:10px;">
        <div class="summary-kpi-cell" style="flex:1;">
          <div class="summary-kpi-title">Total Est. Hours</div>
          <div class="summary-kpi-value" id="sumTotalHours">0</div>
        </div>
      </div>
    </div>
  </div>

  <div id="calendarView" style="display:none; margin-top:20px;">
    <div class="card">
      <div class="card-inner">
        <div class="toolbar">
          <div class="cal-toolbar-top">
            <div>
              <h2 style="margin-bottom:4px;">Schedule View</h2>
              <div class="card-description" style="margin-bottom:0;">Six-week studio calendar, starting from today.</div>
            </div>
            <div class="cal-toolbar-actions">
              <span id="fsaStatusCal" class="nav-status-text">&#9675; Loading&hellip;</span>
              <span id="fsaUserDisplay" class="nav-status-text"></span>
              <button type="button" class="btn btn-secondary btn-sm" id="connectFileBtnCal" style="background:#22c55e; color:#fff; border-color:#22c55e;">Connected to Database</button>
              <button type="button" class="btn btn-secondary btn-sm" id="importExcelBtn">Import Excel</button>
              <button type="button" class="btn btn-secondary btn-sm" id="importUsersExcelBtn">Import Users</button>
              <button type="button" class="btn btn-secondary btn-sm" id="mergeJsonBtn" title="Add jobs from another export without overwriting existing jobs">Merge JSON</button>
              <button type="button" class="btn btn-secondary btn-sm" id="exportJsonBtn">Export JSON</button>
              <input type="file" id="importJsonFile"       accept="application/json"    style="display:none;">
              <input type="file" id="mergeJsonFile"        accept="application/json"    style="display:none;">
              <input type="file" id="importExcelFile"      accept=".xlsx,.xls"          style="display:none;">
              <input type="file" id="importUsersExcelFile" accept=".xlsx,.xls,.csv"     style="display:none;">
            </div>
          </div>
          <div class="cal-toolbar-filters">
            <div class="cal-filter-row">
              <span class="cal-filter-label">Filter</span>
              <input id="filterJobName" placeholder="Job Number / ID" style="min-width:260px; max-width:320px;">
              <select id="filterLob" style="min-width:120px; max-width:160px;">
                <option value="">LOB</option>
                <option value="MOB">MOB</option>
                <option value="BUS">BUS</option>
                <option value="FIB">FIB</option>
                <option value="FNT">FNT</option>
              </select>
              <select id="filterJobType" style="min-width:160px; max-width:220px;">
                <option value="">Job Type</option>
                <option value="Adapt">Adapt</option>
                <option value="Adopt">Adopt</option>
                <option value="AssetOrigination">Asset Origination</option>
                <option value="AdHocRequest">Ad Hoc Request</option>
                <option value="ContentDeliveryOnly">Content Delivery Only</option>
                <option value="Vacation">Vacation / Time Off</option>
              </select>
              <select id="filterPhase" style="min-width:180px; max-width:240px;">
                <option value="">All Phases</option>
                <option value="active">Active Only</option>
                <option value="Discovery">Discovery</option>
                <option value="Pre-Production">Pre-Production</option>
                <option value="In Production">In Production</option>
                <option value="Post-Production">Post-Production</option>
                <option value="Project Closeout">Project Closeout</option>
                <option value="Completed">Completed</option>
                <option value="Canceled">Canceled</option>
              </select>
              <input id="filterResource" placeholder="Resource" list="dlAllResources" autocomplete="off" style="min-width:160px; max-width:220px;">
              <datalist id="dlAllResources"></datalist>
            </div>
            <div class="cal-nav-row">
              <button type="button" class="btn btn-secondary" id="prevWeekBtn">&larr; Prev</button>
              <button type="button" class="btn btn-secondary" id="todayBtn">Jump to Today</button>
              <button type="button" class="btn btn-secondary" id="nextWeekBtn">Next &rarr;</button>
            </div>
          </div>
        </div>

        <div id="updateBanner" class="update-banner-cal" style="display:none;">
          <span id="updateBannerMsg" class="update-banner-msg"></span>
          <div class="update-banner-btns">
            <button type="button" id="updateBannerReloadBtn"  class="update-banner-reload">Reload</button>
            <button type="button" id="updateBannerDismissBtn" class="update-banner-dismiss">Dismiss</button>
          </div>
        </div>
        <div class="window-label" id="windowLabel">Showing 6 weeks from today.</div>

        <div id="statusBoard" style="margin-bottom:12px;"></div>

        <div class="schedule-grid" id="scheduleGrid"></div>

        <div id="unscheduledPanel" style="display:none; margin-top:20px; margin-bottom:16px; font-size:0.75rem; border-radius:6px; border:1px solid #e5e7eb; background:#fff; overflow:hidden;"></div>
        <div id="capacitySummary"  class="capacity-summary"></div>
        <div id="assigneeSummary"  class="assignee-summary"></div>
        <div id="timeOffSummary"   class="capacity-summary" style="display:none;"></div>
      </div>
    </div>
  </div>

  <!-- ── STATUS REPORT VIEW ─────────────────────────────────────────── -->
  <div id="statusReportView" style="display:none; margin-top:20px;">

    <div class="card" id="teamPanelCard" style="margin-bottom:14px;">
      <div class="card-inner">
        <div class="team-panel-toggle" id="teamPanelToggle">
          <h2 style="margin:0; font-size:1rem;">Team &amp; Resources</h2>
          <span id="teamPanelChevron" class="team-panel-chevron">&#9654; Show</span>
        </div>
        <div id="teamPanelBody" style="display:none; margin-top:12px;">
          <div class="team-panel-hint">Add team members, set their access role, and check which scheduling dropdowns they appear in.</div>
          <table id="teamTable" class="team-table">
            <thead>
              <tr class="team-table-head">
                <th class="team-th" style="width:20%;">Name</th>
                <th class="team-th" style="width:14%;">Access Role</th>
                <th class="team-th">Functions (dropdowns)</th>
                <th class="team-th">LOBs (CP/Producer access)</th>
                <th style="width:32px;"></th>
              </tr>
            </thead>
            <tbody id="teamTableBody"></tbody>
          </table>
          <button type="button" id="teamAddRowBtn" class="btn-add-person">+ Add Person</button>
        </div>
      </div>
    </div>

    <div class="card-inner">
      <div class="toolbar">
        <div class="sr-toolbar-top">
          <div>
            <h2 style="margin-bottom:2px;">Project Status Report</h2>
            <div class="card-description" style="margin-bottom:0;">Living list &mdash; click &#9654; to expand a job and edit details.</div>
          </div>
          <div class="sr-toolbar-actions">
            <button type="button" id="srAddJobBtn"     class="btn-sr-add">+ New Job</button>
            <button type="button" id="srImportJsonBtn" class="btn-sr-secondary">&#11014; Import JSON</button>
            <button type="button" id="srMergeJsonBtn"  class="btn-sr-secondary">&#8853; Merge JSON</button>
            <button type="button" id="srExportJsonBtn" class="btn-sr-secondary">&#11015; Export JSON</button>
            <button type="button" id="srExportXlsxBtn" class="btn-sr-export">&#11015; Export XLSX</button>
            <input type="file" id="srImportJsonFile" accept="application/json" style="display:none;">
            <input type="file" id="srMergeJsonFile"  accept="application/json" style="display:none;">
          </div>
        </div>

        <div class="sr-filter-bar">
          <div class="sr-filter-row">
            <span class="sr-filter-label">Filter</span>
            <input id="srFilterName" placeholder="Search by Job Name / WF ID&hellip;" style="min-width:260px; max-width:380px;">
            <select id="srFilterLob">
              <option value="">LOB</option>
              <option value="BUS">BUS</option>
              <option value="FIB">FIB</option>
              <option value="MOB">MOB</option>
              <option value="FNT">FNT</option>
            </select>
            <select id="srFilterType">
              <option value="">All Project Types</option>
              <option>Creative Origination</option>
              <option>Creative Adaptation/Adoption</option>
              <option>Trafficking Only</option>
            </select>
            <select id="srFilterPhase">
              <option value="">All Phases</option>
              <option value="active">Active Only</option>
              <option value="Discovery">Discovery</option>
              <option value="Pre-Production">Pre-Production</option>
              <option value="In Production">In Production</option>
              <option value="Post-Production">Post-Production</option>
              <option value="Project Closeout">Project Closeout</option>
              <option value="Completed">Completed</option>
              <option value="Canceled">Canceled</option>
            </select>
          </div>
        </div>
      </div>

      <div id="srTable" style="margin-top:12px; overflow-x:auto;"></div>
    </div>
  </div>

  <!-- ── Job Detail Modal ─────────────────────────────────────────────────── -->
  <div id="jobModal" class="modal-backdrop">
    <div class="modal-card" role="dialog" aria-modal="true" style="max-width:620px;">
      <div class="modal-header">
        <div class="modal-title" id="jobModalTitle">Job Details</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="jobModalEditBtn">Edit Job</button>
          <button type="button" class="modal-close" id="jobModalCloseBtn">&times;</button>
        </div>
      </div>

      <div class="modal-badge-row">
        <span id="jobModalLobBadge"      class="modal-lob-badge"></span>
        <span id="jobModalPriorityBadge" class="modal-priority-badge"></span>
        <span id="jobModalTypeBadge"     class="modal-type-badge"></span>
        <span id="jobModalLoeBadge"      class="modal-loe-badge"></span>
      </div>

      <div class="modal-three-col modal-section-border">
        <div><div class="label">Marketer</div> <div class="value" id="jobModalMarketer">—</div></div>
        <div><div class="label">CP</div>       <div class="value" id="jobModalCp">—</div></div>
        <div><div class="label">Producer</div> <div class="value" id="jobModalProducer">—</div></div>
      </div>

      <div class="modal-section-title">Project Dates</div>
      <div class="modal-four-col modal-section-border">
        <div><div class="label">Start</div>         <div class="value" id="jobModalStart">—</div></div>
        <div><div class="label">CD Hand Off</div>   <div class="value" id="jobModalCd">—</div></div>
        <div><div class="label">Media Hand Off</div><div class="value" id="jobModalLive">—</div></div>
        <div><div class="label">Go Live</div>       <div class="value" id="jobModalGoLive">—</div></div>
      </div>

      <div class="modal-section-title">Resources</div>
      <div class="modal-four-col modal-section-border">
        <div><div class="label">Social</div>          <div class="value" id="jobModalAssigneeSocial">—</div></div>
        <div><div class="label">Display</div>         <div class="value" id="jobModalAssigneeDisplay">—</div></div>
        <div><div class="label">Statics</div>         <div class="value" id="jobModalAssigneeStatic">—</div></div>
        <div><div class="label">Creative Review</div> <div class="value" id="jobModalAssigneeReview">—</div></div>
        <div><div class="label">QA / Proofing</div>   <div class="value" id="jobModalAssigneeQa">—</div></div>
        <div><div class="label">CD</div>              <div class="value" id="jobModalAssigneeCd">—</div></div>
        <div><div class="label">Content</div>         <div class="value" id="jobModalAssigneeContent">—</div></div>
      </div>

      <div class="modal-section-title">Asset Counts</div>
      <div class="modal-five-col modal-section-border">
        <div><div class="label">Social</div>  <div class="value" id="jobModalAssetSocial">—</div></div>
        <div><div class="label">Display</div> <div class="value" id="jobModalAssetDisplay">—</div></div>
        <div><div class="label">Statics</div> <div class="value" id="jobModalAssetStatic">—</div></div>
        <div><div class="label">CD Only</div> <div class="value" id="jobModalAssetCdOnly">—</div></div>
        <div><div class="label">Total</div>   <div class="value modal-total-assets" id="jobModalTotalAssets">—</div></div>
      </div>

      <div class="modal-section-title">Estimated Hours</div>
      <div class="modal-three-col modal-section-border">
        <div><div class="label">Social Dev</div>     <div class="value" id="jobModalSocialDevH">—</div></div>
        <div><div class="label">Display Dev</div>    <div class="value" id="jobModalDisplayDevH">—</div></div>
        <div><div class="label">Static Dev</div>     <div class="value" id="jobModalStaticDevH">—</div></div>
        <div><div class="label">Creative Review</div><div class="value" id="jobModalReviewH">—</div></div>
        <div><div class="label">QA</div>             <div class="value" id="jobModalQAH">—</div></div>
        <div><div class="label">CD</div>             <div class="value" id="jobModalCDH">—</div></div>
      </div>

      <div class="modal-cd-placements">
        CD Basis: <span id="jobModalCDPlacements" class="modal-cd-placements-value">&mdash;</span>
      </div>

      <div id="jobModalCreatedRow" class="modal-created-row" style="display:none;">
        Added <span id="jobModalCreatedAt"></span> by <span id="jobModalCreatedBy" class="modal-created-by"></span>
      </div>
      <div id="jobModalNotesRow" class="modal-notes-row" style="display:none;">
        <div class="label" style="margin-bottom:4px;">Notes</div>
        <div id="jobModalNotes" class="modal-notes-body"></div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary btn-danger-outline btn-sm" id="jobModalDeleteBtn">Delete Job</button>
      </div>

      <div id="jobModalCommentsSection" class="modal-comments-section" style="display:none;">
        <div class="modal-section-title">Comments</div>
        <div id="jobModalCommentsList" class="modal-comments-list"></div>
        <div class="modal-comment-input-row">
          <textarea id="jobModalCommentInput" placeholder="Add a comment&hellip;" rows="2" class="modal-comment-textarea"></textarea>
          <button type="button" id="jobModalCommentSubmit" class="btn-comment-submit">Post</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Resource Drill-down Modal ── -->
  <div id="statusDrillModal" class="modal-backdrop">
    <div class="modal-card" role="dialog" aria-modal="true" style="max-width:560px;">
      <div class="modal-header">
        <div class="modal-title" id="statusDrillTitle">Jobs</div>
        <button type="button" class="modal-close" id="statusDrillCloseBtn">&times;</button>
      </div>
      <div id="statusDrillBody" style="font-size:0.82rem;"></div>
    </div>
  </div>

  <!-- ── Assignee Breakdown Modal ── -->
  <div id="assigneeBreakdownModal" class="modal-backdrop">
    <div class="modal-card" role="dialog" aria-modal="true" style="max-width:600px;">
      <div class="modal-header">
        <div class="modal-title" id="assigneeBreakdownTitle">Assignee Breakdown</div>
        <button type="button" class="modal-close" id="assigneeBreakdownCloseBtn">&times;</button>
      </div>
      <div class="modal-subtitle" id="assigneeBreakdownSubtitle"></div>
      <div id="assigneeBreakdownBody"></div>
    </div>
  </div>

  <!-- ── Excel Column Mapping Modal ── -->
  <div id="excelMapModal" class="modal-backdrop">
    <div class="modal-card modal-card-tall" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">Import from Excel &mdash; Map Columns</div>
        <button type="button" class="modal-close" id="excelMapCloseX">&times;</button>
      </div>
      <div class="excel-map-header">
        <p class="excel-map-hint">Assign each column to a scheduler field. LOB is set automatically from the sheet name.</p>
        <div class="excel-sheet-selector-wrap">
          <label class="excel-sheet-label">Import sheet:</label>
          <select id="excelSheetSelector" class="excel-sheet-select"></select>
        </div>
      </div>
      <div class="excel-map-table-wrap">
        <table class="excel-map-table">
          <thead>
            <tr class="excel-map-thead">
              <th class="excel-map-th" style="width:36%;">Excel Column</th>
              <th class="excel-map-th" style="width:24%;">Sample Value</th>
              <th class="excel-map-th" style="width:40%;">Maps To</th>
            </tr>
          </thead>
          <tbody id="excelMapTableBody"></tbody>
        </table>
      </div>
      <div class="excel-map-footer">
        <div class="excel-import-mode">
          <span class="excel-import-mode-label">Import Mode:</span>
          <label class="excel-import-mode-option"><input type="radio" name="excelImportMode" value="append"> Append to existing jobs</label>
          <label class="excel-import-mode-option"><input type="radio" name="excelImportMode" value="replace" checked> Replace all jobs</label>
          <label id="smartMergeOption" class="excel-import-mode-option"><input type="radio" name="excelImportMode" value="smartmerge"> Smart Merge</label>
        </div>
        <div class="excel-map-footer-btns">
          <button type="button" class="btn btn-secondary" id="excelMapResetBtn">Reset Mapping</button>
          <button type="button" class="btn btn-secondary" id="excelMapCancelBtn">Cancel</button>
          <button type="button" class="btn" id="excelMapImportBtn">Import Jobs</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── New Job Modal ── -->
  <div id="jobFormModal" class="job-form-modal-backdrop" style="display:none;">
    <div class="job-form-modal-card">
      <div class="job-form-modal-header">
        <span class="job-form-modal-title">New Job</span>
        <button id="jobFormModalClose" class="job-form-modal-close">&times;</button>
      </div>
      <div id="jobFormModalBody" class="job-form-modal-body"></div>
      <div class="job-form-modal-footer">
        <button id="jobFormModalCancel" class="btn btn-secondary">Cancel</button>
        <button id="jobFormModalSave"   class="btn btn-primary-dark">Save Job</button>
      </div>
    </div>
  </div>

</div><!-- /#ss-root -->
