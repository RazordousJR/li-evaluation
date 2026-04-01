// ===== SUPABASE CONFIG =====
var SUPABASE_URL = 'https://lvbtzoqkgmjztolwdchi.supabase.co';
var SUPABASE_KEY = 'sb_publishable_ChFCyvoYGVutAaFdwKZbtA_bq0P3DAR';
var sb = null;

// ===== DASHBOARD GLOBALS =====
var currentStudent = null;
var _pendingStudentEval = null;
var _ajkliStudents = [];
var _ajkliPensyarahMap = {};
var _senaraiStudents = [];
var _senaraiFiltered = [];
var _senaraiPage = 1;
var _senaraiPageSize = 20;
var _senaraiPensyarahMap = {};
var _currentEvalEmail = null; // evaluator email used for save/load marks
var _studentApprovalStatus = { status: 'draft', submitted_at: null, approved_at: null, approved_by: null };
var _chartCompletion = null, _chartApproval = null, _chartProgram = null, _chartSvf = null;

// ===== PASSWORD HASHING =====
async function hashPassword(pw) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}
// ===== END PASSWORD HASHING =====

// ===== SESSION TIMEOUT =====
var _idleTimer = null;
var _idleListenerAttached = false;
var IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minit

function resetIdleTimer() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(function() {
    var toast = document.getElementById('idle-toast');
    if (toast) { toast.style.display = 'flex'; }
    setTimeout(function() { doLogout(); }, 3000);
  }, IDLE_TIMEOUT_MS);
}

function startIdleWatch() {
  if (!document.getElementById('idle-toast')) {
    var toast = document.createElement('div');
    toast.id = 'idle-toast';
    toast.style.cssText = 'display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e3a8a;color:#fff;padding:14px 28px;border-radius:10px;font-size:15px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.35);align-items:center;gap:10px;';
    toast.innerHTML = '<span>&#x23F1;</span> <span>Sesi tamat kerana tidak aktif. Log masuk semula...</span>';
    document.body.appendChild(toast);
  }
  if (!_idleListenerAttached) {
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(function(evt) {
      document.addEventListener(evt, resetIdleTimer, { passive: true });
    });
    _idleListenerAttached = true;
  }
  resetIdleTimer();
}

function stopIdleWatch() {
  clearTimeout(_idleTimer);
  if (_idleListenerAttached) {
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(function(evt) {
      document.removeEventListener(evt, resetIdleTimer);
    });
    _idleListenerAttached = false;
  }
}
// ===== END SESSION TIMEOUT =====

// ===== SUPABASE SESSION =====
// Security is enforced at the application layer (JS query filtering).
// RLS was attempted (v4.14) but reverted — see CLAUDE.md §Security (v4.15).
// ===== END SUPABASE SESSION =====

// ===== AUTH =====
function getEffectiveRole(roles) {
  if (!roles || roles.length === 0) return 'PENSYARAH';
  if (roles.indexOf('ADMIN') !== -1) return 'ADMIN';
  if (roles.indexOf('AJK_LI') !== -1) return 'AJK_LI';
  return 'PENSYARAH';
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('li_session')); } catch(e) { return null; }
}

async function initAuth() {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var session = getSession();
  if (session && session.email && session.roles) {
    showApp(session);
  }
}

async function doLogin() {
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  var pass  = document.getElementById('login-password').value;
  var errEl = document.getElementById('login-error');
  var btn   = document.querySelector('.login-submit-btn');

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Mengesahkan...';

  try {
    var passHash = await hashPassword(pass);
    // Use SECURITY DEFINER RPC to bypass RLS for the pre-session login lookup
    var resp = await sb.rpc('get_user_for_login', { p_email: email });

    if (resp.error) {
      console.error('[doLogin] RPC error:', resp.error);
      errEl.textContent = 'Ralat sambungan. Cuba semula.';
      errEl.style.display = 'block';
      return;
    }

    var user = resp.data?.[0];
    if (!user || user.is_active === false || user.password_hash !== passHash) {
      errEl.textContent = 'E-mel atau kata laluan tidak sah.';
      errEl.style.display = 'block';
      return;
    }

    var sess = { email: user.email, roles: user.roles, displayName: user.full_name };
    localStorage.setItem('li_session', JSON.stringify(sess));
    showApp(sess);
  } catch(e) {
    errEl.textContent = 'Ralat sambungan. Cuba semula.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log Masuk';
  }
}

function doLogout() {
  stopIdleWatch();
  localStorage.removeItem('li_session');
  location.reload();
}

function showApp(user) {
  var loginEl = document.getElementById('login-overlay');
  if (loginEl) loginEl.style.display = 'none';
  var appEl = document.getElementById('main-app');
  if (appEl) appEl.style.display = 'block';

  var effectiveRole = getEffectiveRole(user.roles);
  var roleLabels = { ADMIN: 'Admin', AJK_LI: 'AJK LI', PENSYARAH: 'Pensyarah' };

  var nameEl = document.getElementById('sidebar-user-name');
  if (nameEl) nameEl.textContent = user.displayName || user.email;
  var sidebarBadge = document.getElementById('sidebar-role-badge');
  if (sidebarBadge) {
    sidebarBadge.className = 'role-badge role-' + effectiveRole;
    sidebarBadge.textContent = roleLabels[effectiveRole] || effectiveRole;
  }

  applyRoleRestrictions(user.roles);
  startIdleWatch();
  showTab('dashboard');
}

function applyRoleRestrictions(roles) {
  var eff = getEffectiveRole(roles);
  // Always reset management sidebar items to hidden first
  ['admin-sep', 'admin-label', 'admin-nav-item', 'uruspelajar-nav-item', 'uruspensyarah-nav-item', 'senarai-nav-item', 'laporan-nav-item', 'statuspensyarah-nav-item'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (eff === 'ADMIN') {
    ['admin-sep', 'admin-label', 'admin-nav-item', 'uruspelajar-nav-item', 'uruspensyarah-nav-item', 'senarai-nav-item', 'laporan-nav-item', 'statuspensyarah-nav-item'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
    return;
  }
  if (eff === 'AJK_LI') {
    ['admin-sep', 'admin-label', 'uruspelajar-nav-item', 'uruspensyarah-nav-item', 'senarai-nav-item', 'laporan-nav-item', 'statuspensyarah-nav-item'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
    return;
  }
  if (eff === 'PENSYARAH') {
    document.querySelectorAll('.btn-danger').forEach(function(btn) {
      btn.classList.add('hidden-by-role');
    });
    // Hide Maklumat Pelajar nav for PENSYARAH (they access via dashboard)
    var infoNav = document.getElementById('info-nav-item');
    if (infoNav) infoNav.style.display = 'none';
  }
}
// ===== END AUTH =====

// ===== SIDEBAR TOGGLE =====
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}
function showEvalSidebar(student) {
  var defNav = document.getElementById('sidebar-nav-default');
  var evalNav = document.getElementById('sidebar-nav-eval');
  if (defNav) defNav.style.display = 'none';
  if (evalNav) evalNav.style.display = 'block';
  var label = document.getElementById('sidebar-student-label');
  if (label && student) {
    label.innerHTML = escHtml(student.name || '—') + '<br><span style="opacity:.7;font-size:10.5px">' + escHtml(student.matric_no || '') + '</span>';
  }
}
function showDefaultSidebar() {
  var defNav = document.getElementById('sidebar-nav-default');
  var evalNav = document.getElementById('sidebar-nav-eval');
  if (evalNav) evalNav.style.display = 'none';
  if (defNav) defNav.style.display = 'block';
}
// ===== END SIDEBAR TOGGLE =====

var pilihan = 1, hadir = 1;

var TAB_TITLES = {
  dashboard: 'Dashboard',
  info: 'Maklumat Pelajar',
  svi: 'Penyelia Industri (SVI)',
  svf: 'Penyelia Fakulti (SVF)',
  logbook: 'e-Logbook',
  presentation: 'Pembentangan',
  report: 'Laporan LI',
  summary: 'Ringkasan & Gred',
  usermgmt: 'Pengurusan Pengguna',
  uruspelajar: 'Urus Pelajar',
  uruspensyarah: 'Urus Pensyarah',
  senarai: 'Senarai Pelajar',
  laporan: 'Laporan',
  statuspensyarah: 'Status Pensyarah'
};

function showTab(t) {
  document.querySelectorAll('.nav-item[data-tab]').forEach(function(el) {
    el.classList.toggle('active', el.getAttribute('data-tab') === t);
  });
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  var pageEl = document.getElementById('page-' + t);
  if (pageEl) pageEl.classList.add('active');
  document.getElementById('topbar-title').textContent = TAB_TITLES[t] || t;
  if (t === 'summary') calcSummary();
  if (t === 'usermgmt') loadUserMgmt();
  if (t === 'uruspelajar') loadUruspelajar();
  if (t === 'uruspensyarah') loadUruspensyarah();
  if (t === 'dashboard') loadDashboard();
  if (t === 'senarai') loadSenarai();
  if (t === 'laporan') loadLaporan();
  if (t === 'statuspensyarah') loadStatusPensyarah();

  // Show eval student bar and SVI/Org indicator only in eval tabs when a student is selected
  var evalTabs = ['info', 'svi', 'svf', 'logbook', 'presentation', 'report', 'summary'];
  var inEval = currentStudent && evalTabs.indexOf(t) !== -1;
  var evalBar = document.getElementById('eval-student-bar');
  if (evalBar) evalBar.style.display = inEval ? 'flex' : 'none';
  var sviOrgEl = document.getElementById('svi-org-indicator');
  if (sviOrgEl && !inEval) sviOrgEl.style.display = 'none';
  if (sviOrgEl && inEval && currentStudent && currentStudent.svi_name && currentStudent.organisasi) sviOrgEl.style.display = 'flex';

  closeSidebar();
  window.scrollTo(0, 0);
}

function clamp(el, max) { var vv = parseInt(el.value); if (isNaN(vv) || vv < 0) el.value = 0; else if (vv > max) el.value = max; }
function selectPilihan(n) { pilihan = n; document.getElementById("opt-p1").classList.toggle("selected", n === 1); document.getElementById("opt-p2").classList.toggle("selected", n === 2); var rp1 = document.getElementById("opt-p1-rep"); if (rp1) rp1.classList.toggle("selected", n === 1); var rp2 = document.getElementById("opt-p2-rep"); if (rp2) rp2.classList.toggle("selected", n === 2); document.getElementById("rep_p1_wrap").style.display = n === 1 ? "" : "none"; document.getElementById("rep_p2_wrap").style.display = n === 2 ? "" : "none"; document.getElementById("pilihan-note").innerHTML = "Menggunakan <strong>Pilihan " + n + "</strong> &mdash; " + (n === 1 ? "Tugasan Teknikal 80% (max 40m) + Pentadbiran 20% (max 10m)" : "Tugasan Teknikal 60% (max 30m) + Pentadbiran 40% (max 20m)"); calcReport(); scheduleSave(); }
function selectHadir(n) { hadir = n; scheduleSave(); }
function selectR(id, val, el) { document.getElementById(id).value = val; el.closest(".radio-group").querySelectorAll(".radio-opt").forEach(function(r) { r.classList.remove("selected"); }); el.classList.add("selected"); scheduleSave(); }
function v(id) { var el = document.getElementById(id); return el ? Math.max(0, parseInt(el.value) || 0) : 0; }
function setBar(id, val, max) { var el = document.getElementById(id); if (el) el.style.width = Math.min(100, Math.round(val / max * 100)) + "%"; }
function fmt(n) { return parseFloat((Math.round((n + 1e-9) * 100) / 100).toFixed(2)); }
function calcSVI() { var a = v("svi_a1") + v("svi_a2") + v("svi_a3") + v("svi_a4"); var b = v("svi_b1") + v("svi_b2") + v("svi_b3") + v("svi_b4") + v("svi_b5") + v("svi_b6") + v("svi_b7") + v("svi_b8") + v("svi_b9") + v("svi_b10"); document.getElementById("svi_a_total").textContent = a + " / 50"; document.getElementById("svi_b_total").textContent = b + " / 50"; document.getElementById("svi_total").textContent = (a + b) + " / 100"; setBar("svi_a_bar", a, 50); setBar("svi_b_bar", b, 50); scheduleSave(); }
function calcSVF() {
  var a1 = v("svf_a1_admin") + v("svf_a1_tech");
  var a2 = v("svf_a2_admin") + v("svf_a2_tech");
  var a3 = v("svf_a3");
  var a = a1 + a2 + a3;
  var b = v("svf_b1"), c = v("svf_c1");
  var elA1sub = document.getElementById("svf_a1_subtotal"); if (elA1sub) elA1sub.textContent = a1 + " / 30";
  var elA2sub = document.getElementById("svf_a2_subtotal"); if (elA2sub) elA2sub.textContent = a2 + " / 30";
  var elAtot = document.getElementById("svf_a_total"); if (elAtot) elAtot.textContent = a + " / 90";
  var elABtot = document.getElementById("svf_ab_total"); if (elABtot) elABtot.textContent = (a + b) + " / 100";
  var elTot = document.getElementById("svf_total"); if (elTot) elTot.textContent = (a + b + c) + " / 110";
  setBar("svf_a_bar", a, 90);
  scheduleSave();
}
function calcLog() { var a = v("log_a1"), b = v("log_b1"), c = v("log_c1"); document.getElementById("log_a_total").textContent = a + " / 40"; document.getElementById("log_b_total").textContent = b + " / 20"; document.getElementById("log_total").textContent = (a + b + c) + " / 70"; setBar("log_a_bar", a, 40); setBar("log_b_bar", b, 20); scheduleSave(); }
function calcPres() { var svf = v("psvf_a") + v("psvf_b1") + v("psvf_b2") + v("psvf_b3") + v("psvf_b4") + v("psvf_b5") + v("psvf_c1") + v("psvf_c2") + v("psvf_c3") + v("psvf_d1") + v("psvf_d2") + v("psvf_d3") + v("psvf_d4"); var svi = v("psvi_a") + v("psvi_b1") + v("psvi_b2") + v("psvi_b3") + v("psvi_b4") + v("psvi_b5") + v("psvi_c1") + v("psvi_c2") + v("psvi_c3") + v("psvi_d1") + v("psvi_d2") + v("psvi_d3") + v("psvi_d4"); document.getElementById("psvf_total").textContent = svf + " / 100"; document.getElementById("psvi_total").textContent = svi + " / 100"; setBar("psvf_bar", svf, 100); setBar("psvi_bar", svi, 100); scheduleSave(); }
function calcReport() { var a4 = pilihan === 1 ? (v("rep_a4_tech_p1") + v("rep_a4_admin_p1")) : (v("rep_a4_tech_p2") + v("rep_a4_admin_p2")); var a = v("rep_a1") + v("rep_a2") + v("rep_a3") + a4 + v("rep_a5") + v("rep_a6") + v("rep_a7"); var b = v("rep_b1") + v("rep_b2") + v("rep_b3") + v("rep_b4"); document.getElementById("rep_a_total").textContent = a + " / 80"; document.getElementById("rep_b_total").textContent = b + " / 40"; document.getElementById("rep_total").textContent = (a + b) + " / 100"; setBar("rep_a_bar", a, 80); scheduleSave(); }
function getGrade(m) { if (m >= 80) return { g: "A", cls: "grade-A" }; if (m >= 75) return { g: "A-", cls: "grade-A" }; if (m >= 70) return { g: "B+", cls: "grade-B" }; if (m >= 65) return { g: "B", cls: "grade-B" }; if (m >= 60) return { g: "B-", cls: "grade-B" }; if (m >= 55) return { g: "C+", cls: "grade-C" }; if (m >= 50) return { g: "C", cls: "grade-C" }; if (m >= 47) return { g: "C-", cls: "grade-C" }; if (m >= 44) return { g: "D+", cls: "grade-D" }; if (m >= 40) return { g: "D", cls: "grade-D" }; return { g: "E", cls: "grade-E" }; }
function calcSummary() { document.getElementById("s_nama").textContent = document.getElementById("nama_pelajar").value || "\u2014"; document.getElementById("s_matrik").textContent = document.getElementById("no_matrik").value || "\u2014"; document.getElementById("s_kursus").textContent = document.getElementById("kursus").value || "\u2014"; document.getElementById("s_sesi").textContent = document.getElementById("sesi").value + " Sem " + document.getElementById("semester").value; document.getElementById("s_svf").textContent = document.getElementById("svf_name").value || "\u2014"; document.getElementById("s_svi").textContent = document.getElementById("svi_name").value || "\u2014"; document.getElementById("s_org").textContent = document.getElementById("organisasi").value || "\u2014"; document.getElementById("s_svi_rating").textContent = document.getElementById("svi_rating").value || "\u2014"; document.getElementById("s_svf_rating").textContent = document.getElementById("svf_rating").value || "\u2014"; document.getElementById("s_svf_status").textContent = document.getElementById("svf_status").value || "\u2014"; var sviA = v("svi_a1") + v("svi_a2") + v("svi_a3") + v("svi_a4"); var sviB = v("svi_b1") + v("svi_b2") + v("svi_b3") + v("svi_b4") + v("svi_b5") + v("svi_b6") + v("svi_b7") + v("svi_b8") + v("svi_b9") + v("svi_b10"); var svfA = v("svf_a1_admin") + v("svf_a1_tech") + v("svf_a2_admin") + v("svf_a2_tech") + v("svf_a3"); var logT = v("log_a1") + v("log_b1") + v("log_c1"); var psvfT = v("psvf_a") + v("psvf_b1") + v("psvf_b2") + v("psvf_b3") + v("psvf_b4") + v("psvf_b5") + v("psvf_c1") + v("psvf_c2") + v("psvf_c3") + v("psvf_d1") + v("psvf_d2") + v("psvf_d3") + v("psvf_d4"); var psviT = v("psvi_a") + v("psvi_b1") + v("psvi_b2") + v("psvi_b3") + v("psvi_b4") + v("psvi_b5") + v("psvi_c1") + v("psvi_c2") + v("psvi_c3") + v("psvi_d1") + v("psvi_d2") + v("psvi_d3") + v("psvi_d4"); var a4rep = pilihan === 1 ? (v("rep_a4_tech_p1") + v("rep_a4_admin_p1")) : (v("rep_a4_tech_p2") + v("rep_a4_admin_p2")); var repA = v("rep_a1") + v("rep_a2") + v("rep_a3") + a4rep + v("rep_a5") + v("rep_a6") + v("rep_a7"); var repB = v("rep_b1") + v("rep_b2") + v("rep_b3") + v("rep_b4"); var repT = repA + repB; document.getElementById("sum_svi_a").textContent = sviA; document.getElementById("sum_svi_b").textContent = sviB; document.getElementById("sum_svf_a").textContent = svfA; document.getElementById("sum_log").textContent = logT; document.getElementById("sum_rep").textContent = repT; document.getElementById("sum_psvf").textContent = psvfT; document.getElementById("sum_psvi").textContent = psviT; document.getElementById("sum_soft").textContent = sviB; var sviA1 = v("svi_a1") + v("svi_a2"); var sviA23 = v("svi_a3") + v("svi_a4"); var svfA1 = v("svf_a1_admin") + v("svf_a1_tech"); var svfA23 = v("svf_a2_admin") + v("svf_a2_tech") + v("svf_a3"); var prj1 = fmt(sviA1 / 30 * 15); var prj2 = fmt(sviA23 / 20 * 15); var prj3 = fmt(svfA1 / 30 * 15); var prj4 = fmt(svfA23 / 60 * 15); var lr1 = fmt(logT / 70 * 20); var pr11_svfb = v("svf_b1"); var pr11_svib = fmt(sviB / 5); var pr11 = fmt(pr11_svfb + pr11_svib); var b3926 = fmt(prj1 + prj2 + prj3 + prj4 + lr1 + pr11); document.getElementById("r_prj1r").textContent = sviA1; document.getElementById("r_prj1").textContent = prj1; document.getElementById("r_prj2r").textContent = sviA23; document.getElementById("r_prj2").textContent = prj2; document.getElementById("r_prj3r").textContent = svfA1; document.getElementById("r_prj3").textContent = prj3; document.getElementById("r_prj4r").textContent = svfA23; document.getElementById("r_prj4").textContent = prj4; document.getElementById("r_lr1r").textContent = logT; document.getElementById("r_lr1").textContent = lr1; document.getElementById("r_pr11_svfb_raw").textContent = pr11_svfb; document.getElementById("r_pr11_svfb").textContent = pr11_svfb + " / 10"; document.getElementById("r_pr11_svib_raw").textContent = sviB; document.getElementById("r_pr11_svib").textContent = pr11_svib + " / 10"; document.getElementById("r_pr11").textContent = pr11 + " / 20"; document.getElementById("sum_3926_total").textContent = b3926; var g1 = getGrade(b3926); var gb1 = document.getElementById("sum_3926_grade"); gb1.textContent = g1.g; gb1.className = "grade-pill " + g1.cls; var tr1_lapa = fmt(repA / 2); var tr1_lapb = fmt(repB / 40 * 10); var tr1_svfc = v("svf_c1"); var tr1_logc = v("log_c1"); var tr1 = fmt(tr1_lapa + tr1_lapb + tr1_svfc + tr1_logc); var pr11_pbt = fmt((psvfT + psviT) / 200 * 20); var pr12_p1 = parseFloat(document.getElementById('r_prj1') ? (document.getElementById('r_prj1').textContent || '0') : '0') || 0; var pr12_p2 = parseFloat(document.getElementById('r_prj2') ? (document.getElementById('r_prj2').textContent || '0') : '0') || 0; var pr12_svib = parseFloat(document.getElementById('r_pr11_svib') ? (document.getElementById('r_pr11_svib').textContent || '0') : '0') || 0; var pr12sum = parseFloat((pr12_p1 + pr12_p2 + pr12_svib).toFixed(2)); var pr12 = fmt(pr12sum / 40 * 10); var b3946 = fmt(tr1 + pr11_pbt + pr12); document.getElementById("r2_tr1_lapa_raw").textContent = repA; document.getElementById("r2_tr1_lapa").textContent = tr1_lapa + " / 40"; document.getElementById("r2_tr1_lapb_raw").textContent = repB; document.getElementById("r2_tr1_lapb").textContent = tr1_lapb + " / 10"; document.getElementById("r2_tr1_svfc_raw").textContent = tr1_svfc; document.getElementById("r2_tr1_svfc").textContent = tr1_svfc + " / 10"; document.getElementById("r2_tr1_logc_raw").textContent = tr1_logc; document.getElementById("r2_tr1_logc").textContent = tr1_logc + " / 10"; document.getElementById("r2_tr1").textContent = tr1 + " / 70"; document.getElementById("r2_pr11_psvf_raw").textContent = psvfT; document.getElementById("r2_pr11_psvf").textContent = psvfT; document.getElementById("r2_pr11_psvi_raw").textContent = psviT; document.getElementById("r2_pr11_psvi").textContent = psviT; document.getElementById("r2_pr11").textContent = pr11_pbt + " / 20"; var el_pr12r = document.getElementById('r2_pr12r'); if (el_pr12r) el_pr12r.textContent = pr12sum; document.getElementById("r2_pr12").textContent = pr12; document.getElementById("sum_3946_total").textContent = b3946; var g2 = getGrade(b3946); var gb2 = document.getElementById("sum_3946_grade"); gb2.textContent = g2.g; gb2.className = "grade-pill " + g2.cls; var eg1 = document.getElementById("r_grp1_total"); if (eg1) eg1.textContent = fmt(prj1 + prj2); var eg2 = document.getElementById("r_grp2_total"); if (eg2) eg2.textContent = fmt(prj3 + prj4 + lr1); refreshApprovalStatusBar(); }
function exportCSV() { var nama = document.getElementById("nama_pelajar").value || ""; var matrik = document.getElementById("no_matrik").value || ""; var sviA = v("svi_a1") + v("svi_a2") + v("svi_a3") + v("svi_a4"); var sviB = v("svi_b1") + v("svi_b2") + v("svi_b3") + v("svi_b4") + v("svi_b5") + v("svi_b6") + v("svi_b7") + v("svi_b8") + v("svi_b9") + v("svi_b10"); var logT = v("log_a1") + v("log_b1") + v("log_c1"); var psvfT = v("psvf_a") + v("psvf_b1") + v("psvf_b2") + v("psvf_b3") + v("psvf_b4") + v("psvf_b5") + v("psvf_c1") + v("psvf_c2") + v("psvf_c3") + v("psvf_d1") + v("psvf_d2") + v("psvf_d3") + v("psvf_d4"); var psviT = v("psvi_a") + v("psvi_b1") + v("psvi_b2") + v("psvi_b3") + v("psvi_b4") + v("psvi_b5") + v("psvi_c1") + v("psvi_c2") + v("psvi_c3") + v("psvi_d1") + v("psvi_d2") + v("psvi_d3") + v("psvi_d4"); var a4rep = pilihan === 1 ? (v("rep_a4_tech_p1") + v("rep_a4_admin_p1")) : (v("rep_a4_tech_p2") + v("rep_a4_admin_p2")); var repT = v("rep_a1") + v("rep_a2") + v("rep_a3") + a4rep + v("rep_a5") + v("rep_a6") + v("rep_a7") + v("rep_b1") + v("rep_b2") + v("rep_b3") + v("rep_b4"); var rows = [["Field", "Value"], ["Nama Pelajar", nama], ["No Matrik", matrik], ["Kursus", document.getElementById("kursus").value], ["Semester", document.getElementById("semester").value], ["Sesi", document.getElementById("sesi").value], ["SVF", document.getElementById("svf_name").value], ["SVI", document.getElementById("svi_name").value], ["Organisasi", document.getElementById("organisasi").value], ["Pilihan Tugasan", "Pilihan " + pilihan], ["---", "--- SVI ---"], ["SVI A1", v("svi_a1")], ["SVI A2", v("svi_a2")], ["SVI A3", v("svi_a3")], ["SVI A4", v("svi_a4")], ["SVI Bah A", sviA], ["SVI Bah B", sviB], ["SVI Total", sviA + sviB], ["SVI Penilaian", document.getElementById("svi_rating").value], ["---", "--- SVF ---"], ["SVF A1 Admin", v("svf_a1_admin")], ["SVF A1 Tech", v("svf_a1_tech")], ["SVF A2 Admin", v("svf_a2_admin")], ["SVF A2 Tech", v("svf_a2_tech")], ["SVF A3", v("svf_a3")], ["SVF B", v("svf_b1")], ["SVF Komitmen", v("svf_c1")], ["SVF Penilaian", document.getElementById("svf_rating").value], ["SVF Status", document.getElementById("svf_status").value], ["---", "--- Logbook ---"], ["Logbook Kandungan", v("log_a1")], ["Logbook Persembahan", v("log_b1")], ["Logbook Penghantaran", v("log_c1")], ["Logbook Total", logT], ["---", "--- Pembentangan ---"], ["Pembentangan SVF", psvfT], ["Pembentangan SVI", psviT], ["---", "--- Laporan LI ---"], ["Laporan LI Total", repT], ["---", "--- Gred Akhir ---"], ["BITU3926 Markah", document.getElementById("sum_3926_total").textContent], ["BITU3926 Gred", document.getElementById("sum_3926_grade").textContent], ["BITU3946 Markah", document.getElementById("sum_3946_total").textContent], ["BITU3946 Gred", document.getElementById("sum_3946_grade").textContent]]; var csv = rows.map(function(r) { return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"); var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "LI_" + (matrik || "pelajar") + "_" + new Date().toISOString().slice(0, 10) + ".csv"; a.click(); }
function resetAll() { if (!confirm("Reset semua data? Tindakan ini tidak boleh diundo.")) return; document.querySelectorAll("input[type=number]").forEach(function(i) { i.value = 0; }); document.querySelectorAll("input[type=text]").forEach(function(i) { i.value = ""; }); document.querySelectorAll("textarea").forEach(function(i) { i.value = ""; }); document.querySelectorAll("select").forEach(function(i) { i.selectedIndex = 0; }); document.querySelectorAll("input[type=hidden]").forEach(function(i) { i.value = ""; }); document.querySelectorAll(".radio-opt").forEach(function(i) { i.classList.remove("selected"); }); pilihan = 1; hadir = 1; document.getElementById("opt-p1").classList.add("selected"); document.getElementById("rep_p1_wrap").style.display = ""; document.getElementById("rep_p2_wrap").style.display = "none"; ['svi','svf','logbook','presentation','report'].forEach(function(sec) { var cb = document.getElementById(sec + '-confirm-cb'); if (cb) cb.checked = false; updateSimpanBtn(sec); }); calcSVI(); calcSVF(); calcLog(); calcPres(); calcReport(); showTab("info"); currentStudentId = null; setSaveStatus(''); }

// ===== STUDENT & MARKS PERSISTENCE =====
var currentStudentId = null;
var saveTimer = null;
var _suppressSave = false;

function setSaveStatus(status) {
  var el = document.getElementById('save-status');
  if (!el) return;
  if (status === 'pending')  { el.textContent = '● Belum disimpan'; el.className = 'save-status save-pending'; }
  else if (status === 'saving') { el.textContent = '↑ Menyimpan...';  el.className = 'save-status save-saving'; }
  else if (status === 'saved')  { el.textContent = '✓ Tersimpan';     el.className = 'save-status save-saved'; }
  else if (status === 'error')  { el.textContent = '✗ Ralat simpan';  el.className = 'save-status save-error'; }
  else { el.textContent = ''; el.className = 'save-status'; }
}

function scheduleSave() {
  if (_suppressSave) return;
  var session = getSession();
  if (!session) return;
  setSaveStatus('pending');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveAll, 2000);
}

function gVal(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function getCbVal(id) { var el = document.getElementById(id); return !!(el && el.checked); }

function collectSections() {
  return {
    svi: {
      a1: gVal('svi_a1'), a2: gVal('svi_a2'), a3: gVal('svi_a3'), a4: gVal('svi_a4'),
      b1: gVal('svi_b1'), b2: gVal('svi_b2'), b3: gVal('svi_b3'), b4: gVal('svi_b4'),
      b5: gVal('svi_b5'), b6: gVal('svi_b6'), b7: gVal('svi_b7'), b8: gVal('svi_b8'),
      b9: gVal('svi_b9'), b10: gVal('svi_b10'),
      ulasan: gVal('svi_ulasan'), rating: gVal('svi_rating'),
      confirmed: getCbVal('svi-confirm-cb')
    },
    svf: {
      a1_admin: gVal('svf_a1_admin'), a1_tech: gVal('svf_a1_tech'),
      a2_admin: gVal('svf_a2_admin'), a2_tech: gVal('svf_a2_tech'),
      a3: gVal('svf_a3'),
      b1: gVal('svf_b1'), c1: gVal('svf_c1'),
      ulasan: gVal('svf_ulasan'), rating: gVal('svf_rating'), status: gVal('svf_status'),
      confirmed: getCbVal('svf-confirm-cb')
    },
    logbook: {
      a1: gVal('log_a1'), b1: gVal('log_b1'), c1: gVal('log_c1'),
      confirmed: getCbVal('logbook-confirm-cb')
    },
    presentation: {
      psvf_a:  gVal('psvf_a'),
      psvf_b1: gVal('psvf_b1'), psvf_b2: gVal('psvf_b2'), psvf_b3: gVal('psvf_b3'),
      psvf_b4: gVal('psvf_b4'), psvf_b5: gVal('psvf_b5'),
      psvf_c1: gVal('psvf_c1'), psvf_c2: gVal('psvf_c2'), psvf_c3: gVal('psvf_c3'),
      psvf_d1: gVal('psvf_d1'), psvf_d2: gVal('psvf_d2'), psvf_d3: gVal('psvf_d3'), psvf_d4: gVal('psvf_d4'),
      psvi_a:  gVal('psvi_a'),
      psvi_b1: gVal('psvi_b1'), psvi_b2: gVal('psvi_b2'), psvi_b3: gVal('psvi_b3'),
      psvi_b4: gVal('psvi_b4'), psvi_b5: gVal('psvi_b5'),
      psvi_c1: gVal('psvi_c1'), psvi_c2: gVal('psvi_c2'), psvi_c3: gVal('psvi_c3'),
      psvi_d1: gVal('psvi_d1'), psvi_d2: gVal('psvi_d2'), psvi_d3: gVal('psvi_d3'), psvi_d4: gVal('psvi_d4'),
      confirmed: getCbVal('presentation-confirm-cb')
    },
    report: {
      a1: gVal('rep_a1'), a2: gVal('rep_a2'), a3: gVal('rep_a3'),
      a4_tech_p1: gVal('rep_a4_tech_p1'), a4_admin_p1: gVal('rep_a4_admin_p1'),
      a4_tech_p2: gVal('rep_a4_tech_p2'), a4_admin_p2: gVal('rep_a4_admin_p2'),
      a5: gVal('rep_a5'), a6: gVal('rep_a6'), a7: gVal('rep_a7'), b1: gVal('rep_b1'), b2: gVal('rep_b2'), b3: gVal('rep_b3'), b4: gVal('rep_b4'),
      ulasan: gVal('rep_ulasan'), pilihan: pilihan,
      confirmed: getCbVal('report-confirm-cb')
    },
    meta: { hadir: hadir }
  };
}

function populateSection(section, data) {
  if (!data) return;
  var fieldMap = {
    svi: ['a1','a2','a3','a4','b1','b2','b3','b4','b5','b6','b7','b8','b9','b10'],
    svf: ['a1_admin','a1_tech','a2_admin','a2_tech','a3','b1','c1'],
    logbook: ['a1','b1','c1']
  };

  if (section === 'svi') {
    fieldMap.svi.forEach(function(k) { var el = document.getElementById('svi_' + k); if (el && data[k] !== undefined) el.value = data[k]; });
    if (data.ulasan !== undefined) { var el = document.getElementById('svi_ulasan'); if (el) el.value = data.ulasan; }
    if (data.rating) { var el = document.getElementById('svi_rating'); if (el) el.value = data.rating; }
    var sviCb = document.getElementById('svi-confirm-cb'); if (sviCb) sviCb.checked = data.confirmed === true;
    updateSimpanBtn('svi');
    calcSVI();
  } else if (section === 'svf') {
    var svfData = Object.assign({}, data);
    // Backward compatibility: map old field names (a1-a5) to new names
    if (svfData.a1 !== undefined && svfData.a1_admin === undefined) {
      svfData.a1_admin = svfData.a1;
      svfData.a1_tech = svfData.a2 !== undefined ? svfData.a2 : 0;
      svfData.a2_admin = svfData.a3 !== undefined ? svfData.a3 : 0;
      svfData.a2_tech = svfData.a4 !== undefined ? svfData.a4 : 0;
      if (svfData.a5 !== undefined) svfData.a3 = svfData.a5;
    }
    fieldMap.svf.forEach(function(k) { var el = document.getElementById('svf_' + k); if (el && svfData[k] !== undefined) el.value = svfData[k]; });
    if (svfData.ulasan !== undefined) { var el = document.getElementById('svf_ulasan'); if (el) el.value = svfData.ulasan; }
    if (svfData.rating) { var el = document.getElementById('svf_rating'); if (el) el.value = svfData.rating; }
    if (svfData.status) { var el = document.getElementById('svf_status'); if (el) el.value = svfData.status; }
    var svfCb = document.getElementById('svf-confirm-cb'); if (svfCb) svfCb.checked = svfData.confirmed === true;
    updateSimpanBtn('svf');
    calcSVF();
  } else if (section === 'logbook') {
    fieldMap.logbook.forEach(function(k) { var el = document.getElementById('log_' + k); if (el && data[k] !== undefined) el.value = data[k]; });
    var logCb = document.getElementById('logbook-confirm-cb'); if (logCb) logCb.checked = data.confirmed === true;
    updateSimpanBtn('logbook');
    calcLog();
  } else if (section === 'presentation') {
    Object.keys(data).forEach(function(k) { var el = document.getElementById(k); if (el && data[k] !== undefined) el.value = data[k]; });
    var presCb = document.getElementById('presentation-confirm-cb'); if (presCb) presCb.checked = data.confirmed === true;
    updateSimpanBtn('presentation');
    calcPres();
  } else if (section === 'report') {
    ['a1','a2','a3','a4_tech_p1','a4_admin_p1','a4_tech_p2','a4_admin_p2','a5','a6','a7','b1','b2','b3','b4'].forEach(function(k) {
      var el = document.getElementById('rep_' + k); if (el && data[k] !== undefined) el.value = data[k];
    });
    if (data.ulasan !== undefined) { var el = document.getElementById('rep_ulasan'); if (el) el.value = data.ulasan; }
    if (data.pilihan) { pilihan = parseInt(data.pilihan) || 1; selectPilihan(pilihan); }
    var repCb = document.getElementById('report-confirm-cb'); if (repCb) repCb.checked = data.confirmed === true;
    updateSimpanBtn('report');
    calcReport();
  } else if (section === 'meta') {
    if (data.hadir !== undefined) {
      hadir = parseInt(data.hadir);
    }
  }
}

// ===== STRICT COMPLETION CHECK =====
// A student is "Lengkap" only when all 5 sections have confirmed: true
function isStudentComplete(marksMap) {
  var sections = ['svi', 'svf', 'logbook', 'presentation', 'report'];
  return sections.every(function(sec) {
    return marksMap[sec] && marksMap[sec].confirmed === true;
  });
}
// ===== END STRICT COMPLETION CHECK =====

// ===== SECTION VALIDATION & MANUAL SIMPAN =====
function validateSection(section) {
  var missing = [];
  var validRatings = ['Sangat Baik','Baik','Memuaskan','Kurang Memuaskan','Lemah'];
  function chkText(id, label) {
    var el = document.getElementById(id);
    if (!el || !el.value || !el.value.trim()) missing.push(label);
  }
  function chkRadio(id, validVals, label) {
    var el = document.getElementById(id);
    if (!el || validVals.indexOf(el.value) === -1) missing.push(label);
  }
  if (section === 'svi') {
    chkText('svi_ulasan', 'Ulasan prestasi kerja (SVI)');
    chkRadio('svi_rating', validRatings, 'Penilaian keseluruhan SVI');
  } else if (section === 'svf') {
    chkText('svf_ulasan', 'Ulasan keseluruhan (SVF)');
    chkRadio('svf_rating', validRatings, 'Penilaian keseluruhan SVF');
    chkRadio('svf_status', ['Lulus','Gagal'], 'Cadangan status pelajar (Lulus/Gagal)');
  } else if (section === 'logbook') {
    // All numeric fields — no text/radio required
  } else if (section === 'presentation') {
    // All numeric fields — no text/radio required
  } else if (section === 'report') {
    chkText('rep_ulasan', 'Ulasan laporan LI');
  }
  return missing;
}

async function simpanSection(section) {
  var missing = validateSection(section);
  await saveAll();
  if (missing.length > 0) {
    alert('Bahagian berikut belum lengkap:\n' + missing.join('\n'));
  }
}

function updateSimpanBtn(section) {
  var cb = document.getElementById(section + '-confirm-cb');
  var badge = document.getElementById(section + '-confirm-badge');
  if (badge) badge.style.display = (cb && cb.checked) ? 'inline' : 'none';
}

function onConfirmChange(section) {
  updateSimpanBtn(section);
  refreshApprovalStatusBar();
  clearTimeout(saveTimer);
  saveAll();
}
// ===== END SECTION VALIDATION =====

async function saveAll() {
  if (!sb) return;
  var session = getSession();
  if (!session) return;
  var matric = document.getElementById('no_matrik').value.trim();
  if (!matric) { setSaveStatus(''); return; }

  setSaveStatus('saving');
  try {
    var studentPayload = {
      matric_no:  matric,
      name:       document.getElementById('nama_pelajar').value,
      kursus:     document.getElementById('kursus').value,
      semester:   document.getElementById('semester').value,
      sesi:       document.getElementById('sesi').value,
      organisasi: document.getElementById('organisasi').value,
      svf_name:   document.getElementById('svf_name').value,
      svi_name:   document.getElementById('svi_name').value
    };

    var sResp = await sb.from('students')
      .upsert(studentPayload, { onConflict: 'matric_no' })
      .select('id')
      .single();

    if (sResp.error) throw sResp.error;
    currentStudentId = sResp.data.id;

    var sections = collectSections();
    var now = new Date().toISOString();
    var evalEmail = _currentEvalEmail || session.email;
    var upserts = Object.keys(sections).map(function(sec) {
      return {
        student_id:      currentStudentId,
        evaluator_email: evalEmail,
        section:         sec,
        data:            sections[sec],
        updated_at:      now
      };
    });

    var mResp = await sb.from('marks')
      .upsert(upserts, { onConflict: 'student_id,evaluator_email,section' });

    if (mResp.error) throw mResp.error;

    // Auto-reset approval status: if AJK_LI/ADMIN edits an approved student, reset to 'submitted'
    var _saveSession = getSession();
    var _saveEff = getEffectiveRole(_saveSession ? _saveSession.roles : []);
    if (currentStudentId && _studentApprovalStatus.status === 'approved' &&
        (_saveEff === 'ADMIN' || _saveEff === 'AJK_LI')) {
      await sb.from('students').update({ approval_status: 'submitted' }).eq('id', currentStudentId);
      _studentApprovalStatus.status = 'submitted';
      refreshApprovalStatusBar();
      showApprovalToast("Status kelulusan telah ditetapkan semula kepada 'Menunggu Kelulusan'.", 'warning');
    }

    setSaveStatus('saved');
  } catch(e) {
    console.error('Save error:', e);
    setSaveStatus('error');
  }
}

async function loadByMatric(matric) {
  if (!sb || !matric) return;
  var session = getSession();
  if (!session) return;

  setSaveStatus('saving');
  try {
    var sResp = await sb.from('students').select('*').eq('matric_no', matric).single();
    if (sResp.error || !sResp.data) {
      setSaveStatus('');
      alert('Tiada rekod untuk matrik: ' + matric);
      return;
    }
    var student = sResp.data;
    currentStudentId = student.id;
    currentStudent = student;

    // Populate student info fields
    document.getElementById('nama_pelajar').value = student.name || '';
    document.getElementById('kursus').value       = student.kursus || '';
    document.getElementById('semester').value     = student.semester || '';
    document.getElementById('sesi').value         = student.sesi || '';
    document.getElementById('organisasi').value   = student.organisasi || '';
    document.getElementById('svf_name').value     = student.svf_name || '';
    document.getElementById('svi_name').value     = student.svi_name || '';

    // Load marks (suppress auto-save while populating form)
    var session2 = getSession();
    var eff2 = getEffectiveRole(session2 ? session2.roles : []);
    var marksQ = sb.from('marks').select('section,data').eq('student_id', student.id);
    if (eff2 === 'PENSYARAH' && session2) marksQ = marksQ.eq('evaluator_email', session2.email);
    var mResp = await marksQ;
    if (!mResp.error && mResp.data) {
      _suppressSave = true;
      try {
        mResp.data.forEach(function(row) { populateSection(row.section, row.data); });
      } finally {
        _suppressSave = false;
      }
    }

    setSaveStatus('saved');
  } catch(e) {
    console.error('Load error:', e);
    setSaveStatus('error');
  }
}
// ===== END STUDENT & MARKS PERSISTENCE =====

// ===== USER MANAGEMENT =====
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadUserMgmt() {
  var tbody = document.getElementById('um-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:1.5rem">Memuatkan...</td></tr>';

  var resp = await sb.from('users').select('id, full_name, email, roles, is_active').order('created_at');
  if (resp.error) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;padding:1.5rem">Ralat memuatkan pengguna.</td></tr>';
    return;
  }
  // Only show ADMIN and AJK_LI users (exclude PENSYARAH-only users)
  var users = (resp.data || []).filter(function(u) {
    var r = u.roles || [];
    return r.indexOf('ADMIN') !== -1 || r.indexOf('AJK_LI') !== -1;
  });
  var session = getSession();

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:1.5rem">Tiada pengguna.</td></tr>';
    return;
  }

  var html = '';
  users.forEach(function(u) {
    var isActive = u.is_active !== false;
    var isSelf   = session && u.email.toLowerCase() === session.email.toLowerCase();
    var eid      = escHtml(u.email);
    var rolesHtml = (u.roles || []).map(function(r) {
      return '<span class="role-badge role-' + escHtml(r) + '" style="font-size:10px;padding:2px 7px">' + escHtml(r) + '</span>';
    }).join(' ');
    html += '<tr>' +
      '<td>' + escHtml(u.full_name || '') + (isSelf ? ' <span style="font-size:10px;color:var(--text3)">(anda)</span>' : '') + '</td>' +
      '<td style="font-size:12.5px">' + eid + '</td>' +
      '<td>' + rolesHtml + '</td>' +
      '<td><span class="status-badge ' + (isActive ? 'status-active' : 'status-inactive') + '">' + (isActive ? 'Aktif' : 'Tidak Aktif') + '</span></td>' +
      '<td><div class="um-actions">' +
        '<button class="btn-sm btn-sm-edit"       onclick="openEditModal(\'' + eid + '\')">Edit</button>' +
        '<button class="btn-sm btn-sm-reset"       onclick="openPwModal(\'' + eid + '\')">Reset PW</button>' +
        (isSelf ? '' : '<button class="btn-sm ' + (isActive ? 'btn-sm-deactivate' : 'btn-sm-activate') + '" onclick="toggleUserActive(\'' + eid + '\')">' + (isActive ? 'Nyahaktif' : 'Aktifkan') + '</button>') +
        (isSelf ? '' : '<button class="btn-sm btn-sm-del" onclick="deleteUser(\'' + eid + '\')">Hapus</button>') +
      '</div></td>' +
    '</tr>';
  });
  tbody.innerHTML = html;
}

async function addUser() {
  var name  = document.getElementById('um-add-name').value.trim();
  var email = document.getElementById('um-add-email').value.trim().toLowerCase();
  var pw    = document.getElementById('um-add-pw').value;
  var errEl = document.getElementById('um-add-error');
  var sucEl = document.getElementById('um-add-success');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!name || !email || !pw) {
    errEl.textContent = 'Sila isi semua medan.'; errEl.style.display = 'block'; return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Format e-mel tidak sah.'; errEl.style.display = 'block'; return;
  }
  var roles = [];
  if (document.getElementById('um-add-r-admin').checked) roles.push('ADMIN');
  if (document.getElementById('um-add-r-ajk').checked)   roles.push('AJK_LI');
  if (!roles.length) {
    errEl.textContent = 'Pilih sekurang-kurangnya satu peranan.'; errEl.style.display = 'block'; return;
  }

  var pwHash = await hashPassword(pw);
  var resp = await sb.from('users').insert({
    full_name: name, email: email, password_hash: pwHash, roles: roles, is_active: true
  });
  if (resp.error) {
    errEl.textContent = resp.error.code === '23505' ? 'E-mel sudah digunakan.' : 'Ralat: ' + resp.error.message;
    errEl.style.display = 'block'; return;
  }

  document.getElementById('um-add-name').value  = '';
  document.getElementById('um-add-email').value = '';
  document.getElementById('um-add-pw').value    = '';
  document.getElementById('um-add-r-admin').checked = false;
  document.getElementById('um-add-r-ajk').checked   = false;
  sucEl.textContent = 'Pengguna ' + name + ' berjaya ditambah.';
  sucEl.style.display = 'block';
  loadUserMgmt();
}

// Edit modal — keyed by email
async function openEditModal(email) {
  var resp = await sb.from('users').select('*').eq('email', email).single();
  if (resp.error || !resp.data) return;
  var u = resp.data;
  document.getElementById('um-edit-key').value   = u.email;
  document.getElementById('um-edit-name').value  = u.full_name || '';
  document.getElementById('um-edit-email').value = u.email;
  document.getElementById('um-edit-r-admin').checked = (u.roles || []).indexOf('ADMIN') !== -1;
  document.getElementById('um-edit-r-ajk').checked   = (u.roles || []).indexOf('AJK_LI') !== -1;
  document.getElementById('um-edit-r-psy').checked   = (u.roles || []).indexOf('PENSYARAH') !== -1;
  document.getElementById('um-edit-error').style.display = 'none';
  var modal = document.getElementById('um-edit-modal');
  modal.style.display = 'flex'; modal.classList.add('open');
}

function closeEditModal() {
  var modal = document.getElementById('um-edit-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
}

async function saveEditUser() {
  var origEmail = document.getElementById('um-edit-key').value;
  var name      = document.getElementById('um-edit-name').value.trim();
  var email     = document.getElementById('um-edit-email').value.trim().toLowerCase();
  var errEl     = document.getElementById('um-edit-error');
  errEl.style.display = 'none';

  if (!name || !email) {
    errEl.textContent = 'Nama dan e-mel diperlukan.'; errEl.style.display = 'block'; return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Format e-mel tidak sah.'; errEl.style.display = 'block'; return;
  }
  var roles = [];
  if (document.getElementById('um-edit-r-admin').checked) roles.push('ADMIN');
  if (document.getElementById('um-edit-r-ajk').checked)   roles.push('AJK_LI');
  if (document.getElementById('um-edit-r-psy').checked)   roles.push('PENSYARAH');
  if (!roles.length) {
    errEl.textContent = 'Pilih sekurang-kurangnya satu peranan.'; errEl.style.display = 'block'; return;
  }

  var resp = await sb.from('users').update({ full_name: name, email: email, roles: roles }).eq('email', origEmail);
  if (resp.error) {
    errEl.textContent = resp.error.code === '23505' ? 'E-mel sudah digunakan oleh pengguna lain.' : 'Ralat: ' + resp.error.message;
    errEl.style.display = 'block'; return;
  }

  // Update session if editing self
  var session = getSession();
  if (session && session.email.toLowerCase() === origEmail.toLowerCase()) {
    session.displayName = name;
    session.email       = email;
    session.roles       = roles;
    localStorage.setItem('li_session', JSON.stringify(session));
    document.getElementById('sidebar-user-name').textContent = name;
    var eff = getEffectiveRole(roles);
    var roleLabels = { ADMIN: 'Admin', AJK_LI: 'AJK LI', PENSYARAH: 'Pensyarah' };
    var badge = document.getElementById('sidebar-role-badge');
    badge.className   = 'role-badge role-' + eff;
    badge.textContent = roleLabels[eff] || eff;
  }
  closeEditModal();
  loadUserMgmt();
}

// Password reset modal — keyed by email
async function openPwModal(email) {
  var resp = await sb.from('users').select('full_name, email').eq('email', email).single();
  if (resp.error || !resp.data) return;
  document.getElementById('um-pw-key').value    = resp.data.email;
  document.getElementById('um-pw-label').textContent = 'Kata Laluan Baharu untuk ' + (resp.data.full_name || resp.data.email);
  document.getElementById('um-new-pw').value    = '';
  document.getElementById('um-pw-error').style.display = 'none';
  var modal = document.getElementById('um-pw-modal');
  modal.style.display = 'flex'; modal.classList.add('open');
}

function closePwModal() {
  var modal = document.getElementById('um-pw-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
}

async function saveResetPw() {
  var email = document.getElementById('um-pw-key').value;
  var pw    = document.getElementById('um-new-pw').value;
  var errEl = document.getElementById('um-pw-error');
  errEl.style.display = 'none';
  if (!pw || pw.length < 4) {
    errEl.textContent = 'Kata laluan mestilah sekurang-kurangnya 4 aksara.'; errEl.style.display = 'block'; return;
  }
  var pwHash = await hashPassword(pw);
  var resp = await sb.from('users').update({ password_hash: pwHash }).eq('email', email);
  if (resp.error) {
    errEl.textContent = 'Ralat: ' + resp.error.message; errEl.style.display = 'block'; return;
  }
  closePwModal();
  loadUserMgmt();
}

async function toggleUserActive(email) {
  var resp = await sb.from('users').select('is_active').eq('email', email).single();
  if (resp.error || !resp.data) return;
  var newState = resp.data.is_active === false ? true : false;
  await sb.from('users').update({ is_active: newState }).eq('email', email);
  loadUserMgmt();
}

async function deleteUser(email) {
  var resp = await sb.from('users').select('full_name').eq('email', email).single();
  var name = resp.data ? (resp.data.full_name || email) : email;
  if (!confirm('Padam pengguna "' + name + '"? Tindakan ini tidak boleh diundo.')) return;
  await sb.from('users').delete().eq('email', email);
  loadUserMgmt();
}
// ===== END USER MANAGEMENT =====

// ===== UPLOAD HELPERS =====
function parseUploadFile(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var wb = XLSX.read(data, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      callback(null, rows);
    } catch(err) {
      callback(err, null);
    }
  };
  reader.onerror = function() { callback(new Error('Gagal membaca fail.'), null); };
  reader.readAsArrayBuffer(file);
}

function normalizeRow(r) {
  var n = {};
  Object.keys(r).forEach(function(k) { n[k.trim().toLowerCase()] = String(r[k]).trim(); });
  return n;
}

function uploadStatusBadge(status) {
  if (status === 'baru')      return '<span class="upload-badge upload-badge-baru">Baru</span>';
  if (status === 'kemaskini') return '<span class="upload-badge upload-badge-kemaskini">Kemaskini</span>';
  if (status === 'konflik')   return '<span class="upload-badge upload-badge-konflik">Konflik</span>';
  return '<span class="upload-badge upload-badge-konflik">Tidak Sah</span>';
}
// ===== END UPLOAD HELPERS =====

// ===== UPLOAD PENSYARAH =====
var _uploadPensyarahRows = [];

function handleUploadPensyarah(input) {
  var file = input.files[0];
  input.value = '';
  if (!file) return;
  parseUploadFile(file, function(err, rows) {
    if (err) { alert('Ralat membaca fail: ' + err.message); return; }
    if (!rows || !rows.length) { alert('Fail kosong atau format tidak dikenali.'); return; }

    var keys = Object.keys(rows[0]).map(function(k) { return k.trim().toLowerCase(); });
    if (keys.indexOf('nama penuh') === -1 || keys.indexOf('email') === -1) {
      alert('Lajur tidak lengkap. Diperlukan: Nama Penuh, No Staf, Jabatan, Email');
      return;
    }

    _uploadPensyarahRows = rows.map(function(r) {
      var n = normalizeRow(r);
      return {
        full_name: n['nama penuh'] || '',
        no_staf:   n['no staf'] || n['nostaf'] || '',
        jabatan:   n['jabatan'] || '',
        email:     (n['email'] || '').toLowerCase()
      };
    }).filter(function(r) { return r.full_name && r.email; });

    if (!_uploadPensyarahRows.length) {
      alert('Tiada baris data yang sah. Semak semula fail anda.');
      return;
    }
    prepareUploadPensyarahPreview();
  });
}

async function prepareUploadPensyarahPreview() {
  var resp = await sb.from('users').select('email, full_name');
  var existing = resp.data || [];
  var emailSet = {}, nameToEmail = {};
  existing.forEach(function(u) {
    emailSet[u.email.toLowerCase()] = true;
    nameToEmail[(u.full_name || '').toLowerCase()] = u.email.toLowerCase();
  });

  var counts = { baru: 0, kemaskini: 0, konflik: 0, invalid: 0 };
  var hasConflict = false;
  _uploadPensyarahRows.forEach(function(r) {
    var emailLow = r.email.toLowerCase();
    var nameLow  = r.full_name.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
      r._status = 'invalid';
    } else if (emailSet[emailLow]) {
      r._status = 'kemaskini';
    } else if (nameToEmail[nameLow] && nameToEmail[nameLow] !== emailLow) {
      r._status = 'konflik';
      hasConflict = true;
    } else {
      r._status = 'baru';
    }
    counts[r._status]++;
  });

  var html = '';
  _uploadPensyarahRows.forEach(function(r, i) {
    html += '<tr>' +
      '<td style="color:var(--text3)">' + (i + 1) + '</td>' +
      '<td>' + escHtml(r.full_name) + '</td>' +
      '<td>' + escHtml(r.no_staf) + '</td>' +
      '<td>' + escHtml(r.jabatan) + '</td>' +
      '<td style="font-size:12px">' + escHtml(r.email) + '</td>' +
      '<td>' + uploadStatusBadge(r._status) + '</td>' +
      '</tr>';
  });
  document.getElementById('up-pensyarah-tbody').innerHTML = html;

  var parts = [];
  if (counts.baru)      parts.push(counts.baru + ' baru');
  if (counts.kemaskini) parts.push(counts.kemaskini + ' kemaskini');
  if (counts.konflik)   parts.push(counts.konflik + ' konflik');
  if (counts.invalid)   parts.push(counts.invalid + ' tidak sah');
  document.getElementById('up-pensyarah-count').textContent =
    _uploadPensyarahRows.length + ' rekod: ' + parts.join(', ') + '.';

  var cw = document.getElementById('up-pensyarah-conflict-wrap');
  if (cw) { cw.style.display = hasConflict ? 'block' : 'none'; }
  var cb = document.getElementById('up-pensyarah-conflict-cb');
  if (cb) cb.checked = false;

  var modal = document.getElementById('up-pensyarah-modal');
  modal.style.display = 'flex'; modal.classList.add('open');
}

function closeUploadPensyarahModal() {
  var modal = document.getElementById('up-pensyarah-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
  _uploadPensyarahRows = [];
}

async function confirmUploadPensyarah() {
  if (!_uploadPensyarahRows.length) return;
  var includeConflicts = document.getElementById('up-pensyarah-conflict-cb').checked;
  var btn = document.getElementById('up-pensyarah-confirm-btn');
  btn.disabled = true; btn.textContent = 'Memproses...';

  var success = 0, skipped = 0, errors = 0;
  var defaultHash = await hashPassword('utem1234');
  for (var i = 0; i < _uploadPensyarahRows.length; i++) {
    var r = _uploadPensyarahRows[i];
    if (r._status === 'invalid')                        { skipped++; continue; }
    if (r._status === 'konflik' && !includeConflicts)   { skipped++; continue; }
    var resp = await sb.from('users').upsert({
      full_name: r.full_name, no_staf: r.no_staf, jabatan: r.jabatan,
      email: r.email, password_hash: defaultHash, roles: ['PENSYARAH'], is_active: true
    }, { onConflict: 'email' });
    if (resp.error) { errors++; } else { success++; }
  }

  btn.disabled = false; btn.textContent = 'Sahkan Upload';
  closeUploadPensyarahModal();
  var msg = 'Upload selesai: ' + success + ' berjaya';
  if (skipped) msg += ', ' + skipped + ' dilangkau';
  if (errors)  msg += ', ' + errors + ' gagal';
  alert(msg + '.');
  loadUruspensyarah();
}
// ===== END UPLOAD PENSYARAH =====

// ===== UPLOAD PELAJAR =====
var _uploadPelajarRows = [];

function handleUploadPelajar(input) {
  var file = input.files[0];
  input.value = '';
  if (!file) return;
  parseUploadFile(file, function(err, rows) {
    if (err) { alert('Ralat membaca fail: ' + err.message); return; }
    if (!rows || !rows.length) { alert('Fail kosong atau format tidak dikenali.'); return; }

    var keys = Object.keys(rows[0]).map(function(k) { return k.trim().toLowerCase(); });
    var hasMatric = keys.indexOf('no matrik') !== -1 || keys.indexOf('matrik') !== -1;
    if (!hasMatric) {
      alert('Lajur tidak lengkap. Diperlukan: Nama Pelajar, No Matrik, Nama Program');
      return;
    }

    _uploadPelajarRows = rows.map(function(r) {
      var n = normalizeRow(r);
      return {
        name:      n['nama pelajar'] || n['nama'] || '',
        matric_no: n['no matrik']    || n['matrik'] || '',
        kursus:    n['nama program'] || n['program'] || ''
      };
    }).filter(function(r) { return r.matric_no && r.name; });

    if (!_uploadPelajarRows.length) {
      alert('Tiada baris data yang sah. Semak semula fail anda.');
      return;
    }
    prepareUploadPelajarPreview();
  });
}

async function prepareUploadPelajarPreview() {
  var resp = await sb.from('students').select('matric_no, name');
  var existing = resp.data || [];
  var matricSet = {}, nameToMatric = {};
  existing.forEach(function(s) {
    matricSet[s.matric_no] = true;
    nameToMatric[(s.name || '').toLowerCase()] = s.matric_no;
  });

  var counts = { baru: 0, kemaskini: 0, konflik: 0 };
  var hasConflict = false;
  _uploadPelajarRows.forEach(function(r) {
    var nameLow = r.name.toLowerCase();
    if (matricSet[r.matric_no]) {
      r._status = 'kemaskini';
    } else if (nameToMatric[nameLow] && nameToMatric[nameLow] !== r.matric_no) {
      r._status = 'konflik';
      hasConflict = true;
    } else {
      r._status = 'baru';
    }
    counts[r._status]++;
  });

  var html = '';
  _uploadPelajarRows.forEach(function(r, i) {
    html += '<tr>' +
      '<td style="color:var(--text3)">' + (i + 1) + '</td>' +
      '<td>' + escHtml(r.name) + '</td>' +
      '<td>' + escHtml(r.matric_no) + '</td>' +
      '<td>' + escHtml(r.kursus) + '</td>' +
      '<td>' + uploadStatusBadge(r._status) + '</td>' +
      '</tr>';
  });
  document.getElementById('up-pelajar-tbody').innerHTML = html;

  var parts = [];
  if (counts.baru)      parts.push(counts.baru + ' baru');
  if (counts.kemaskini) parts.push(counts.kemaskini + ' kemaskini');
  if (counts.konflik)   parts.push(counts.konflik + ' konflik');
  document.getElementById('up-pelajar-count').textContent =
    _uploadPelajarRows.length + ' rekod: ' + parts.join(', ') + '.';

  var cw = document.getElementById('up-pelajar-conflict-wrap');
  if (cw) { cw.style.display = hasConflict ? 'block' : 'none'; }
  var cb = document.getElementById('up-pelajar-conflict-cb');
  if (cb) cb.checked = false;

  var modal = document.getElementById('up-pelajar-modal');
  modal.style.display = 'flex'; modal.classList.add('open');
}

function closeUploadPelajarModal() {
  var modal = document.getElementById('up-pelajar-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
  _uploadPelajarRows = [];
}

async function confirmUploadPelajar() {
  if (!_uploadPelajarRows.length) return;
  var includeConflicts = document.getElementById('up-pelajar-conflict-cb').checked;
  var btn = document.getElementById('up-pelajar-confirm-btn');
  btn.disabled = true; btn.textContent = 'Memproses...';

  var success = 0, skipped = 0, errors = 0;
  for (var i = 0; i < _uploadPelajarRows.length; i++) {
    var r = _uploadPelajarRows[i];
    if (r._status === 'konflik' && !includeConflicts) { skipped++; continue; }
    var resp = await sb.from('students').upsert({
      matric_no: r.matric_no, name: r.name, kursus: r.kursus
    }, { onConflict: 'matric_no' });
    if (resp.error) { errors++; } else { success++; }
  }

  btn.disabled = false; btn.textContent = 'Sahkan Upload';
  closeUploadPelajarModal();
  var msg = 'Upload selesai: ' + success + ' berjaya';
  if (skipped) msg += ', ' + skipped + ' dilangkau';
  if (errors)  msg += ', ' + errors + ' gagal';
  alert(msg + '.');
  loadUruspelajar();
}
// ===== END UPLOAD PELAJAR =====

// ===== URUS PELAJAR =====
var _pensyarahList = [];
var _pelajarStudentsCache = [];

async function loadUruspelajar() {
  var tbody = document.getElementById('pelajar-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:1.5rem">Memuatkan...</td></tr>';

  var prResp = await sb.from('users').select('full_name, email').contains('roles', ['PENSYARAH']).order('full_name');
  _pensyarahList = prResp.data || [];

  var bulkSel = document.getElementById('bulk-svf-select');
  if (bulkSel) {
    bulkSel.innerHTML = '<option value="">-- Pilih SVF (Bulk Assign) --</option>';
    _pensyarahList.forEach(function(p) {
      bulkSel.innerHTML += '<option value="' + escHtml(p.email) + '">' + escHtml(p.full_name) + '</option>';
    });
  }

  var pensyarahMap = {};
  _pensyarahList.forEach(function(p) { pensyarahMap[p.email] = p.full_name; });

  var session = getSession();
  var eff = getEffectiveRole(session ? session.roles : []);
  var query = sb.from('students').select('id, matric_no, name, kursus, svf_email, approval_status').order('name');
  if (eff === 'PENSYARAH' && session) {
    query = query.eq('svf_email', session.email);
  }
  var stResp = await query;
  if (stResp.error) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:red;padding:1.5rem">Ralat memuatkan data.</td></tr>';
    return;
  }
  var students = stResp.data || [];

  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:1.5rem">Tiada pelajar. Muat naik senarai pelajar terlebih dahulu.</td></tr>';
    return;
  }

  var showDelete = (eff === 'ADMIN' || eff === 'AJK_LI');
  _pelajarStudentsCache = students;
  var html = '';
  students.forEach(function(s, i) {
    var assignedName = s.svf_email ? (pensyarahMap[s.svf_email] || s.svf_email) : null;
    var svfBadge = assignedName
      ? '<span class="status-badge status-active">' + escHtml(assignedName) + '</span>'
      : '<span class="belum-assign-badge">Belum Assign</span>';

    var opts = '<option value="">-- Nyahaktif SVF --</option>';
    _pensyarahList.forEach(function(p) {
      opts += '<option value="' + escHtml(p.email) + '"' +
              (s.svf_email === p.email ? ' selected' : '') + '>' +
              escHtml(p.full_name) + '</option>';
    });

    var mid = escHtml(s.matric_no);
    var sname = escHtml(s.name || '');
    var apSt = s.approval_status || 'draft';
    var approvalBadge;
    if (apSt === 'approved') {
      approvalBadge = '<span class="approval-badge-approved" style="font-size:11px;padding:2px 9px">&#10003; Diluluskan</span>';
    } else if (apSt === 'submitted') {
      approvalBadge = '<span class="approval-badge-submitted" style="font-size:11px;padding:2px 9px">Menunggu Kelulusan</span>';
    } else {
      approvalBadge = '<span class="approval-badge-draft" style="font-size:11px;padding:2px 9px">Draf</span>';
    }
    var actionBtns = showDelete
      ? '<button class="btn-sm btn-sm-edit" onclick="openEditPelajarModal(' + i + ')" style="margin-right:4px">Edit</button>' +
        '<button class="btn-sm btn-sm-del" onclick="deleteStudent(\'' + mid + '\',\'' + sname.replace(/'/g, "\\'") + '\')">Padam</button>'
      : '';
    html += '<tr>' +
      '<td style="text-align:center"><input type="checkbox" class="student-checkbox" value="' + mid + '"></td>' +
      '<td>' + mid + '</td>' +
      '<td>' + sname + '</td>' +
      '<td style="font-size:12.5px">' + escHtml(s.kursus || '') + '</td>' +
      '<td>' + svfBadge + '</td>' +
      '<td>' + approvalBadge + '</td>' +
      '<td><select class="svf-assign-select" onchange="assignSVF(\'' + mid + '\',this.value)" style="font-size:12px;padding:4px 6px;border:var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);font-family:inherit;max-width:220px">' + opts + '</select></td>' +
      '<td>' + actionBtns + '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;

  var selectAll = document.getElementById('select-all-students');
  if (selectAll) selectAll.checked = false;
}

function toggleAllStudents(cb) {
  document.querySelectorAll('.student-checkbox').forEach(function(c) { c.checked = cb.checked; });
}

async function assignSVF(matricNo, svfEmail) {
  await sb.from('students').update({ svf_email: svfEmail || null }).eq('matric_no', matricNo);
  loadUruspelajar();
}

async function bulkAssignSVF() {
  var svfEmail = document.getElementById('bulk-svf-select').value;
  if (!svfEmail) { alert('Sila pilih SVF terlebih dahulu.'); return; }
  var checked = document.querySelectorAll('.student-checkbox:checked');
  if (!checked.length) { alert('Tiada pelajar dipilih.'); return; }
  var matricNos = Array.from(checked).map(function(cb) { return cb.value; });
  await Promise.all(matricNos.map(function(m) {
    return sb.from('students').update({ svf_email: svfEmail }).eq('matric_no', m);
  }));
  loadUruspelajar();
}
function openEditPelajarModal(idx) {
  var s = _pelajarStudentsCache[idx];
  if (!s) return;
  document.getElementById('edp-id').value = s.id;
  document.getElementById('edp-name').value = s.name || '';
  document.getElementById('edp-matric').value = s.matric_no || '';
  var kursusEl = document.getElementById('edp-kursus');
  if (kursusEl) { kursusEl.value = s.kursus || ''; }
  document.getElementById('edp-error').style.display = 'none';
  document.getElementById('edp-error').textContent = '';
  var modal = document.getElementById('edit-pelajar-modal');
  modal.style.display = 'flex'; modal.classList.add('open');
}

function closeEditPelajarModal() {
  var modal = document.getElementById('edit-pelajar-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
}

async function saveEditPelajar() {
  var id     = document.getElementById('edp-id').value;
  var name   = document.getElementById('edp-name').value.trim();
  var matric = document.getElementById('edp-matric').value.trim();
  var kursus = document.getElementById('edp-kursus').value;
  var errEl  = document.getElementById('edp-error');
  var btn    = document.getElementById('edp-save-btn');

  errEl.style.display = 'none';
  if (!name || !matric || !kursus) {
    errEl.textContent = 'Sila isi semua medan.'; errEl.style.display = 'block'; return;
  }

  btn.disabled = true; btn.textContent = 'Menyimpan...';
  var resp = await sb.from('students').update({ name: name, matric_no: matric, kursus: kursus }).eq('id', id);
  btn.disabled = false; btn.textContent = 'Simpan Perubahan';

  if (resp.error) {
    errEl.textContent = 'Ralat: ' + resp.error.message; errEl.style.display = 'block'; return;
  }

  closeEditPelajarModal();
  loadUruspelajar();
}
// ===== END URUS PELAJAR =====

// ===== URUS PENSYARAH =====
var _allPensyarahRows = [];

async function loadUruspensyarah() {
  var tbody = document.getElementById('pensyarah-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1.5rem">Memuatkan...</td></tr>';

  var resp = await sb.from('users').select('full_name, no_staf, jabatan, email, is_active, roles')
    .contains('roles', ['PENSYARAH']).order('full_name');
  if (resp.error) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;padding:1.5rem">Ralat memuatkan data.</td></tr>';
    return;
  }
  _allPensyarahRows = resp.data || [];

  var filterEl = document.getElementById('pensyarah-filter');
  if (filterEl) filterEl.value = '';
  renderPensyarahTable(_allPensyarahRows);
}

function filterPensyarah() {
  var q = (document.getElementById('pensyarah-filter').value || '').toLowerCase().trim();
  if (!q) { renderPensyarahTable(_allPensyarahRows); return; }
  renderPensyarahTable(_allPensyarahRows.filter(function(p) {
    return (p.full_name || '').toLowerCase().indexOf(q) !== -1 ||
           (p.jabatan   || '').toLowerCase().indexOf(q) !== -1;
  }));
}

function renderPensyarahTable(rows) {
  var tbody = document.getElementById('pensyarah-tbody');
  if (!tbody) return;
  var session = getSession();
  var eff = getEffectiveRole(session ? session.roles : []);
  var isAdmin = (eff === 'ADMIN');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1.5rem">Tiada pensyarah.</td></tr>';
    return;
  }
  var html = '';
  rows.forEach(function(u) {
    var isActive = u.is_active !== false;
    var eid = escHtml(u.email);
    var isSelf = session && u.email.toLowerCase() === session.email.toLowerCase();
    var padamBtn = (isAdmin && !isSelf)
      ? '<button class="btn-sm btn-sm-del" onclick="deletePensyarah(\'' + eid + '\',\'' + escHtml(u.full_name || '').replace(/'/g, "\\'") + '\')">Padam</button>'
      : '';
    html += '<tr>' +
      '<td>' + escHtml(u.full_name || '') + '</td>' +
      '<td>' + escHtml(u.no_staf || '') + '</td>' +
      '<td>' + escHtml(u.jabatan || '') + '</td>' +
      '<td style="font-size:12px">' + eid + '</td>' +
      '<td><span class="status-badge ' + (isActive ? 'status-active' : 'status-inactive') + '">' + (isActive ? 'Aktif' : 'Tidak Aktif') + '</span></td>' +
      '<td><div class="um-actions">' +
        '<button class="btn-sm btn-sm-edit" onclick="openEpModal(\'' + eid + '\')">Edit</button>' +
        '<button class="btn-sm btn-sm-reset" onclick="openPwModal(\'' + eid + '\')">Reset PW</button>' +
        padamBtn +
      '</div></td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
}

async function openEpModal(email) {
  var resp = await sb.from('users').select('*').eq('email', email).single();
  if (resp.error || !resp.data) return;
  var u = resp.data;
  document.getElementById('ep-key').value      = u.email;
  document.getElementById('ep-name').value     = u.full_name || '';
  document.getElementById('ep-nostaf').value   = u.no_staf || '';
  document.getElementById('ep-jabatan').value  = u.jabatan || '';
  document.getElementById('ep-email').value    = u.email;
  document.getElementById('ep-active').checked = u.is_active !== false;
  document.getElementById('ep-error').style.display = 'none';
  var modal = document.getElementById('ep-modal');
  modal.style.display = 'flex'; modal.classList.add('open');
}

function closeEpModal() {
  var modal = document.getElementById('ep-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
}

async function saveEpModal() {
  var origEmail = document.getElementById('ep-key').value;
  var name      = document.getElementById('ep-name').value.trim();
  var noStaf    = document.getElementById('ep-nostaf').value.trim();
  var jabatan   = document.getElementById('ep-jabatan').value.trim();
  var email     = document.getElementById('ep-email').value.trim().toLowerCase();
  var isActive  = document.getElementById('ep-active').checked;
  var errEl     = document.getElementById('ep-error');
  errEl.style.display = 'none';

  if (!name || !email) {
    errEl.textContent = 'Nama dan e-mel diperlukan.'; errEl.style.display = 'block'; return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Format e-mel tidak sah.'; errEl.style.display = 'block'; return;
  }
  var resp = await sb.from('users').update({
    full_name: name, no_staf: noStaf, jabatan: jabatan, email: email, is_active: isActive
  }).eq('email', origEmail);
  if (resp.error) {
    errEl.textContent = resp.error.code === '23505' ? 'E-mel sudah digunakan.' : 'Ralat: ' + resp.error.message;
    errEl.style.display = 'block'; return;
  }
  closeEpModal();
  loadUruspensyarah();
}
// ===== END URUS PENSYARAH =====

// ===== TAMBAH PENSYARAH MANUAL =====
function openAddPensyarahModal() {
  document.getElementById('ap-name').value    = '';
  document.getElementById('ap-nostaf').value  = '';
  document.getElementById('ap-jabatan').value = '';
  document.getElementById('ap-email').value   = '';
  document.getElementById('ap-pw').value      = '';
  document.getElementById('ap-error').style.display   = 'none';
  document.getElementById('ap-success').style.display = 'none';
  var modal = document.getElementById('add-pensyarah-modal');
  modal.style.display = 'flex'; modal.classList.add('open');
}

function closeAddPensyarahModal() {
  var modal = document.getElementById('add-pensyarah-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
}

async function saveAddPensyarah() {
  var name    = document.getElementById('ap-name').value.trim();
  var noStaf  = document.getElementById('ap-nostaf').value.trim();
  var jabatan = document.getElementById('ap-jabatan').value.trim();
  var email   = document.getElementById('ap-email').value.trim().toLowerCase();
  var pw      = document.getElementById('ap-pw').value || 'utem1234';
  var errEl   = document.getElementById('ap-error');
  var sucEl   = document.getElementById('ap-success');
  errEl.style.display = 'none'; sucEl.style.display = 'none';

  if (!name || !noStaf || !jabatan || !email) {
    errEl.textContent = 'Sila isi semua medan yang diperlukan.'; errEl.style.display = 'block'; return;
  }
  if (!email.endsWith('@utem.edu.my')) {
    errEl.textContent = 'E-mel mesti berakhir dengan @utem.edu.my.'; errEl.style.display = 'block'; return;
  }

  var pwHash = await hashPassword(pw);
  var resp = await sb.from('users').insert({
    full_name: name, no_staf: noStaf, jabatan: jabatan,
    email: email, password_hash: pwHash, roles: ['PENSYARAH'], is_active: true
  });
  if (resp.error) {
    errEl.textContent = resp.error.code === '23505' ? 'E-mel sudah digunakan.' : 'Ralat: ' + resp.error.message;
    errEl.style.display = 'block'; return;
  }
  sucEl.textContent = 'Pensyarah ' + name + ' berjaya ditambah.';
  sucEl.style.display = 'block';
  document.getElementById('ap-name').value    = '';
  document.getElementById('ap-nostaf').value  = '';
  document.getElementById('ap-jabatan').value = '';
  document.getElementById('ap-email').value   = '';
  document.getElementById('ap-pw').value      = '';
  loadUruspensyarah();
}
// ===== END TAMBAH PENSYARAH MANUAL =====

// ===== TAMBAH PELAJAR MANUAL =====
function openAddPelajarModal() {
  document.getElementById('adp-name').value   = '';
  document.getElementById('adp-matric').value = '';
  document.getElementById('adp-kursus').value = '';
  document.getElementById('adp-error').style.display   = 'none';
  document.getElementById('adp-success').style.display = 'none';
  var modal = document.getElementById('add-pelajar-modal');
  modal.style.display = 'flex'; modal.classList.add('open');
}

function closeAddPelajarModal() {
  var modal = document.getElementById('add-pelajar-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
}

async function saveAddPelajar() {
  var name    = document.getElementById('adp-name').value.trim();
  var matric  = document.getElementById('adp-matric').value.trim();
  var kursus  = document.getElementById('adp-kursus').value;
  var errEl   = document.getElementById('adp-error');
  var sucEl   = document.getElementById('adp-success');
  errEl.style.display = 'none'; sucEl.style.display = 'none';

  if (!name || !matric || !kursus) {
    errEl.textContent = 'Sila isi semua medan yang diperlukan.'; errEl.style.display = 'block'; return;
  }

  var resp = await sb.from('students').insert({ name: name, matric_no: matric, kursus: kursus });
  if (resp.error) {
    errEl.textContent = resp.error.code === '23505' ? 'No Matrik sudah wujud.' : 'Ralat: ' + resp.error.message;
    errEl.style.display = 'block'; return;
  }
  sucEl.textContent = 'Pelajar ' + name + ' berjaya ditambah.';
  sucEl.style.display = 'block';
  document.getElementById('adp-name').value   = '';
  document.getElementById('adp-matric').value = '';
  document.getElementById('adp-kursus').value = '';
  loadUruspelajar();
}
// ===== END TAMBAH PELAJAR MANUAL =====

// ===== DELETE STUDENT =====
async function deleteStudent(matricNo, name) {
  var msg = 'Adakah anda pasti mahu memadam pelajar ' + name + ' (' + matricNo + ')?\nSemua data markah berkaitan akan turut dipadam.';
  if (!confirm(msg)) return;

  // Get student id first
  var sResp = await sb.from('students').select('id').eq('matric_no', matricNo).single();
  if (sResp.error || !sResp.data) { alert('Pelajar tidak dijumpai.'); return; }
  var studentId = sResp.data.id;

  // Delete marks first, then student
  await sb.from('marks').delete().eq('student_id', studentId);
  var dResp = await sb.from('students').delete().eq('matric_no', matricNo);
  if (dResp.error) { alert('Ralat memadam pelajar: ' + dResp.error.message); return; }
  loadUruspelajar();
}
// ===== END DELETE STUDENT =====

// ===== DELETE PENSYARAH =====
async function deletePensyarah(email, name) {
  // Check if pensyarah has students assigned
  var cResp = await sb.from('students').select('id', { count: 'exact', head: true }).eq('svf_email', email);
  var count = cResp.count || 0;

  var confirmed = false;
  if (count > 0) {
    confirmed = confirm(
      'Pensyarah ini masih mempunyai ' + count + ' pelajar assigned.\nPadam & Auto-Unassign semua pelajar berkaitan?\n\nKlik OK untuk "Padam & Auto-Unassign" atau Batal untuk membatalkan.'
    );
  } else {
    confirmed = confirm('Adakah anda pasti mahu memadam pensyarah ' + name + ' (' + email + ')?');
  }
  if (!confirmed) return;

  // Unassign students if any
  if (count > 0) {
    await sb.from('students').update({ svf_email: null }).eq('svf_email', email);
  }
  var dResp = await sb.from('users').delete().eq('email', email);
  if (dResp.error) { alert('Ralat memadam pensyarah: ' + dResp.error.message); return; }
  loadUruspensyarah();
}
// ===== END DELETE PENSYARAH =====

// ===== DASHBOARD =====
async function loadDashboard() {
  var session = getSession();
  if (!session) return;
  // Clear any stale pending student eval so the profile modal cannot fire on dashboard load
  _pendingStudentEval = null;
  var eff = getEffectiveRole(session.roles);

  document.getElementById('dash-admin').style.display     = (eff === 'ADMIN')                    ? 'block' : 'none';
  document.getElementById('dash-ajkli').style.display     = (eff === 'AJK_LI' || eff === 'ADMIN') ? 'block' : 'none';
  document.getElementById('dash-pensyarah').style.display = (eff === 'PENSYARAH')                 ? 'block' : 'none';

  if (eff === 'ADMIN')      { renderAdminDashboard(); loadAjkliDashboard(); }
  else if (eff === 'AJK_LI')    loadAjkliDashboard();
  else if (eff === 'PENSYARAH') loadPensyarahDashboard();
}

function updateStatCard(id, val, sub) {
  var card = document.getElementById(id);
  if (!card) return;
  card.querySelector('.stat-val').textContent = val;
  var subEl = card.querySelector('.stat-sub');
  if (subEl) subEl.textContent = sub;
}

async function renderAdminDashboard() {
  try {
    var results = await Promise.all([
      sb.from('students').select('id, svf_email'),
      sb.from('users').select('id', { count: 'exact', head: true }).contains('roles', ['PENSYARAH']),
      sb.from('marks').select('student_id, evaluator_email, section, data')
    ]);
    var stData   = results[0].data || [];
    var psCount  = results[1].count || 0;
    var mrData   = results[2].data || [];

    var totalPelajar = stData.length;
    var belumAssign  = stData.filter(function(s) { return !s.svf_email; }).length;

    // Build svf_email lookup keyed by student id for deterministic completion check
    var svfByStudentId = {};
    stData.forEach(function(s) { svfByStudentId[s.id] = s.svf_email || null; });

    // Only count marks from the assigned SVF evaluator per student so the completion
    // status is deterministic even when multiple evaluator rows exist for the same section.
    // Accept marks where evaluator_email is null/empty (legacy records) as a safe fallback.
    var marksDataByStudent = {};
    mrData.forEach(function(m) {
      var svfEmail = svfByStudentId[m.student_id];
      // Skip only when: student has SVF assigned AND mark has a non-null evaluator AND it doesn't match
      if (svfEmail && m.evaluator_email && m.evaluator_email !== svfEmail) return;
      if (!marksDataByStudent[m.student_id]) marksDataByStudent[m.student_id] = {};
      marksDataByStudent[m.student_id][m.section] = m.data;
    });
    var lengkap = stData.filter(function(s) {
      return isStudentComplete(marksDataByStudent[s.id] || {});
    }).length;

    updateStatCard('dsc-total-pelajar',   totalPelajar, 'pelajar berdaftar');
    updateStatCard('dsc-total-pensyarah', psCount,      'pensyarah dalam sistem');
    updateStatCard('dsc-lengkap',         lengkap,      'semua bahagian diisi');
    updateStatCard('dsc-belum-assign',    belumAssign,  'belum ada SVF');
  } catch (err) {
    console.error('renderAdminDashboard error:', err);
  }
}

function renderDashboardCharts(students, marksDataByStudent) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded yet, retrying in 300ms');
    setTimeout(function() { renderDashboardCharts(students, marksDataByStudent); }, 300);
    return;
  }

  // Use hardcoded colors — CSS variable reads can return empty string in some browsers
  var green = '#0a7c4e';
  var red   = '#c0392b';
  var amber = '#b45309';
  var grey  = '#9ca3af';

  // Chart 1 — Status Penilaian (Lengkap vs Belum Lengkap)
  var lengkap = students.filter(function(s) { return s._lengkap; }).length;
  var belum   = students.length - lengkap;
  var canv1 = document.getElementById('chart-completion');
  if (canv1) {
    if (_chartCompletion) { _chartCompletion.destroy(); }
    _chartCompletion = new Chart(canv1, {
      type: 'doughnut',
      data: {
        labels: ['Lengkap', 'Belum Lengkap'],
        datasets: [{ data: [lengkap, belum], backgroundColor: [green, red], borderWidth: 2 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 } } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + ctx.raw; } } }
        }
      }
    });
  }

  // Chart 2 — Status Kelulusan (by approval_status)
  var approved  = students.filter(function(s) { return s.approval_status === 'approved'; }).length;
  var submitted = students.filter(function(s) { return s.approval_status === 'submitted'; }).length;
  var draft     = students.filter(function(s) { return !s.approval_status || s.approval_status === 'draft'; }).length;
  var canv2 = document.getElementById('chart-approval');
  if (canv2) {
    if (_chartApproval) { _chartApproval.destroy(); }
    _chartApproval = new Chart(canv2, {
      type: 'doughnut',
      data: {
        labels: ['Diluluskan', 'Menunggu Kelulusan', 'Draf'],
        datasets: [{ data: [approved, submitted, draft], backgroundColor: [green, amber, grey], borderWidth: 2 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 } } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + ctx.raw; } } }
        }
      }
    });
  }

  // Chart 3 — Agihan Program (by kursus)
  var programCounts = {};
  students.forEach(function(s) {
    var k = s.kursus || 'Lain-lain';
    programCounts[k] = (programCounts[k] || 0) + 1;
  });
  var programLabels = Object.keys(programCounts);
  var programData   = programLabels.map(function(k) { return programCounts[k]; });
  var palette = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#06b6d4','#ec4899','#f97316'];
  var programColors = programLabels.map(function(_, i) { return palette[i % palette.length]; });
  var canv3 = document.getElementById('chart-program');
  if (canv3) {
    if (_chartProgram) { _chartProgram.destroy(); }
    _chartProgram = new Chart(canv3, {
      type: 'doughnut',
      data: {
        labels: programLabels,
        datasets: [{ data: programData, backgroundColor: programColors, borderWidth: 2 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 } } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + ctx.raw; } } }
        }
      }
    });
  }

  // Chart 4 — Status Assign SVF
  var dahAssign  = students.filter(function(s) { return s.svf_email && s.svf_email.trim() !== ''; }).length;
  var belumAssign = students.length - dahAssign;
  var canv4 = document.getElementById('chart-svf');
  if (canv4) {
    if (_chartSvf) { _chartSvf.destroy(); }
    _chartSvf = new Chart(canv4, {
      type: 'doughnut',
      data: {
        labels: ['Dah Assign', 'Belum Assign'],
        datasets: [{ data: [dahAssign, belumAssign], backgroundColor: ['#1a56db', red], borderWidth: 2 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 } } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + ctx.raw; } } }
        }
      }
    });
  }
}

function renderPensyarahSectionPills(students, marksDataByStudent) {
  var container = document.getElementById('pensyarah-section-pills');
  if (!container) return;
  console.log('[pills] students:', students.length, 'marksKeys:', Object.keys(marksDataByStudent).length);
  var sections = [
    { key: 'svi',          label: 'SVI' },
    { key: 'svf',          label: 'SVF' },
    { key: 'logbook',      label: 'Logbook' },
    { key: 'presentation', label: 'Pembentangan' },
    { key: 'report',       label: 'Laporan' }
  ];
  var total = students.length;
  var html = '';
  sections.forEach(function(sec) {
    var count = students.filter(function(s) {
      var sData = marksDataByStudent[s.id] && marksDataByStudent[s.id][sec.key];
      // confirmed may be boolean true or string "true" depending on Supabase jsonb deserialization
      return sData && (sData.confirmed === true || sData.confirmed === 'true');
    }).length;
    var cls = count > 0 ? 'pensyarah-section-pill pill-done' : 'pensyarah-section-pill pill-pending';
    html += '<span class="' + cls + '">' + escHtml(sec.label) + ' ' + count + '/' + total + ' pelajar</span>';
  });
  container.innerHTML = html;
}

async function loadAjkliDashboard() {
  try {
    var results = await Promise.all([
      sb.from('users').select('full_name, email').contains('roles', ['PENSYARAH']).order('full_name'),
      sb.from('students').select('id, matric_no, name, kursus, svf_email, svf_name, approval_status').order('name'),
      sb.from('marks').select('student_id, evaluator_email, section, data')
    ]);
    var pensyarahList = results[0].data || [];
    _ajkliStudents    = results[1].data || [];
    var mrData        = results[2].data || [];

    _ajkliPensyarahMap = {};
    pensyarahList.forEach(function(p) { _ajkliPensyarahMap[p.email] = p.full_name; });

    // Build svf_email lookup keyed by student id for deterministic completion check
    var svfByStudentId = {};
    _ajkliStudents.forEach(function(s) { svfByStudentId[s.id] = s.svf_email || null; });

    // Only count marks from the assigned SVF evaluator per student so the completion
    // status is deterministic even when multiple evaluator rows exist for the same section.
    // Accept marks where evaluator_email is null/empty (legacy records) as a safe fallback.
    var marksDataByStudent = {};
    mrData.forEach(function(m) {
      var svfEmail = svfByStudentId[m.student_id];
      // Skip only when: student has SVF assigned AND mark has a non-null evaluator AND it doesn't match
      if (svfEmail && m.evaluator_email && m.evaluator_email !== svfEmail) return;
      if (!marksDataByStudent[m.student_id]) marksDataByStudent[m.student_id] = {};
      marksDataByStudent[m.student_id][m.section] = m.data;
    });
    _ajkliStudents.forEach(function(s) {
      // Safety: marksDataByStudent[s.id] may be undefined if student has no marks yet — default to {}
      s._lengkap = isStudentComplete(marksDataByStudent[s.id] || {});
    });

    renderDashboardCharts(_ajkliStudents, marksDataByStudent);
  } catch (err) {
    console.error('loadAjkliDashboard error:', err);
  }
}

// ===== SENARAI PELAJAR =====

async function loadSenarai() {
  var tbody = document.getElementById('senarai-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text3)">Memuatkan...</td></tr>';
  try {
    var results = await Promise.all([
      sb.from('students').select('id, matric_no, name, kursus, svf_email, svf_name, approval_status').order('name'),
      sb.from('users').select('full_name, email').contains('roles', ['PENSYARAH']).order('full_name'),
      sb.from('marks').select('student_id, evaluator_email, section, data')
    ]);
    var students = results[0].data || [];
    var pensyarahList = results[1].data || [];
    var mrData = results[2].data || [];

    _senaraiPensyarahMap = {};
    pensyarahList.forEach(function(p) { _senaraiPensyarahMap[p.email] = p.full_name; });

    var filterEl = document.getElementById('senarai-filter-pensyarah');
    if (filterEl) {
      filterEl.innerHTML = '<option value="">Semua Pensyarah</option>';
      pensyarahList.forEach(function(p) {
        filterEl.innerHTML += '<option value="' + escHtml(p.email) + '">' + escHtml(p.full_name) + '</option>';
      });
    }

    var svfByStudentId = {};
    students.forEach(function(s) { svfByStudentId[s.id] = s.svf_email || null; });

    var marksDataByStudent = {};
    mrData.forEach(function(m) {
      var svfEmail = svfByStudentId[m.student_id];
      if (svfEmail && m.evaluator_email && m.evaluator_email !== svfEmail) return;
      if (!marksDataByStudent[m.student_id]) marksDataByStudent[m.student_id] = {};
      marksDataByStudent[m.student_id][m.section] = m.data;
    });
    students.forEach(function(s) {
      s._lengkap = isStudentComplete(marksDataByStudent[s.id] || {});
    });

    _senaraiStudents = students;

    var programFilterEl = document.getElementById('senarai-filter-program');
    if (programFilterEl) {
      var programs = Array.from(new Set(
        _senaraiStudents
          .map(function(s) { return s.kursus; })
          .filter(function(k) { return k && k.trim() !== ''; })
      )).sort();
      programFilterEl.innerHTML = '<option value="">Semua Program</option>';
      programs.forEach(function(p) {
        programFilterEl.innerHTML += '<option value="' + escHtml(p) + '">' + escHtml(p) + '</option>';
      });
    }

    filterSenarai();
  } catch (err) {
    console.error('loadSenarai error:', err);
    var tbody2 = document.getElementById('senarai-tbody');
    if (tbody2) tbody2.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:red">Ralat memuatkan data. Sila muat semula halaman.</td></tr>';
  }
}

function filterSenarai() {
  var pFilter = (document.getElementById('senarai-filter-pensyarah') || {}).value || '';
  var prFilter = (document.getElementById('senarai-filter-program') || {}).value || '';
  var mFilter = (document.getElementById('senarai-filter-markah') || {}).value || '';
  var kFilter = (document.getElementById('senarai-filter-kelulusan') || {}).value || '';
  _senaraiFiltered = _senaraiStudents.filter(function(s) {
    if (pFilter && s.svf_email !== pFilter) return false;
    if (prFilter && (s.kursus || '').indexOf(prFilter) === -1) return false;
    if (mFilter === 'lengkap' && !s._lengkap) return false;
    if (mFilter === 'belum' && s._lengkap) return false;
    if (kFilter && (s.approval_status || 'draft') !== kFilter) return false;
    return true;
  });
  _senaraiPage = 1;
  var sumEl = document.getElementById('senarai-summary');
  if (sumEl) sumEl.textContent = 'Menunjukkan ' + _senaraiFiltered.length + ' daripada ' + _senaraiStudents.length + ' pelajar';
  renderSenaraiTable();
}

function renderSenaraiTable() {
  var tbody = document.getElementById('senarai-tbody');
  if (!tbody) return;
  if (!_senaraiFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text3)">Tiada pelajar.</td></tr>';
    renderSenaraiPagination();
    return;
  }
  var start = (_senaraiPage - 1) * _senaraiPageSize;
  var page = _senaraiFiltered.slice(start, start + _senaraiPageSize);
  var html = '';
  page.forEach(function(s) {
    var svfName = s.svf_name || (s.svf_email ? (_senaraiPensyarahMap[s.svf_email] || s.svf_email) : '—');
    var markahBadge = s._lengkap
      ? '<span class="status-badge status-active">Lengkap</span>'
      : '<span class="status-badge status-inactive">Belum Lengkap</span>';
    var status = s.approval_status || 'draft';
    var kelulusanBadge = status === 'approved'
      ? '<span class="approval-badge-approved">&#10003; Diluluskan</span>'
      : status === 'submitted'
        ? '<span class="approval-badge-submitted">Menunggu Kelulusan</span>'
        : '<span class="approval-badge-draft">Draf</span>';
    var globalIdx = _senaraiStudents.indexOf(s);
    html += '<tr class="dash-row-clickable" onclick="openStudentEval(_senaraiStudents[' + globalIdx + '])">' +
      '<td>' + escHtml(s.matric_no) + '</td>' +
      '<td>' + escHtml(s.name || '') + '</td>' +
      '<td style="font-size:12.5px">' + escHtml(s.kursus || '') + '</td>' +
      '<td style="font-size:12.5px">' + escHtml(svfName) + '</td>' +
      '<td>' + markahBadge + '</td>' +
      '<td>' + kelulusanBadge + '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
  renderSenaraiPagination();
}

function renderSenaraiPagination() {
  var el = document.getElementById('senarai-pagination');
  if (!el) return;
  var total = _senaraiFiltered.length;
  var totalPages = Math.max(1, Math.ceil(total / _senaraiPageSize));
  if (totalPages <= 1 && total === 0) { el.innerHTML = ''; return; }
  var prevDisabled = _senaraiPage <= 1 ? ' disabled' : '';
  var nextDisabled = _senaraiPage >= totalPages ? ' disabled' : '';
  el.innerHTML =
    '<button class="btn-secondary"' + prevDisabled + ' onclick="_senaraiPage--;renderSenaraiTable()">&lsaquo; Prev</button>' +
    '<span>Halaman ' + _senaraiPage + ' / ' + totalPages + '</span>' +
    '<button class="btn-secondary"' + nextDisabled + ' onclick="_senaraiPage++;renderSenaraiTable()">Next &rsaquo;</button>' +
    '<span style="color:var(--text3)">' + _senaraiPageSize + ' rekod / halaman</span>';
}

function resetSenaraiFilters() {
  ['senarai-filter-pensyarah', 'senarai-filter-program', 'senarai-filter-markah', 'senarai-filter-kelulusan'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  filterSenarai();
}

// ===== END SENARAI PELAJAR =====

var _pensyarahDashStudents = [];

async function loadPensyarahDashboard() {
  var tbody = document.getElementById('dash-pensyarah-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text3)">Memuatkan...</td></tr>';

  var session = getSession();
  if (!session) return;

  var results = await Promise.all([
    sb.from('students').select('id, matric_no, name, kursus, svf_name, svi_name, organisasi, svf_email')
      .eq('svf_email', session.email).order('name'),
    sb.from('marks').select('student_id, section, data').eq('evaluator_email', session.email)
  ]);
  _pensyarahDashStudents = results[0].data || [];
  var mrData = results[1].data || [];

  var marksDataByStudent = {};
  mrData.forEach(function(m) {
    if (!marksDataByStudent[m.student_id]) marksDataByStudent[m.student_id] = {};
    marksDataByStudent[m.student_id][m.section] = m.data;
  });

  renderPensyarahSectionPills(_pensyarahDashStudents, marksDataByStudent);

  if (!_pensyarahDashStudents.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text3)">Tiada pelajar ditetapkan kepada anda.</td></tr>';
    return;
  }

  var html = '';
  _pensyarahDashStudents.forEach(function(s, i) {
    var lengkap = isStudentComplete(marksDataByStudent[s.id] || {});
    var badge = lengkap
      ? '<span class="status-badge status-active">Lengkap</span>'
      : '<span class="status-badge status-inactive">Belum Lengkap</span>';
    html += '<tr class="dash-row-clickable" onclick="openStudentEval(_pensyarahDashStudents[' + i + '])">' +
      '<td>' + escHtml(s.matric_no) + '</td>' +
      '<td>' + escHtml(s.name || '') + '</td>' +
      '<td style="font-size:12.5px">' + escHtml(s.kursus || '') + '</td>' +
      '<td style="font-size:12.5px">' + escHtml(s.svi_name || '—') + '</td>' +
      '<td style="font-size:12.5px">' + escHtml(s.organisasi || '—') + '</td>' +
      '<td>' + badge + '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
}
// ===== END DASHBOARD =====

// ===== STUDENT EVAL WORKFLOW =====
async function openStudentEval(student) {
  if (!student) return;
  var session = getSession();
  var eff = getEffectiveRole(session ? session.roles : []);

  // Direct Supabase query by id to get fresh svi_name and organisasi
  var freshSviName = student.svi_name || '';
  var freshOrg = student.organisasi || '';
  try {
    var chkResp = await sb.from('students').select('svi_name, organisasi').eq('id', student.id).single();
    if (!chkResp.error && chkResp.data) {
      freshSviName = chkResp.data.svi_name || '';
      freshOrg = chkResp.data.organisasi || '';
    }
  } catch(e) { /* use cached data on error */ }

  // Update the student object with fresh values
  student.svi_name = freshSviName;
  student.organisasi = freshOrg;

  // Update cached local arrays
  for (var _i = 0; _i < _ajkliStudents.length; _i++) {
    if (_ajkliStudents[_i].id === student.id) { _ajkliStudents[_i].svi_name = freshSviName; _ajkliStudents[_i].organisasi = freshOrg; break; }
  }
  for (var _j = 0; _j < _pensyarahDashStudents.length; _j++) {
    if (_pensyarahDashStudents[_j].id === student.id) { _pensyarahDashStudents[_j].svi_name = freshSviName; _pensyarahDashStudents[_j].organisasi = freshOrg; break; }
  }

  // For PENSYARAH and ADMIN: show modal only if svi_name or organisasi is NULL/empty in Supabase
  if ((eff === 'PENSYARAH' || eff === 'ADMIN') && (!freshSviName || !freshOrg)) {
    _pendingStudentEval = student;
    document.getElementById('spm-matric').value = student.matric_no;
    document.getElementById('spm-svi').value = freshSviName;
    document.getElementById('spm-org').value = freshOrg;
    document.getElementById('spm-error').style.display = 'none';
    var modal = document.getElementById('student-profile-modal');
    modal.style.display = 'flex'; modal.classList.add('open');
    return;
  }

  await loadStudentForEval(student);
}

function closeStudentProfileModal() {
  var modal = document.getElementById('student-profile-modal');
  modal.style.display = 'none'; modal.classList.remove('open');
  _pendingStudentEval = null;
}

async function saveStudentProfile() {
  var svi    = document.getElementById('spm-svi').value.trim();
  var org    = document.getElementById('spm-org').value.trim();
  var matric = document.getElementById('spm-matric').value;
  var errEl  = document.getElementById('spm-error');
  var btn    = document.getElementById('spm-save-btn');
  errEl.style.display = 'none';

  if (!svi || !org) {
    errEl.textContent = 'Sila isi semua medan.'; errEl.style.display = 'block'; return;
  }

  btn.disabled = true; btn.textContent = 'Menyimpan...';
  var resp = await sb.from('students').update({ svi_name: svi, organisasi: org }).eq('matric_no', matric);
  btn.disabled = false; btn.textContent = 'Simpan & Teruskan';

  if (resp.error) {
    errEl.textContent = 'Ralat: ' + resp.error.message; errEl.style.display = 'block'; return;
  }

  if (_pendingStudentEval) {
    _pendingStudentEval.svi_name   = svi;
    _pendingStudentEval.organisasi = org;
    // Update ALL local arrays
    for (var _i = 0; _i < _ajkliStudents.length; _i++) {
      if (_ajkliStudents[_i].id === _pendingStudentEval.id) { _ajkliStudents[_i].svi_name = svi; _ajkliStudents[_i].organisasi = org; break; }
    }
    for (var _j = 0; _j < _pensyarahDashStudents.length; _j++) {
      if (_pensyarahDashStudents[_j].id === _pendingStudentEval.id) { _pensyarahDashStudents[_j].svi_name = svi; _pensyarahDashStudents[_j].organisasi = org; break; }
    }
    var pending = _pendingStudentEval;
    closeStudentProfileModal();
    await loadStudentForEval(pending);
  } else {
    closeStudentProfileModal();
  }
}

async function loadStudentForEval(student) {
  var _lsSessionPre = getSession();
  var _lsEffPre = getEffectiveRole(_lsSessionPre ? _lsSessionPre.roles : []);
  // App-layer access guard: PENSYARAH may only open students assigned to them
  if (_lsEffPre === 'PENSYARAH' && _lsSessionPre && student.svf_email !== _lsSessionPre.email) {
    alert('Anda tidak dibenarkan mengakses pelajar ini.');
    return;
  }
  currentStudent   = student;
  currentStudentId = student.id;

  // Determine evaluator email: ADMIN/AJK_LI save under the student's SVF email
  var _lsSession = getSession();
  var _lsEff = getEffectiveRole(_lsSession ? _lsSession.roles : []);
  if (_lsEff === 'PENSYARAH') {
    _currentEvalEmail = _lsSession ? _lsSession.email : null;
  } else {
    _currentEvalEmail = student.svf_email || (_lsSession ? _lsSession.email : null);
  }

  // Reset all confirmation checkboxes before loading new student data
  ['svi', 'svf', 'logbook', 'presentation', 'report'].forEach(function(sec) {
    var cb = document.getElementById(sec + '-confirm-cb');
    if (cb) cb.checked = false;
    updateSimpanBtn(sec);
  });

  // Populate eval student bar
  document.getElementById('esb-nama').textContent   = student.name || '—';
  document.getElementById('esb-matrik').textContent = student.matric_no || '—';
  document.getElementById('esb-kursus').textContent = student.kursus || '—';
  document.getElementById('esb-svf').textContent    = student.svf_name || '—';
  document.getElementById('esb-svi').value = student.svi_name || '';
  document.getElementById('esb-org').value = student.organisasi || '';
  var esbFeedback = document.getElementById('esb-kemaskini-feedback');
  if (esbFeedback) esbFeedback.textContent = '';

  // Show/hide SVI/Org indicator
  var sviOrgEl = document.getElementById('svi-org-indicator');
  if (sviOrgEl) {
    if (student.svi_name && student.organisasi) {
      document.getElementById('svi-indicator-name').textContent = student.svi_name;
      document.getElementById('org-indicator-name').textContent = student.organisasi;
      sviOrgEl.style.display = 'flex';
    } else {
      sviOrgEl.style.display = 'none';
    }
  }

  // Populate info-page fields (for ADMIN/AJK_LI usage)
  _suppressSave = true;
  if (document.getElementById('nama_pelajar')) document.getElementById('nama_pelajar').value = student.name || '';
  if (document.getElementById('no_matrik'))    document.getElementById('no_matrik').value    = student.matric_no || '';
  if (document.getElementById('kursus'))       document.getElementById('kursus').value       = student.kursus || '';
  if (document.getElementById('organisasi'))   document.getElementById('organisasi').value   = student.organisasi || '';
  if (document.getElementById('svf_name'))     document.getElementById('svf_name').value     = student.svf_name || '';
  if (document.getElementById('svi_name'))     document.getElementById('svi_name').value     = student.svi_name || '';
  _suppressSave = false;

  // Reset approval status before loading new student
  _studentApprovalStatus = { status: 'draft', submitted_at: null, approved_at: null, approved_by: null };

  // Load marks for this student
  setSaveStatus('saving');
  try {
    var marksQuery = sb.from('marks').select('section, data').eq('student_id', student.id);
    if (_currentEvalEmail) {
      marksQuery = marksQuery.eq('evaluator_email', _currentEvalEmail);
    }
    var mResp = await marksQuery;
    if (!mResp.error && mResp.data) {
      _suppressSave = true;
      try {
        mResp.data.forEach(function(row) { populateSection(row.section, row.data); });
      } finally {
        _suppressSave = false;
      }
    }

    // Fetch approval status for this student
    var stApprovalResp = await sb.from('students')
      .select('approval_status, submitted_at, approved_at, approved_by')
      .eq('id', student.id)
      .single();
    if (!stApprovalResp.error && stApprovalResp.data) {
      _studentApprovalStatus = {
        status:       stApprovalResp.data.approval_status || 'draft',
        submitted_at: stApprovalResp.data.submitted_at    || null,
        approved_at:  stApprovalResp.data.approved_at     || null,
        approved_by:  stApprovalResp.data.approved_by     || null
      };
    }

    setSaveStatus('saved');

    // Apply lock based on role + approval status
    applyApprovalLock();
    refreshApprovalStatusBar();

    // Load and render audit trail
    var auditRows = await loadAuditTrail(student.id);
    renderAuditTrail(auditRows);
    // Collapse the audit trail panel when loading a new student
    var auditContent = document.getElementById('audit-trail-content');
    var auditBtn = document.getElementById('audit-toggle-btn');
    if (auditContent) auditContent.style.display = 'none';
    if (auditBtn) auditBtn.textContent = 'Lihat Sejarah';
  } catch(e) {
    console.error('loadStudentForEval error:', e);
    setSaveStatus('error');
  }

  showEvalSidebar(student);
  showTab('svi');
}

function goBackToDashboard() {
  // Cancel any pending debounce save so it doesn't fire after navigation
  clearTimeout(saveTimer);
  saveTimer = null;
  currentStudent = null;
  currentStudentId = null;
  _studentApprovalStatus = { status: 'draft', submitted_at: null, approved_at: null, approved_by: null };
  // Hide SVI/Org indicator
  var sviOrgEl = document.getElementById('svi-org-indicator');
  if (sviOrgEl) sviOrgEl.style.display = 'none';
  // Hide approval status bar
  var appBar = document.getElementById('approval-status-bar');
  if (appBar) appBar.style.display = 'none';
  // Reset all confirmation badges
  ['svi', 'svf', 'logbook', 'presentation', 'report'].forEach(function(sec) {
    var badge = document.getElementById(sec + '-confirm-badge');
    if (badge) badge.style.display = 'none';
  });
  // Unlock any locked inputs when navigating away
  applyApprovalLock();
  showDefaultSidebar();
  showTab('dashboard');
}
async function kemaskiniSviOrg() {
  if (!currentStudent) return;
  var sviInput = document.getElementById('esb-svi');
  var orgInput = document.getElementById('esb-org');
  var feedback = document.getElementById('esb-kemaskini-feedback');
  var svi = sviInput ? sviInput.value.trim() : '';
  var org = orgInput ? orgInput.value.trim() : '';

  if (feedback) { feedback.textContent = 'Menyimpan...'; feedback.className = 'esb-kemaskini-feedback'; }
  var resp = await sb.from('students').update({ svi_name: svi, organisasi: org }).eq('id', currentStudent.id);
  if (resp.error) {
    if (feedback) { feedback.textContent = '✗ Ralat'; feedback.className = 'esb-kemaskini-feedback esb-kmk-error'; }
    return;
  }

  currentStudent.svi_name = svi;
  currentStudent.organisasi = org;
  for (var _i = 0; _i < _ajkliStudents.length; _i++) {
    if (_ajkliStudents[_i].id === currentStudent.id) { _ajkliStudents[_i].svi_name = svi; _ajkliStudents[_i].organisasi = org; break; }
  }
  for (var _j = 0; _j < _pensyarahDashStudents.length; _j++) {
    if (_pensyarahDashStudents[_j].id === currentStudent.id) { _pensyarahDashStudents[_j].svi_name = svi; _pensyarahDashStudents[_j].organisasi = org; break; }
  }
  if (document.getElementById('svi_name')) document.getElementById('svi_name').value = svi;
  if (document.getElementById('organisasi')) document.getElementById('organisasi').value = org;

  var sviOrgEl = document.getElementById('svi-org-indicator');
  if (sviOrgEl && svi && org) {
    document.getElementById('svi-indicator-name').textContent = svi;
    document.getElementById('org-indicator-name').textContent = org;
    sviOrgEl.style.display = 'flex';
  } else if (sviOrgEl) {
    sviOrgEl.style.display = 'none';
  }

  if (feedback) {
    feedback.textContent = '✓ Maklumat dikemaskini';
    feedback.className = 'esb-kemaskini-feedback esb-kmk-success';
    setTimeout(function() { if (feedback) feedback.textContent = ''; }, 3000);
  }
}
// ===== AUDIT TRAIL =====

async function loadAuditTrail(studentId) {
  var _auditSession = getSession();
  var _auditEff = getEffectiveRole(_auditSession ? _auditSession.roles : []);
  try {
    var query = sb.from('mark_audit')
      .select('*')
      .eq('student_id', studentId)
      .order('changed_at', { ascending: false });
    // PENSYARAH sees only their own audit entries
    if (_auditEff === 'PENSYARAH' && _auditSession) {
      query = query.eq('changed_by_email', _auditSession.email);
    }
    var resp = await query;
    return (!resp.error && resp.data) ? resp.data : [];
  } catch(e) {
    console.error('loadAuditTrail error:', e);
    return [];
  }
}

var _auditRows = [];

function renderAuditTrail(rows) {
  _auditRows = rows || [];
  var tbody = document.getElementById('audit-trail-body');
  if (!tbody) return;

  var sectionLabels = {
    svi: 'SVI', svf: 'SVF', logbook: 'e-Logbook',
    presentation: 'Pembentangan', report: 'Laporan LI', meta: 'Meta'
  };

  if (!_auditRows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:1rem">Tiada rekod perubahan</td></tr>';
    return;
  }

  tbody.innerHTML = _auditRows.map(function(row) {
    var dt = new Date(row.changed_at);
    var dateStr = dt.toLocaleDateString('ms-MY', { day:'2-digit', month:'2-digit', year:'numeric' })
                + ' ' + dt.toLocaleTimeString('ms-MY', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    var sectionLabel = sectionLabels[row.section] || row.section;
    var oldVal = (row.old_value !== null && row.old_value !== undefined) ? row.old_value : '<em style="color:var(--text2)">—</em>';
    var newVal = (row.new_value !== null && row.new_value !== undefined) ? row.new_value : '<em style="color:var(--text2)">—</em>';
    return '<tr>'
      + '<td style="white-space:nowrap;font-size:12px">' + dateStr + '</td>'
      + '<td><span class="audit-section-badge">' + sectionLabel + '</span></td>'
      + '<td style="font-family:monospace;font-size:12px">' + row.field_key + '</td>'
      + '<td style="color:#dc2626">' + oldVal + '</td>'
      + '<td style="color:#16a34a">' + newVal + '</td>'
      + '<td style="font-size:12px">' + (row.changed_by_email || '—') + '</td>'
      + '</tr>';
  }).join('');
}

function toggleAuditTrail() {
  var content = document.getElementById('audit-trail-content');
  var btn = document.getElementById('audit-toggle-btn');
  if (!content) return;
  var isHidden = content.style.display === 'none' || content.style.display === '';
  content.style.display = isHidden ? '' : 'none';
  if (btn) btn.textContent = isHidden ? 'Sembunyikan Sejarah' : 'Lihat Sejarah';
}

// ===== END AUDIT TRAIL =====

// ===== APPROVAL WORKFLOW =====

function showApprovalToast(msg, type) {
  var existing = document.getElementById('approval-toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.id = 'approval-toast';
  var bg = type === 'success' ? '#065f46' : type === 'warning' ? '#92400e' : '#1e3a8a';
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:' + bg + ';color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:99998;box-shadow:0 4px 20px rgba(0,0,0,.3);max-width:90vw;text-align:center';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
}

function formatApprovalDateTime(isoStr) {
  if (!isoStr) return '—';
  var d = new Date(isoStr);
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' })
       + ' ' + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
}

function countConfirmedSections() {
  return ['svi', 'svf', 'logbook', 'presentation', 'report'].filter(function(sec) {
    return getCbVal(sec + '-confirm-cb');
  }).length;
}

// applyApprovalLock() — disables/enables all mark inputs based on approval status + role.
// PENSYARAH with status 'submitted' or 'approved': all eval inputs disabled.
// AJK_LI / ADMIN: never disabled (function returns early).
// Null-safe: checks elements exist before modifying.
function applyApprovalLock() {
  var session = getSession();
  var eff = getEffectiveRole(session ? session.roles : []);

  // ADMIN and AJK_LI are never locked out
  if (eff === 'ADMIN' || eff === 'AJK_LI') return;

  var status = (_studentApprovalStatus && _studentApprovalStatus.status) || 'draft';
  var shouldLock = (status === 'submitted' || status === 'approved');

  var evalPageIds = ['page-svi', 'page-svf', 'page-logbook', 'page-presentation', 'page-report', 'page-info'];
  evalPageIds.forEach(function(pageId) {
    var page = document.getElementById(pageId);
    if (!page) return;
    var inputs = page.querySelectorAll('input[type=number], input[type=text], input[type=checkbox], input[type=radio], textarea, select');
    inputs.forEach(function(el) {
      el.disabled = shouldLock;
    });
  });
}

// refreshApprovalStatusBar() — renders the approval status section in Ringkasan & Gred.
// Must be called whenever approval status or confirmation state may have changed.
function refreshApprovalStatusBar() {
  var barEl = document.getElementById('approval-status-bar');
  if (!barEl) return;

  if (!currentStudent) {
    barEl.style.display = 'none';
    return;
  }

  var session = getSession();
  var eff = getEffectiveRole(session ? session.roles : []);
  var status = (_studentApprovalStatus && _studentApprovalStatus.status) || 'draft';
  var submittedAt = _studentApprovalStatus ? _studentApprovalStatus.submitted_at : null;
  var approvedAt  = _studentApprovalStatus ? _studentApprovalStatus.approved_at  : null;
  var approvedBy  = _studentApprovalStatus ? _studentApprovalStatus.approved_by  : null;

  var isPensyarah = (eff === 'PENSYARAH');
  var html = '<div class="approval-status-bar">';

  if (status === 'draft') {
    html += '<span class="approval-badge-draft">Draf</span>';
    if (isPensyarah) {
      var confirmed = countConfirmedSections();
      var complete = (confirmed === 5);
      html += '<span class="approval-info">Semua bahagian perlu disahkan sebelum menghantar.</span>';
      html += '<div class="approval-actions">';
      html += '<button class="btn-approve" onclick="submitStudent()"' + (complete ? '' : ' disabled') + '>Hantar untuk Kelulusan</button>';
      html += '<span class="approval-lock-message">' + confirmed + '/5 bahagian telah disahkan</span>';
      html += '</div>';
    } else {
      html += '<span class="approval-info">Markah belum dihantar untuk kelulusan.</span>';
    }
  } else if (status === 'submitted') {
    html += '<span class="approval-badge-submitted">Menunggu Kelulusan</span>';
    html += '<span class="approval-info">Dihantar pada: ' + formatApprovalDateTime(submittedAt) + '</span>';
    if (isPensyarah) {
      html += '<p class="approval-lock-message">Markah anda telah dihantar. Hubungi AJK LI untuk sebarang perubahan.</p>';
    } else {
      html += '<div class="approval-actions">';
      html += '<button class="btn-approve" onclick="approveStudent()">&#10003; Luluskan</button>';
      html += '<button class="btn-unlock-edit" onclick="unlockForEdit()">Edit</button>';
      html += '</div>';
    }
  } else if (status === 'approved') {
    html += '<span class="approval-badge-approved">&#10003; Diluluskan</span>';
    html += '<span class="approval-info">Diluluskan pada: ' + formatApprovalDateTime(approvedAt) + ' &middot; Diluluskan oleh: ' + escHtml(approvedBy || '—') + '</span>';
    if (isPensyarah) {
      html += '<p class="approval-lock-message">Markah telah diluluskan dan dikunci.</p>';
    } else {
      html += '<div class="approval-actions">';
      html += '<button class="btn-unlock-edit" onclick="unlockForEdit()">Edit</button>';
      html += '</div>';
    }
  }

  html += '</div>';
  barEl.innerHTML = html;
  barEl.style.display = 'block';
}

// submitStudent() — PENSYARAH submits marks for approval.
// Requires all 5 sections confirmed. Locks form after submit.
async function submitStudent() {
  var sections = collectSections();
  if (!isStudentComplete(sections)) {
    var unconfirmed = ['svi', 'svf', 'logbook', 'presentation', 'report'].filter(function(sec) {
      return !(sections[sec] && sections[sec].confirmed);
    });
    var labels = { svi: 'Penyelia Industri (SVI)', svf: 'Penyelia Fakulti (SVF)',
                   logbook: 'e-Logbook', presentation: 'Pembentangan', report: 'Laporan LI' };
    alert('Bahagian berikut belum disahkan:\n' + unconfirmed.map(function(s) { return '• ' + labels[s]; }).join('\n'));
    return;
  }
  if (!currentStudentId) { alert('Tiada pelajar dipilih.'); return; }

  var resp = await sb.from('students')
    .update({ approval_status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', currentStudentId);
  if (resp.error) { alert('Ralat menghantar: ' + resp.error.message); return; }

  _studentApprovalStatus.status = 'submitted';
  _studentApprovalStatus.submitted_at = new Date().toISOString();
  applyApprovalLock();
  refreshApprovalStatusBar();
  showApprovalToast('Markah telah dihantar untuk kelulusan.', 'success');
}

// approveStudent() — AJK_LI / ADMIN approves and locks the student's marks.
async function approveStudent() {
  if (!currentStudentId) { alert('Tiada pelajar dipilih.'); return; }
  var session = getSession();
  var now = new Date().toISOString();

  var resp = await sb.from('students')
    .update({ approval_status: 'approved', approved_at: now, approved_by: session ? session.email : '' })
    .eq('id', currentStudentId);
  if (resp.error) { alert('Ralat meluluskan: ' + resp.error.message); return; }

  _studentApprovalStatus.status = 'approved';
  _studentApprovalStatus.approved_at = now;
  _studentApprovalStatus.approved_by = session ? session.email : '';
  applyApprovalLock();
  refreshApprovalStatusBar();
  showApprovalToast('Markah pelajar telah diluluskan dan dikunci.', 'success');

  // Refresh Urus Pelajar list if currently visible
  var upPage = document.getElementById('page-uruspelajar');
  if (upPage && upPage.classList.contains('active')) loadUruspelajar();
}

// unlockForEdit() — AJK_LI / ADMIN resets approval to 'submitted' to allow editing.
async function unlockForEdit() {
  if (!currentStudentId) return;

  var resp = await sb.from('students')
    .update({ approval_status: 'submitted' })
    .eq('id', currentStudentId);
  if (resp.error) { alert('Ralat membuka semula: ' + resp.error.message); return; }

  _studentApprovalStatus.status = 'submitted';
  applyApprovalLock();
  refreshApprovalStatusBar();
  showApprovalToast('Markah dibuka semula untuk pengeditan.', 'info');
}

// ===== END APPROVAL WORKFLOW =====

// ===== END STUDENT EVAL WORKFLOW =====

// ===== PDF GENERATION =====

// Helper: safely set element text content
function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

async function generatePDF(student) {
  var s = student || currentStudent;
  if (!s || !s.id) { alert('Tiada pelajar dipilih.'); return; }

  // Resolve SVF display name from map if svf_name is empty
  var svfDisplayName = s.svf_name || '';
  if (!svfDisplayName && s.svf_email) {
    svfDisplayName = (_ajkliPensyarahMap && _ajkliPensyarahMap[s.svf_email]) ||
      (_senaraiPensyarahMap && _senaraiPensyarahMap[s.svf_email]) ||
      '';
  }
  // If still no name, fetch from Supabase (e.g. navigated directly to eval)
  if (!svfDisplayName && s.svf_email) {
    var uRes = await sb.from('users').select('full_name').eq('email', s.svf_email).single();
    if (uRes.data && uRes.data.full_name) svfDisplayName = uRes.data.full_name;
  }
  if (!svfDisplayName) svfDisplayName = s.svf_email || '—';
  window._pdfSvfName = svfDisplayName;

  // Populate basic student info
  var courseCode = (s.kursus === 'BITE' || s.kursus === 'BITZ')
    ? 'BITU3926' : 'BITU3946';
  setText('pp-course-code', courseCode);
  setText('pp-sesi', s.sesi || '—');
  setText('pp-semester', 'Semester ' + (s.semester || '—'));
  setText('pp-nama', s.name || '—');
  setText('pp-matric', s.matric_no || '—');
  setText('pp-program', s.kursus || '—');
  setText('pp-syarikat', s.organisasi || '—');
  setText('pp-svi', s.svi_name || '—');
  setText('pp-svf', svfDisplayName || '—');
  setText('pp-sig-svi', s.svi_name || '—');
  setText('pp-sig-svf', svfDisplayName || '—');
  setText('pp-footer-date',
    'Dijana: ' + new Date().toLocaleDateString('ms-MY'));

  // Fetch marks from Supabase
  var marksRes = await sb.from('marks')
    .select('section, data, evaluator_email')
    .eq('student_id', s.id);
  var marksRows = marksRes.data || [];

  // Build marks lookup by section — prefer assigned SVF evaluator
  var marksMap = {};
  marksRows.forEach(function(m) {
    if (!marksMap[m.section]) {
      marksMap[m.section] = m.data;
    } else if (s.svf_email && m.evaluator_email === s.svf_email) {
      marksMap[m.section] = m.data;
    }
  });

  // Helper to get integer mark value safely
  function getMark(section, field) {
    var sec = marksMap[section];
    if (!sec) return 0;
    var v = parseInt(sec[field]);
    return isNaN(v) ? 0 : v;
  }

  // Read totals and grades directly from calcSummary() DOM output
  var total3926 = parseFloat(
    document.getElementById('sum_3926_total')?.textContent || '0') || 0;
  var grade3926 = document.getElementById('sum_3926_grade')?.textContent || '—';

  var total3946 = parseFloat(
    document.getElementById('sum_3946_total')?.textContent || '0') || 0;
  var grade3946 = document.getElementById('sum_3946_grade')?.textContent || '—';

  // Ratings from marksMap (stored without section prefix)
  var sviRating = (marksMap['svi'] || {})['rating'] || '—';
  var svfRating = (marksMap['svf'] || {})['rating'] || '—';
  var svfStatus = (marksMap['svf'] || {})['status'] || '—';

  var marksEl = document.getElementById('pp-total-marks');
  if (marksEl) {
    marksEl.innerHTML =
      '<div>BITU3926: <strong>' + total3926.toFixed(2) + '</strong></div>' +
      '<div style="margin-top:4px">BITU3946: <strong>' + total3946.toFixed(2) + '</strong></div>';
  }

  var gradeEl = document.getElementById('pp-grade');
  if (gradeEl) {
    gradeEl.innerHTML =
      '<div>BITU3926: <strong>' + grade3926 + '</strong></div>' +
      '<div style="margin-top:4px">BITU3946: <strong>' + grade3946 + '</strong></div>';
  }
  setText('pp-svi-rating', sviRating);
  setText('pp-svf-rating', svfRating + ' (' + svfStatus + ')');

  // Store computed values for use in Part 2 pages
  window._pdfData = {
    total3926: total3926, grade3926: grade3926,
    total3946: total3946, grade3946: grade3946,
    sviRating: sviRating, svfRating: svfRating,
    svfStatus: svfStatus, marksMap: marksMap
  };

  // Populate pages 2-7 with marks data
  populatePDFPages();

  // Mark last page to prevent trailing blank page
  document.querySelectorAll('.print-page').forEach(function(p) {
    p.classList.remove('last-page');
  });
  var pages = document.querySelectorAll('.print-page');
  if (pages.length) pages[pages.length - 1].classList.add('last-page');

  window.print();
}

function populatePDFPages() {
  var d = window._pdfData;
  if (!d) return;
  var mm = d.marksMap || {};
  var s = currentStudent;
  if (!s) return;

  var today = new Date().toLocaleDateString('ms-MY');
  var courseCode = (s.kursus === 'BITE' || s.kursus === 'BITZ') ? 'BITU3926' : 'BITU3946';
  var studentLabel = (s.name || '—') + ' | ' + (s.matric_no || '—');

  // Get integer mark — always reads from window._pdfData.marksMap for robustness
  function gm(section, field) {
    var sec = (window._pdfData.marksMap || {})[section];
    if (!sec) return 0;
    var v = parseInt(sec[field]);
    return isNaN(v) ? 0 : v;
  }

  // Set innerHTML of element by id
  function sh(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // Set textContent of element by id
  function st(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // Read value from DOM element — handles input (.value) and display (.textContent) elements
  function domVal(id) {
    var el = document.getElementById(id);
    if (!el) return '0';
    return (el.value !== undefined && el.value !== '')
           ? el.value
           : (el.textContent || el.innerText || '0');
  }

  // Populate header right and footer date for pages 2-7
  [2, 3, 4, 5, 6, 7].forEach(function(n) {
    st('pp' + n + '-course', courseCode);
    st('pp' + n + '-student', studentLabel);
    st('pp' + n + '-footer-date', 'Dijana: ' + today);
  });

  // Signature names on page 7
  st('pp7-sig-svi', s.svi_name || '—');
  var svfSigName = window._pdfSvfName || s.svf_name || '—';
  st('pp7-sig-svf', svfSigName);

  // ── PAGE 2: SVI ──
  (function() {
    var a1 = gm('svi', 'a1'), a2 = gm('svi', 'a2');
    var a3 = gm('svi', 'a3'), a4 = gm('svi', 'a4');
    var aSub = a1 + a2 + a3 + a4;
    var bVals = [];
    for (var i = 1; i <= 10; i++) bVals.push(gm('svi', 'b' + i));
    var bSub = bVals.reduce(function(acc, v) { return acc + v; }, 0);
    var sviTotal = aSub + bSub;
    var rating = (mm['svi'] || {})['rating'] || '—';
    var ulasan = (mm['svi'] || {})['ulasan'] || '—';
    var bLabels = [
      'Disiplin Diri / Self Discipline',
      'Tanggungjawab / Responsibility',
      'Keyakinan Diri / Self Confidence',
      'Kreativiti & Inovasi / Creativity &amp; Innovation',
      'Kepimpinan / Leadership',
      'Komunikasi / Communication',
      'Kerjasama Berpasukan / Teamwork',
      'Etika Kerja / Work Ethics',
      'Inisiatif / Initiative',
      'Kemahiran Interpersonal / Interpersonal Skills'
    ];
    var r = '';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BAHAGIAN A — Pengetahuan &amp; Kemahiran / Knowledge &amp; Skills (max /50)</td></tr>';
    r += '<tr><td>A1. Pengetahuan Teknikal / Technical Knowledge</td><td class="td-mark">' + a1 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>A2. Kemahiran Praktikal / Practical Skills</td><td class="td-mark">' + a2 + '</td><td class="td-max">/15</td></tr>';
    r += '<tr><td>A3. Sikap &amp; Profesionalisme / Attitude &amp; Professionalism</td><td class="td-mark">' + a3 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>A4. Komunikasi &amp; Kerjasama / Communication &amp; Teamwork</td><td class="td-mark">' + a4 + '</td><td class="td-max">/15</td></tr>';
    r += '<tr class="tr-subtotal"><td>Subtotal Bahagian A</td><td class="td-mark">' + aSub + '</td><td class="td-max">/50</td></tr>';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BAHAGIAN B — Soft Skills (max /50)</td></tr>';
    for (var j = 0; j < 10; j++) {
      r += '<tr><td>B' + (j + 1) + '. ' + bLabels[j] + '</td><td class="td-mark">' + bVals[j] + '</td><td class="td-max">/5</td></tr>';
    }
    r += '<tr class="tr-subtotal"><td>Subtotal Bahagian B</td><td class="td-mark">' + bSub + '</td><td class="td-max">/50</td></tr>';
    r += '<tr class="tr-total"><td><strong>JUMLAH SVI / SVI TOTAL</strong></td><td class="td-mark"><strong>' + sviTotal + '</strong></td><td class="td-max">/100</td></tr>';
    r += '<tr><td>Penilaian Keseluruhan / Overall Rating</td><td class="td-mark" colspan="2">' + rating + '</td></tr>';
    r += '<tr><td>Ulasan / Remarks</td><td colspan="2" style="font-style:italic;color:#555">' + ulasan + '</td></tr>';
    sh('pp2-tbody', r);
  })();

  // ── PAGE 3: SVF ──
  (function() {
    var a1admin = gm('svf', 'a1_admin'), a1tech = gm('svf', 'a1_tech');
    var a2admin = gm('svf', 'a2_admin'), a2tech = gm('svf', 'a2_tech');
    var a3 = gm('svf', 'a3');
    var a1sub = a1admin + a1tech;
    var a2sub = a2admin + a2tech;
    var aTotal = a1sub + a2sub + a3;
    var b1 = gm('svf', 'b1'), c1 = gm('svf', 'c1');
    var svfTotal = aTotal + b1 + c1;
    var rating = (mm['svf'] || {})['rating'] || '—';
    var status = (mm['svf'] || {})['status'] || '—';
    var ulasan = (mm['svf'] || {})['ulasan'] || '—';
    var r = '';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BAHAGIAN A — Penilaian Prestasi / Performance Assessment (max /90)</td></tr>';
    r += '<tr><td colspan="3" style="padding:3px 8px;font-style:italic;color:#555;font-size:9pt">A1 — Pengetahuan &amp; Kemahiran / Knowledge &amp; Skills (max /30)</td></tr>';
    r += '<tr><td style="padding-left:20px">Pentadbiran &amp; Pengurusan / Administration &amp; Management</td><td class="td-mark">' + a1admin + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td style="padding-left:20px">Bidang Teknikal / Technical Field</td><td class="td-mark">' + a1tech + '</td><td class="td-max">/20</td></tr>';
    r += '<tr class="tr-subtotal"><td style="padding-left:20px">Subtotal A1</td><td class="td-mark">' + a1sub + '</td><td class="td-max">/30</td></tr>';
    r += '<tr><td colspan="3" style="padding:3px 8px;font-style:italic;color:#555;font-size:9pt">A2 — Kuantiti Hasil Kerja / Work Output Quantity (max /30)</td></tr>';
    r += '<tr><td style="padding-left:20px">Pentadbiran &amp; Pengurusan / Administration &amp; Management</td><td class="td-mark">' + a2admin + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td style="padding-left:20px">Bidang Teknikal / Technical Field</td><td class="td-mark">' + a2tech + '</td><td class="td-max">/20</td></tr>';
    r += '<tr class="tr-subtotal"><td style="padding-left:20px">Subtotal A2</td><td class="td-mark">' + a2sub + '</td><td class="td-max">/30</td></tr>';
    r += '<tr><td>A3. Mutu Hasil Kerja / Work Quality</td><td class="td-mark">' + a3 + '</td><td class="td-max">/30</td></tr>';
    r += '<tr class="tr-subtotal"><td>Subtotal Bahagian A</td><td class="td-mark">' + aTotal + '</td><td class="td-max">/90</td></tr>';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BAHAGIAN B — Pembentangan / Presentation (max /10)</td></tr>';
    r += '<tr><td>B1. Pembentangan / Presentation</td><td class="td-mark">' + b1 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BAHAGIAN C — Komitmen / Commitment (max /10)</td></tr>';
    r += '<tr><td>C1. Komitmen &amp; Kehadiran / Commitment &amp; Attendance</td><td class="td-mark">' + c1 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr class="tr-total"><td><strong>JUMLAH SVF / SVF TOTAL</strong></td><td class="td-mark"><strong>' + svfTotal + '</strong></td><td class="td-max">/110</td></tr>';
    r += '<tr><td>Penilaian Keseluruhan / Overall Rating</td><td class="td-mark" colspan="2">' + rating + '</td></tr>';
    r += '<tr><td>Cadangan Status / Status Recommendation</td><td class="td-mark" colspan="2">' + status + '</td></tr>';
    r += '<tr><td>Ulasan / Remarks</td><td colspan="2" style="font-style:italic;color:#555">' + ulasan + '</td></tr>';
    sh('pp3-tbody', r);
  })();

  // ── PAGE 4: LOGBOOK ──
  (function() {
    var a1 = gm('logbook', 'a1'), b1 = gm('logbook', 'b1'), c1 = gm('logbook', 'c1');
    var logTotal = a1 + b1 + c1;
    var r = '';
    r += '<tr><td>A1. Kandungan Logbook / Logbook Content</td><td class="td-mark">' + a1 + '</td><td class="td-max">/50</td></tr>';
    r += '<tr><td>B1. Persembahan / Presentation Quality</td><td class="td-mark">' + b1 + '</td><td class="td-max">/20</td></tr>';
    r += '<tr><td>C1. Penghantaran / Submission</td><td class="td-mark">' + c1 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr class="tr-total"><td><strong>JUMLAH e-LOGBOOK / e-LOGBOOK TOTAL</strong></td><td class="td-mark"><strong>' + logTotal + '</strong></td><td class="td-max">/70</td></tr>';
    sh('pp4-tbody', r);
  })();

  // ── PAGE 5: PEMBENTANGAN ──
  (function() {
    var svfB1  = parseFloat(domVal('svf_b1'))  || 0;
    var sviB1  = parseFloat(domVal('svi_b1'))  || 0;
    var sviB2  = parseFloat(domVal('svi_b2'))  || 0;
    var sviB3  = parseFloat(domVal('svi_b3'))  || 0;
    var sviB4  = parseFloat(domVal('svi_b4'))  || 0;
    var sviB5  = parseFloat(domVal('svi_b5'))  || 0;
    var sviB6  = parseFloat(domVal('svi_b6'))  || 0;
    var sviB7  = parseFloat(domVal('svi_b7'))  || 0;
    var sviB8  = parseFloat(domVal('svi_b8'))  || 0;
    var sviB9  = parseFloat(domVal('svi_b9'))  || 0;
    var sviB10 = parseFloat(domVal('svi_b10')) || 0;
    var sviBTotal = sviB1 + sviB2 + sviB3 + sviB4 + sviB5 +
                    sviB6 + sviB7 + sviB8 + sviB9 + sviB10;
    var pr11_3926 = svfB1 + (sviBTotal / 5);
    // Read BITU3946 presentation totals from calcSummary stat cards
    var psvfRaw = parseFloat(domVal('sum_psvf')) || 0;
    var psviRaw = parseFloat(domVal('sum_psvi')) || 0;
    var pr11_3946 = Math.round((psvfRaw + psviRaw) / 200 * 20 * 100) / 100;
    var sviBArr = [sviB1,sviB2,sviB3,sviB4,sviB5,sviB6,sviB7,sviB8,sviB9,sviB10];
    var sviLabels = [
      'Penguasaan Teknikal / Technical Mastery',
      'Kejelasan Penyampaian / Clarity of Delivery',
      'Keyakinan / Confidence',
      'Pengurusan Masa / Time Management',
      'Kemahiran Visual / Visual Skills',
      'Pengendalian Soalan / Q&amp;A Handling',
      'Struktur Pembentangan / Presentation Structure',
      'Isi Kandungan / Content',
      'Bahasa / Language',
      'Keseluruhan / Overall'
    ];
    var r = '';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BITU3926 — PR1-1 (Pembentangan / Presentation, max /20)</td></tr>';
    r += '<tr><td>SVF Bah. B — Pembentangan / SVF Presentation</td><td class="td-mark">' + svfB1 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>SVI Bah. B — Pembentangan (Jumlah &divide; 5) / SVI Presentation</td><td class="td-mark">' + (sviBTotal / 5).toFixed(2) + '</td><td class="td-max">/10</td></tr>';
    r += '<tr class="tr-subtotal"><td>PR1-1 BITU3926</td><td class="td-mark">' + pr11_3926.toFixed(2) + '</td><td class="td-max">/20</td></tr>';
    r += '<tr><td colspan="3" style="background:#eff6ff;font-weight:600;color:#1e4291;padding:4px 8px;font-size:9pt">SVI Pembentangan — Butiran / SVI Presentation Detail (raw /50)</td></tr>';
    for (var j = 0; j < 10; j++) {
      r += '<tr><td style="padding-left:16px">B' + (j + 1) + '. ' + sviLabels[j] + '</td><td class="td-mark">' + sviBArr[j] + '</td><td class="td-max">/5</td></tr>';
    }
    r += '<tr class="tr-subtotal"><td>Jumlah SVI Pembentangan (raw)</td><td class="td-mark">' + sviBTotal + '</td><td class="td-max">/50</td></tr>';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BITU3946 — PR1-1 (Purata SVF &amp; SVI / 20)</td></tr>';
    r += '<tr><td>Pembentangan SVF (Jumlah Keseluruhan SVF)</td><td class="td-mark">' + psvfRaw + '</td><td class="td-max">/100</td></tr>';
    r += '<tr><td>Pembentangan SVI (Jumlah Keseluruhan SVI)</td><td class="td-mark">' + psviRaw + '</td><td class="td-max">/100</td></tr>';
    r += '<tr class="tr-total"><td><strong>PR1-1 BITU3946 ((SVF+SVI) &divide; 200 &times; 20)</strong></td><td class="td-mark"><strong>' + pr11_3946.toFixed(2) + '</strong></td><td class="td-max">/20</td></tr>';
    sh('pp5-tbody', r);
  })();

  // ── PAGE 6: LAPORAN LI ──
  (function() {
    var p1btn = document.getElementById('opt-p1');
    var pilihan = (p1btn && p1btn.classList.contains('selected')) ? 1 : 2;
    var repA1 = parseFloat(domVal('rep_a1')) || 0;
    var repA2 = parseFloat(domVal('rep_a2')) || 0;
    var repA3 = parseFloat(domVal('rep_a3')) || 0;
    var repA4tech, repA4admin;
    if (pilihan === 1) {
      repA4tech  = parseFloat(domVal('rep_a4_tech_p1'))  || 0;
      repA4admin = parseFloat(domVal('rep_a4_admin_p1')) || 0;
    } else {
      repA4tech  = parseFloat(domVal('rep_a4_tech_p2'))  || 0;
      repA4admin = parseFloat(domVal('rep_a4_admin_p2')) || 0;
    }
    var repA5 = parseFloat(domVal('rep_a5')) || 0;
    var repA6 = parseFloat(domVal('rep_a6')) || 0;
    var repA7 = parseFloat(domVal('rep_a7')) || 0;
    var repB1 = parseFloat(domVal('rep_b1')) || 0;
    var repB2 = parseFloat(domVal('rep_b2')) || 0;
    var repB3 = parseFloat(domVal('rep_b3')) || 0;
    var repB4 = parseFloat(domVal('rep_b4')) || 0;
    var aRaw = repA1 + repA2 + repA3 + repA4tech + repA4admin + repA5 + repA6 + repA7;
    var aConverted = aRaw / 2;
    var bSub = repB1 + repB2 + repB3 + repB4;
    var repTotal = aRaw + bSub;
    // alias for HTML rows
    var a1 = repA1, a2 = repA2, a3 = repA3, a4Tech = repA4tech, a4Admin = repA4admin;
    var a5 = repA5, a6 = repA6, a7 = repA7;
    var b1 = repB1, b2 = repB2, b3 = repB3, b4 = repB4;
    var r = '';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BAHAGIAN A — Kandungan Laporan / Report Content (raw /80 &rarr; /40)</td></tr>';
    r += '<tr><td>A1. Pengenalan / Introduction</td><td class="td-mark">' + a1 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>A2. Latar Belakang Organisasi / Organisation Background</td><td class="td-mark">' + a2 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>A3. Latihan yang Diterima / Training Received</td><td class="td-mark">' + a3 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td colspan="3" style="padding:3px 8px;font-style:italic;color:#555;font-size:9pt">A4. Tugasan LI — Pilihan ' + pilihan + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Teknikal / Technical</td><td class="td-mark">' + a4Tech + '</td><td class="td-max">/20</td></tr>';
    r += '<tr><td style="padding-left:16px">Pentadbiran &amp; Pengurusan / Administration</td><td class="td-mark">' + a4Admin + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>A5. Perbincangan / Discussion</td><td class="td-mark">' + a5 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>A6. Rumusan / Conclusion</td><td class="td-mark">' + a6 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>A7. Rujukan &amp; Lampiran / References &amp; Appendix</td><td class="td-mark">' + a7 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr class="tr-subtotal"><td>Subtotal Bah. A (raw)</td><td class="td-mark">' + aRaw + '</td><td class="td-max">/80</td></tr>';
    r += '<tr class="tr-subtotal"><td>Subtotal Bah. A (&divide; 2)</td><td class="td-mark">' + aConverted + '</td><td class="td-max">/40</td></tr>';
    r += '<tr><td colspan="3" style="background:#dbeafe;font-weight:700;color:#1e3a8a;padding:5px 8px">BAHAGIAN B — Kualiti Penulisan / Writing Quality (max /40)</td></tr>';
    r += '<tr><td>B1. Kualiti Bahasa / Language Quality</td><td class="td-mark">' + b1 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>B2. Kualiti Persembahan / Presentation Quality</td><td class="td-mark">' + b2 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>B3. Kekemasan / Neatness</td><td class="td-mark">' + b3 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr><td>B4. Menepati Format Laporan / Format Compliance</td><td class="td-mark">' + b4 + '</td><td class="td-max">/10</td></tr>';
    r += '<tr class="tr-subtotal"><td>Subtotal Bahagian B</td><td class="td-mark">' + bSub + '</td><td class="td-max">/40</td></tr>';
    r += '<tr class="tr-total"><td><strong>JUMLAH LAPORAN LI / REPORT TOTAL (raw)</strong></td><td class="td-mark"><strong>' + repTotal + '</strong></td><td class="td-max">/120</td></tr>';
    sh('pp6-tbody', r);
  })();

  // ── PAGE 7: OBE BREAKDOWN ──
  (function() {
    var r = '';
    var d = window._pdfData;

    // ── BITU3926 ──
    var prj1r  = domVal('r_prj1r');
    var prj1   = domVal('r_prj1');
    var prj2r  = domVal('r_prj2r');
    var prj2   = domVal('r_prj2');
    var prj3r  = domVal('r_prj3r');
    var prj3   = domVal('r_prj3');
    var prj4r  = domVal('r_prj4r');
    var prj4   = domVal('r_prj4');
    var lr1r   = domVal('r_lr1r');
    var lr1    = domVal('r_lr1');
    var pr11svfbRaw = domVal('r_pr11_svfb_raw');
    var pr11svfb    = domVal('r_pr11_svfb');
    var pr11svibRaw = domVal('r_pr11_svib_raw');
    var pr11svib    = domVal('r_pr11_svib');
    var pr11   = domVal('r_pr11');

    // Group subtotals for BITU3926
    var grp1Total = (parseFloat(prj1) || 0) + (parseFloat(prj2) || 0);
    var grp2Total = (parseFloat(prj3) || 0) + (parseFloat(prj4) || 0) + (parseFloat(lr1) || 0);
    var grp3Total = pr11;  // already formatted

    // BITU3926 section header
    r += '<tr style="background:#0f2560"><td colspan="4" style="color:#fff;font-weight:700;padding:5px 10px;font-size:9pt">BITU3926 — Latihan Industri</td></tr>';

    // Group 1: Penyelia Industri (30%)
    r += '<tr class="pp7-group-header"><td style="color:#fff;font-weight:700">Penyelia Industri (30%)</td><td></td><td></td><td style="color:#fff;font-weight:700;text-align:right">' + grp1Total.toFixed(2) + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Penyelia Industri</td><td>PRJ-1 (15%)</td><td class="td-mark">' + prj1r + '</td><td class="td-mark">' + prj1 + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Penyelia Industri</td><td>PRJ-2 (15%)</td><td class="td-mark">' + prj2r + '</td><td class="td-mark">' + prj2 + '</td></tr>';

    // Group 2: Penyelia Fakulti (50%)
    r += '<tr class="pp7-group-header"><td style="color:#fff;font-weight:700">Penyelia Fakulti (50%)</td><td></td><td></td><td style="color:#fff;font-weight:700;text-align:right">' + grp2Total.toFixed(2) + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Penyelia Fakulti</td><td>PRJ-3 (15%)</td><td class="td-mark">' + prj3r + '</td><td class="td-mark">' + prj3 + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Penyelia Fakulti</td><td>PRJ-4 (15%)</td><td class="td-mark">' + prj4r + '</td><td class="td-mark">' + prj4 + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Penyelia Fakulti</td><td>LR1 (20%)</td><td class="td-mark">' + lr1r + '</td><td class="td-mark">' + lr1 + '</td></tr>';

    // Group 3: Pembentangan (20%)
    r += '<tr class="pp7-group-header"><td style="color:#fff;font-weight:700">Penyelia Industri (10%) + Penyelia Fakulti (10%)</td><td></td><td></td><td style="color:#fff;font-weight:700;text-align:right">' + grp3Total + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Penyelia Industri &amp; Fakulti</td><td>PR1-1 &mdash; SVI Bah. B (&divide;5)</td><td class="td-mark">' + pr11svibRaw + '</td><td class="td-mark">' + pr11svib + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Penyelia Industri &amp; Fakulti</td><td>PR1-1 &mdash; SVF Bah. B</td><td class="td-mark">' + pr11svfbRaw + '</td><td class="td-mark">' + pr11svfb + '</td></tr>';

    // BITU3926 total row
    r += '<tr class="pp7-total-row"><td colspan="3"><strong>JUMLAH MARKAH KESELURUHAN BITU3926</strong></td><td class="td-mark"><strong>' + d.total3926.toFixed(2) + ' / ' + d.grade3926 + '</strong></td></tr>';

    // Spacer
    r += '<tr><td colspan="4" style="padding:6px 0;border:none;background:transparent"></td></tr>';

    // ── BITU3946 ──
    var tr1lapaRaw = domVal('r2_tr1_lapa_raw');
    var tr1lapa    = domVal('r2_tr1_lapa');
    var tr1lapbRaw = domVal('r2_tr1_lapb_raw');
    var tr1lapb    = domVal('r2_tr1_lapb');
    var tr1komr    = domVal('r2_tr1_komr');
    var tr1kom     = domVal('r2_tr1_kom');
    var tr1logr    = domVal('r2_tr1_logr');
    var tr1log     = domVal('r2_tr1_log');
    var tr1        = domVal('r2_tr1');
    var pr11psvfRaw = domVal('r2_pr11_psvf_raw');
    var pr11psviRaw = domVal('r2_pr11_psvi_raw');
    var pr11_46    = domVal('r2_pr11');
    var pr12r      = domVal('r2_pr12r');
    var pr12       = domVal('r2_pr12');

    // BITU3946 section header
    r += '<tr style="background:#0f2560"><td colspan="4" style="color:#fff;font-weight:700;padding:5px 10px;font-size:9pt">BITU3946 — Laporan Latihan Industri</td></tr>';

    // Group 1: TR1 — Laporan LI (70%)
    r += '<tr class="pp7-group-header"><td style="color:#fff;font-weight:700">TR1 &mdash; Laporan LI (70%)</td><td></td><td></td><td style="color:#fff;font-weight:700;text-align:right">' + tr1 + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Laporan LI</td><td>TR1 (70%) &mdash; Laporan A</td><td class="td-mark">' + tr1lapaRaw + '</td><td class="td-mark">' + tr1lapa + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Laporan LI</td><td>TR1 (70%) &mdash; Laporan B</td><td class="td-mark">' + tr1lapbRaw + '</td><td class="td-mark">' + tr1lapb + '</td></tr>';
    r += '<tr><td style="padding-left:16px">SVF Komitmen</td><td>&mdash;</td><td class="td-mark">' + tr1komr + '</td><td class="td-mark">' + tr1kom + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Logbook Penghantaran</td><td>&mdash;</td><td class="td-mark">' + tr1logr + '</td><td class="td-mark">' + tr1log + '</td></tr>';

    // Group 2: PR1-1 — Pembentangan (20%)
    r += '<tr class="pp7-group-header"><td style="color:#fff;font-weight:700">PR1-1 &mdash; Pembentangan (20%)</td><td></td><td></td><td style="color:#fff;font-weight:700;text-align:right">' + pr11_46 + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Pembentangan SVF</td><td>PR1-1 (20%)</td><td class="td-mark">' + pr11psvfRaw + '</td><td class="td-mark">' + pr11psvfRaw + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Pembentangan SVI</td><td>PR1-1 (20%)</td><td class="td-mark">' + pr11psviRaw + '</td><td class="td-mark">' + pr11psviRaw + '</td></tr>';

    // Group 3: PR1-2 — Soft Skills (10%)
    r += '<tr class="pp7-group-header"><td style="color:#fff;font-weight:700">PR1-2 &mdash; Soft Skills (10%)</td><td></td><td></td><td style="color:#fff;font-weight:700;text-align:right">' + pr12 + '</td></tr>';
    r += '<tr><td style="padding-left:16px">Soft Skills / SVI Bah. B &divide; 5</td><td>PR1-2 (10%)</td><td class="td-mark">' + pr12r + '</td><td class="td-mark">&mdash;</td></tr>';

    // BITU3946 total row
    r += '<tr class="pp7-total-row"><td colspan="3"><strong>JUMLAH MARKAH KESELURUHAN BITU3946</strong></td><td class="td-mark"><strong>' + d.total3946.toFixed(2) + ' / ' + d.grade3946 + '</strong></td></tr>';

    sh('pp7-tbody', r);
  })();
}

// ===== END PDF GENERATION =====

// ===== LAPORAN =====
var _laporanStudents = [];
var _laporanFiltered = [];
var _laporanPensyarahMap = {};
var _laporanMarksCache = {};
var _laporanOpenIdx = -1;

function computeOBE(mm) {
  mm = mm || {};
  var svi  = mm.svi          || {};
  var svf  = mm.svf          || {};
  var log  = mm.logbook      || {};
  var pres = mm.presentation || {};
  var rep  = mm.report       || {};
  function gi(o, k) { return Math.max(0, parseInt(o[k]) || 0); }

  var sviA1  = gi(svi,'a1') + gi(svi,'a2');
  var sviA23 = gi(svi,'a3') + gi(svi,'a4');
  var sviB   = gi(svi,'b1') + gi(svi,'b2') + gi(svi,'b3') + gi(svi,'b4') + gi(svi,'b5') +
               gi(svi,'b6') + gi(svi,'b7') + gi(svi,'b8') + gi(svi,'b9') + gi(svi,'b10');
  var svfA1  = gi(svf,'a1_admin') + gi(svf,'a1_tech');
  var svfA23 = gi(svf,'a2_admin') + gi(svf,'a2_tech') + gi(svf,'a3');
  var logT   = gi(log,'a1') + gi(log,'b1') + gi(log,'c1');
  var psvfT  = gi(pres,'psvf_a') + gi(pres,'psvf_b1') + gi(pres,'psvf_b2') + gi(pres,'psvf_b3') +
               gi(pres,'psvf_b4') + gi(pres,'psvf_b5') + gi(pres,'psvf_c1') + gi(pres,'psvf_c2') +
               gi(pres,'psvf_c3') + gi(pres,'psvf_d1') + gi(pres,'psvf_d2') + gi(pres,'psvf_d3') + gi(pres,'psvf_d4');
  var psviT  = gi(pres,'psvi_a') + gi(pres,'psvi_b1') + gi(pres,'psvi_b2') + gi(pres,'psvi_b3') +
               gi(pres,'psvi_b4') + gi(pres,'psvi_b5') + gi(pres,'psvi_c1') + gi(pres,'psvi_c2') +
               gi(pres,'psvi_c3') + gi(pres,'psvi_d1') + gi(pres,'psvi_d2') + gi(pres,'psvi_d3') + gi(pres,'psvi_d4');
  var pil    = parseInt(rep.pilihan) || 1;
  var repA4  = pil === 1 ? (gi(rep,'a4_tech_p1') + gi(rep,'a4_admin_p1')) : (gi(rep,'a4_tech_p2') + gi(rep,'a4_admin_p2'));
  var repA   = gi(rep,'a1') + gi(rep,'a2') + gi(rep,'a3') + repA4 + gi(rep,'a5') + gi(rep,'a6') + gi(rep,'a7');
  var repB   = gi(rep,'b1') + gi(rep,'b2') + gi(rep,'b3') + gi(rep,'b4');

  var prj1      = fmt(sviA1  / 30  * 15);
  var prj2      = fmt(sviA23 / 20  * 15);
  var prj3      = fmt(svfA1  / 30  * 15);
  var prj4      = fmt(svfA23 / 60  * 15);
  var lr1       = fmt(logT   / 70  * 20);
  var pr11_svfb = gi(svf, 'b1');
  var pr11_svib = fmt(sviB / 5);
  var pr11      = fmt(pr11_svfb + pr11_svib);
  var b3926     = fmt(prj1 + prj2 + prj3 + prj4 + lr1 + pr11);
  var g3926     = getGrade(b3926);

  var tr1_lapa = fmt(repA / 2);
  var tr1_lapb = fmt(repB / 40 * 10);
  var tr1_svfc = gi(svf, 'c1');
  var tr1_logc = gi(log, 'c1');
  var tr1      = fmt(tr1_lapa + tr1_lapb + tr1_svfc + tr1_logc);
  var pr11_pbt = fmt((psvfT + psviT) / 200 * 20);
  var pr12sum  = parseFloat((prj1 + prj2 + pr11_svib).toFixed(2));
  var pr12     = fmt(pr12sum / 40 * 10);
  var b3946    = fmt(tr1 + pr11_pbt + pr12);
  var g3946    = getGrade(b3946);

  return {
    prj1: prj1, prj2: prj2, prj3: prj3, prj4: prj4,
    lr1: lr1, pr11_svfb: pr11_svfb, pr11_svib: pr11_svib, pr11: pr11,
    b3926: b3926, g3926: g3926.g, g3926cls: g3926.cls,
    tr1: tr1, tr1_lapa: tr1_lapa, tr1_lapb: tr1_lapb, tr1_svfc: tr1_svfc, tr1_logc: tr1_logc,
    psvfT: psvfT, psviT: psviT, pr11_pbt: pr11_pbt, pr12: pr12,
    b3946: b3946, g3946: g3946.g, g3946cls: g3946.cls
  };
}

async function loadLaporan() {
  var tbody = document.getElementById('laporan-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:var(--text3)">Memuatkan...</td></tr>';
  try {
    var results = await Promise.all([
      sb.from('students').select('id, matric_no, name, kursus, semester, sesi, svf_email, svf_name, svi_name, organisasi, approval_status').order('name'),
      sb.from('users').select('full_name, email').contains('roles', ['PENSYARAH']).order('full_name'),
      sb.from('marks').select('student_id, evaluator_email, section, data')
    ]);
    var students     = results[0].data || [];
    var pensyarahList = results[1].data || [];
    var mrData       = results[2].data || [];

    _laporanPensyarahMap = {};
    pensyarahList.forEach(function(p) { _laporanPensyarahMap[p.email] = p.full_name; });

    var svfByStudentId = {};
    students.forEach(function(s) { svfByStudentId[s.id] = s.svf_email || null; });

    _laporanMarksCache = {};
    mrData.forEach(function(m) {
      var svfEmail = svfByStudentId[m.student_id];
      if (svfEmail && m.evaluator_email && m.evaluator_email !== svfEmail) return;
      if (!_laporanMarksCache[m.student_id]) _laporanMarksCache[m.student_id] = {};
      _laporanMarksCache[m.student_id][m.section] = m.data;
    });

    students.forEach(function(s) {
      s._obe = computeOBE(_laporanMarksCache[s.id] || {});
    });

    _laporanStudents = students;
    _laporanOpenIdx  = -1;
    filterLaporan();
  } catch (err) {
    console.error('loadLaporan error:', err);
    var tbody2 = document.getElementById('laporan-tbody');
    if (tbody2) tbody2.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:red">Ralat memuatkan data. Sila muat semula halaman.</td></tr>';
  }
}

function filterLaporan() {
  var kFilter = (document.getElementById('laporan-filter-kursus') || {}).value || '';
  var sFilter = (document.getElementById('laporan-filter-status') || {}).value || '';
  _laporanFiltered = _laporanStudents.filter(function(s) {
    if (kFilter && (s.kursus || '').indexOf(kFilter) === -1) return false;
    var isSelesai = (s.approval_status === 'approved');
    if (sFilter === 'selesai' && !isSelesai) return false;
    if (sFilter === 'pending' && isSelesai) return false;
    return true;
  });
  _laporanOpenIdx = -1;
  var sumEl = document.getElementById('laporan-summary');
  if (sumEl) sumEl.textContent = 'Menunjukkan ' + _laporanFiltered.length + ' daripada ' + _laporanStudents.length + ' pelajar';
  renderLaporanTable();
}

function renderLaporanTable() {
  var tbody = document.getElementById('laporan-tbody');
  if (!tbody) return;
  if (!_laporanFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:var(--text3)">Tiada pelajar.</td></tr>';
    return;
  }
  var html = '';
  _laporanFiltered.forEach(function(s, i) {
    var isSelesai  = (s.approval_status === 'approved');
    var statusBadge = isSelesai
      ? '<span class="status-badge status-active">Selesai</span>'
      : '<span class="status-badge status-inactive">Pending</span>';
    var obe        = s._obe || {};
    var globalIdx  = _laporanStudents.indexOf(s);
    var isOpen     = (_laporanOpenIdx === globalIdx);
    html += '<tr class="laporan-row dash-row-clickable' + (isOpen ? ' laporan-row-open' : '') + '" onclick="toggleLaporanRow(' + globalIdx + ')">' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + escHtml(s.name || '') + '</td>' +
      '<td>' + escHtml(s.matric_no || '') + '</td>' +
      '<td>' + escHtml(s.kursus || '') + '</td>' +
      '<td style="font-weight:600">' + (obe.b3926 || '0') + '</td>' +
      '<td><span class="grade-pill ' + (obe.g3926cls || 'grade-E') + '" style="font-size:12px;padding:2px 8px;min-width:unset;display:inline-block">' + (obe.g3926 || '—') + '</span></td>' +
      '<td style="font-weight:600">' + (obe.b3946 || '0') + '</td>' +
      '<td><span class="grade-pill ' + (obe.g3946cls || 'grade-E') + '" style="font-size:12px;padding:2px 8px;min-width:unset;display:inline-block">' + (obe.g3946 || '—') + '</span></td>' +
      '<td>' + statusBadge + '</td>' +
      '</tr>';
    if (isOpen) {
      html += '<tr class="laporan-expand-row"><td colspan="9">' + renderLaporanExpandedRow(globalIdx) + '</td></tr>';
    }
  });
  tbody.innerHTML = html;
}

function toggleLaporanRow(idx) {
  _laporanOpenIdx = (_laporanOpenIdx === idx) ? -1 : idx;
  renderLaporanTable();
}

function renderLaporanExpandedRow(idx) {
  var s = _laporanStudents[idx];
  if (!s) return '';
  var obe     = s._obe || {};
  var svfName = s.svf_name || (s.svf_email ? (_laporanPensyarahMap[s.svf_email] || s.svf_email) : '—');
  var g3926   = getGrade(obe.b3926 || 0);
  var g3946   = getGrade(obe.b3946 || 0);
  function fn(v) { return (parseFloat(v) || 0).toFixed(2); }

  // ── Info Pelajar ──
  var infoHtml =
    '<div class="laporan-expand-info">' +
    '<div class="laporan-expand-title">Info Pelajar</div>' +
    '<table class="laporan-info-table">' +
    '<tr><td>Semester</td><td>' + escHtml(String(s.semester || '—')) + '</td></tr>' +
    '<tr><td>Sesi</td><td>' + escHtml(s.sesi || '—') + '</td></tr>' +
    '<tr><td>Penyelia Fakulti</td><td>' + escHtml(svfName) + '</td></tr>' +
    '<tr><td>Organisasi</td><td>' + escHtml(s.organisasi || '—') + '</td></tr>' +
    '<tr><td>Penyelia Industri</td><td>' + escHtml(s.svi_name || '—') + '</td></tr>' +
    '</table></div>';

  // ── BITU3926 Detail — 4-column with rowspan ──
  var prjPI   = fn(parseFloat(obe.prj1||0) + parseFloat(obe.prj2||0));
  var prjPF   = fn(parseFloat(obe.prj3||0) + parseFloat(obe.prj4||0) + parseFloat(obe.lr1||0));
  var prjPres = fn(parseFloat(obe.pr11||0));
  var obe3926Html =
    '<div class="laporan-obe-detail">' +
    '<div class="laporan-expand-title">BITU3926 &mdash; Latihan Industri</div>' +
    '<table class="laporan-detail-table">' +
    '<thead><tr>' +
    '<th style="width:26%">Penilaian</th><th>Komponen</th>' +
    '<th style="text-align:right;width:14%">Markah</th><th style="text-align:right;width:14%">Jumlah</th>' +
    '</tr></thead>' +
    '<tbody>' +
    '<tr>' +
    '<td rowspan="2" class="laporan-penilaian-cell">Penyelia Industri<br><small>(30%)</small></td>' +
    '<td>PRJ-1 (PI 15%)</td><td class="laporan-markah-cell">' + fn(obe.prj1) + '</td>' +
    '<td rowspan="2" class="laporan-jumlah-cell">' + prjPI + '</td>' +
    '</tr>' +
    '<tr><td>PRJ-2 (PI 15%)</td><td class="laporan-markah-cell">' + fn(obe.prj2) + '</td></tr>' +
    '<tr>' +
    '<td rowspan="3" class="laporan-penilaian-cell">Penyelia Fakulti<br><small>(50%)</small></td>' +
    '<td>PRJ-3 (PF 15%)</td><td class="laporan-markah-cell">' + fn(obe.prj3) + '</td>' +
    '<td rowspan="3" class="laporan-jumlah-cell">' + prjPF + '</td>' +
    '</tr>' +
    '<tr><td>PRJ-4 (PF 15%)</td><td class="laporan-markah-cell">' + fn(obe.prj4) + '</td></tr>' +
    '<tr><td>LR1 &mdash; Log Report (20%)</td><td class="laporan-markah-cell">' + fn(obe.lr1) + '</td></tr>' +
    '<tr>' +
    '<td rowspan="2" class="laporan-penilaian-cell">Pembentangan<br><small>(20%)</small></td>' +
    '<td>PR1-1 Presentation PI (10%)</td><td class="laporan-markah-cell">' + fn(obe.pr11_svib) + '</td>' +
    '<td rowspan="2" class="laporan-jumlah-cell">' + prjPres + '</td>' +
    '</tr>' +
    '<tr><td>PR1-1 Presentation PF (10%)</td><td class="laporan-markah-cell">' + fn(obe.pr11_svfb) + '</td></tr>' +
    '</tbody>' +
    '<tfoot>' +
    '<tr class="laporan-total-row"><td colspan="3">Jumlah Keseluruhan</td><td style="text-align:right">' + fn(obe.b3926) + ' / 100</td></tr>' +
    '<tr class="laporan-grade-row"><td colspan="3">Gred</td><td style="text-align:right"><span class="grade-pill ' + g3926.cls + '" style="font-size:12px;padding:2px 8px;min-width:unset;display:inline-block">' + g3926.g + '</span></td></tr>' +
    '</tfoot></table></div>';

  // ── BITU3946 Detail — 4-column with rowspan ──
  var tr1_rep  = fn(parseFloat(obe.tr1_lapa||0) + parseFloat(obe.tr1_lapb||0));
  var tr1Sub   = fn(parseFloat(obe.tr1||0));
  var psvfPbt  = fn(parseFloat(obe.psvfT||0) / 10);
  var psviPbt  = fn(parseFloat(obe.psviT||0) / 10);
  var presSub  = fn(parseFloat(obe.pr11_pbt||0));
  var skillSub = fn(parseFloat(obe.pr12||0));
  var obe3946Html =
    '<div class="laporan-obe-detail">' +
    '<div class="laporan-expand-title">BITU3946 &mdash; Laporan Latihan Industri</div>' +
    '<table class="laporan-detail-table">' +
    '<thead><tr>' +
    '<th style="width:26%">Penilaian</th><th>Komponen</th>' +
    '<th style="text-align:right;width:14%">Markah</th><th style="text-align:right;width:14%">Jumlah</th>' +
    '</tr></thead>' +
    '<tbody>' +
    '<tr>' +
    '<td rowspan="3" class="laporan-penilaian-cell">Laporan<br><small>(70%)</small></td>' +
    '<td>TR1 &mdash; LI Report</td><td class="laporan-markah-cell">' + tr1_rep + '</td>' +
    '<td rowspan="3" class="laporan-jumlah-cell">' + tr1Sub + '</td>' +
    '</tr>' +
    '<tr><td>Buku Log (10%)</td><td class="laporan-markah-cell">' + fn(obe.tr1_logc) + '</td></tr>' +
    '<tr><td>Komitmen (10%)</td><td class="laporan-markah-cell">' + fn(obe.tr1_svfc) + '</td></tr>' +
    '<tr>' +
    '<td rowspan="2" class="laporan-penilaian-cell">Pembentangan<br><small>(20%)</small></td>' +
    '<td>Presentation PF (10%)</td><td class="laporan-markah-cell">' + psvfPbt + '</td>' +
    '<td rowspan="2" class="laporan-jumlah-cell">' + presSub + '</td>' +
    '</tr>' +
    '<tr><td>Presentation PI (10%)</td><td class="laporan-markah-cell">' + psviPbt + '</td></tr>' +
    '<tr>' +
    '<td class="laporan-penilaian-cell">Soft Skills<br><small>(10%)</small></td>' +
    '<td>Soft Skills (10%)</td><td class="laporan-markah-cell">' + skillSub + '</td>' +
    '<td class="laporan-jumlah-cell">' + skillSub + '</td>' +
    '</tr>' +
    '</tbody>' +
    '<tfoot>' +
    '<tr class="laporan-total-row"><td colspan="3">Jumlah Keseluruhan</td><td style="text-align:right">' + fn(obe.b3946) + ' / 100</td></tr>' +
    '<tr class="laporan-grade-row"><td colspan="3">Gred</td><td style="text-align:right"><span class="grade-pill ' + g3946.cls + '" style="font-size:12px;padding:2px 8px;min-width:unset;display:inline-block">' + g3946.g + '</span></td></tr>' +
    '</tfoot></table></div>';

  var printBtn =
    '<div style="display:flex;justify-content:flex-end;margin-top:12px">' +
    '<button class="btn-primary" onclick="event.stopPropagation();printLaporanStudent(' + idx + ')">&#128438; Cetak Laporan</button>' +
    '</div>';

  return '<div class="laporan-expand-panel">' +
    infoHtml +
    '<div class="laporan-expand-obe">' + obe3926Html + obe3946Html + '</div>' +
    '</div>' + printBtn;
}

function printLaporanStudent(idx) {
  var s = _laporanStudents[idx];
  if (!s) return;
  var o = s._obe || {};

  var svfName = s.svf_name || _laporanPensyarahMap[s.svf_email] || s.svf_email || '—';
  var sviName = s.svi_name || '—';

  function fv(v) { return (v !== undefined && v !== null && v !== '') ? String(v) : '—'; }
  function fn(v) { return (parseFloat(v) || 0).toFixed(2); }

  var now = new Date();
  var dd = String(now.getDate()).padStart(2,'0');
  var mm = String(now.getMonth()+1).padStart(2,'0');
  var yyyy = now.getFullYear();
  var hh = String(now.getHours()).padStart(2,'0');
  var mi = String(now.getMinutes()).padStart(2,'0');
  var dateStr = dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mi;
  var status = (s.approval_status === 'approved') ? 'Selesai' : 'Pending';

  // BITU3926 group subtotals
  var prjPI   = fn(parseFloat(o.prj1||0) + parseFloat(o.prj2||0));
  var prjPF   = fn(parseFloat(o.prj3||0) + parseFloat(o.prj4||0) + parseFloat(o.lr1||0));
  var prjPres = fn(parseFloat(o.pr11||0));

  // BITU3946 group subtotals
  var tr1Sub   = fn(parseFloat(o.tr1||0));
  var presSub  = fn(parseFloat(o.pr11_pbt||0));
  var skillSub = fn(parseFloat(o.pr12||0));

  var printHTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Laporan Markah LI</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:20px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:14px}' +
    'th{padding:6px 8px;border:1px solid #333;background:#1e3a8a;color:#fff}' +
    'td{padding:5px 8px;border:1px solid #333}' +
    '.cell-header{background:#f0f4ff;font-weight:600;width:35%}' +
    '.cell-group{vertical-align:middle;font-weight:600;background:#f8f8f8}' +
    '.cell-num{text-align:right}' +
    '.cell-jumlah{text-align:right;vertical-align:middle;font-weight:600}' +
    '.row-total td{background:#0f2560;color:#fff;font-weight:700;padding:6px 8px;border:1px solid #0f2560}' +
    '.section-title{font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:5px;border-left:4px solid #1e3a8a;padding-left:8px}' +
    '@media print{body{margin:10mm}}' +
    '</style></head><body>' +
    '<div style="max-width:720px;margin:0 auto">' +

    // Header
    '<div style="text-align:center;margin-bottom:14px;border-bottom:2px solid #1e3a8a;padding-bottom:10px">' +
      '<div style="font-size:15px;font-weight:700;color:#1e3a8a">Universiti Teknikal Malaysia Melaka (UTeM)</div>' +
      '<div style="font-size:13px;font-weight:600;margin-top:3px">Fakulti Teknologi Maklumat Dan Komunikasi</div>' +
      '<div style="font-size:14px;font-weight:700;margin-top:8px;text-transform:uppercase;letter-spacing:0.04em">Laporan Markah Latihan Industri</div>' +
    '</div>' +

    // Student info
    '<table>' +
      '<tr><td class="cell-header">Nama Pelajar</td><td>' + fv(s.name) + '</td></tr>' +
      '<tr><td class="cell-header">No. Matrik</td><td>' + fv(s.matric_no) + '</td></tr>' +
      '<tr><td class="cell-header">Kursus</td><td>' + fv(s.kursus) + '</td></tr>' +
      '<tr><td class="cell-header">Semester</td><td>' + fv(s.semester) + '</td></tr>' +
      '<tr><td class="cell-header">Sesi</td><td>' + fv(s.sesi) + '</td></tr>' +
      '<tr><td class="cell-header">Penyelia LI (SVF)</td><td>' + fv(svfName) + '</td></tr>' +
      '<tr><td class="cell-header">Penyelia Fakulti</td><td>' + fv(svfName) + '</td></tr>' +
      '<tr><td class="cell-header">Organisasi</td><td>' + fv(s.organisasi) + '</td></tr>' +
      '<tr><td class="cell-header">Penyelia Industri</td><td>' + fv(sviName) + '</td></tr>' +
    '</table>' +

    // Section A — BITU3926
    '<div class="section-title">A. BITU3926 &mdash; Latihan Industri</div>' +
    '<table>' +
      '<thead><tr>' +
        '<th style="text-align:left;width:28%">Penilaian</th>' +
        '<th style="text-align:left">Komponen</th>' +
        '<th style="text-align:right;width:13%">Markah</th>' +
        '<th style="text-align:right;width:13%">Jumlah</th>' +
      '</tr></thead>' +
      '<tbody>' +
        '<tr>' +
          '<td rowspan="2" class="cell-group">Penyelia Industri<br><span style="font-weight:400;font-size:11px">(30%)</span></td>' +
          '<td>PRJ-1 (PI 15%)</td>' +
          '<td class="cell-num">' + fn(o.prj1) + '</td>' +
          '<td rowspan="2" class="cell-jumlah">' + prjPI + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td>PRJ-2 (PI 15%)</td>' +
          '<td class="cell-num">' + fn(o.prj2) + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td rowspan="3" class="cell-group">Penyelia Fakulti<br><span style="font-weight:400;font-size:11px">(50%)</span></td>' +
          '<td>PRJ-3 (PF 15%)</td>' +
          '<td class="cell-num">' + fn(o.prj3) + '</td>' +
          '<td rowspan="3" class="cell-jumlah">' + prjPF + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td>PRJ-4 (PF 15%)</td>' +
          '<td class="cell-num">' + fn(o.prj4) + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td>LR1 &mdash; Log Report (20%)</td>' +
          '<td class="cell-num">' + fn(o.lr1) + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td rowspan="2" class="cell-group">Pembentangan<br><span style="font-weight:400;font-size:11px">(20%)</span></td>' +
          '<td>PR1-1 Presentation PI (10%)</td>' +
          '<td class="cell-num">' + fn(o.pr11_svib) + '</td>' +
          '<td rowspan="2" class="cell-jumlah">' + prjPres + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td>PR1-1 Presentation PF (10%)</td>' +
          '<td class="cell-num">' + fn(o.pr11_svfb) + '</td>' +
        '</tr>' +
      '</tbody>' +
      '<tfoot>' +
        '<tr class="row-total">' +
          '<td colspan="3">Jumlah Keseluruhan BITU3926</td>' +
          '<td style="text-align:right">' + fn(o.b3926) + '</td>' +
        '</tr>' +
        '<tr class="row-total">' +
          '<td colspan="3">Gred BITU3926</td>' +
          '<td style="text-align:right">' + fv(o.g3926) + '</td>' +
        '</tr>' +
      '</tfoot>' +
    '</table>' +

    // Section B — BITU3946
    '<div class="section-title">B. BITU3946 &mdash; Laporan Latihan Industri</div>' +
    '<table>' +
      '<thead><tr>' +
        '<th style="text-align:left;width:28%">Penilaian</th>' +
        '<th style="text-align:left">Komponen</th>' +
        '<th style="text-align:right;width:13%">Markah</th>' +
        '<th style="text-align:right;width:13%">Jumlah</th>' +
      '</tr></thead>' +
      '<tbody>' +
        '<tr>' +
          '<td rowspan="3" class="cell-group">Laporan<br><span style="font-weight:400;font-size:11px">(70%)</span></td>' +
          '<td>TR1 &mdash; LI Report</td>' +
          '<td class="cell-num">' + fn(parseFloat(o.tr1_lapa||0) + parseFloat(o.tr1_lapb||0)) + '</td>' +
          '<td rowspan="3" class="cell-jumlah">' + tr1Sub + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td>Buku Log (10%)</td>' +
          '<td class="cell-num">' + fn(o.tr1_logc) + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td>Komitmen (10%)</td>' +
          '<td class="cell-num">' + fn(o.tr1_svfc) + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td rowspan="2" class="cell-group">Pembentangan<br><span style="font-weight:400;font-size:11px">(20%)</span></td>' +
          '<td>Presentation PF (10%)</td>' +
          '<td class="cell-num">' + fn(parseFloat(o.psvfT||0) / 10) + '</td>' +
          '<td rowspan="2" class="cell-jumlah">' + presSub + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td>Presentation PI (10%)</td>' +
          '<td class="cell-num">' + fn(parseFloat(o.psviT||0) / 10) + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td class="cell-group">Soft Skills<br><span style="font-weight:400;font-size:11px">(10%)</span></td>' +
          '<td>Soft Skills (10%)</td>' +
          '<td class="cell-num">' + fn(o.pr12) + '</td>' +
          '<td class="cell-jumlah">' + skillSub + '</td>' +
        '</tr>' +
      '</tbody>' +
      '<tfoot>' +
        '<tr class="row-total">' +
          '<td colspan="3">Jumlah Keseluruhan BITU3946</td>' +
          '<td style="text-align:right">' + fn(o.b3946) + '</td>' +
        '</tr>' +
        '<tr class="row-total">' +
          '<td colspan="3">Gred BITU3946</td>' +
          '<td style="text-align:right">' + fv(o.g3946) + '</td>' +
        '</tr>' +
      '</tfoot>' +
    '</table>' +

    // Footer
    '<div style="border-top:1px solid #ccc;padding-top:8px;font-size:11px;color:#555;display:flex;justify-content:space-between">' +
      '<span>Status: <strong>' + status + '</strong> | Dijana pada: ' + dateStr + '</span>' +
      '<span>Sistem Pengurusan LI &mdash; FTMK UTeM</span>' +
    '</div>' +
    '</div>' +
    '</body></html>';

  var newWin = window.open('', '_blank');
  if (!newWin) { alert('Sila benarkan pop-up untuk mencetak laporan.'); return; }
  newWin.document.write(printHTML);
  newWin.document.close();
  newWin.print();
  newWin.close();
}

function exportLaporanExcel() {
  if (!_laporanFiltered.length) { alert('Tiada data untuk dieksport.'); return; }
  if (typeof XLSX === 'undefined') { alert('XLSX library tidak dimuatkan.'); return; }

  function svfN(s) { return s.svf_name || (_laporanPensyarahMap[s.svf_email] || s.svf_email || '—'); }

  // Sheet 1: Ringkasan
  var s1 = [['Bil','Nama','No. Matrik','Kursus','Sem','Sesi','SVF','BITU3926','Gred 3926','BITU3946','Gred 3946','Status']];
  _laporanFiltered.forEach(function(s, i) {
    var o = s._obe || {};
    s1.push([i + 1, s.name || '', s.matric_no || '', s.kursus || '', s.semester || '', s.sesi || '',
      svfN(s), o.b3926 || 0, o.g3926 || '—', o.b3946 || 0, o.g3946 || '—',
      s.approval_status === 'approved' ? 'Selesai' : 'Pending']);
  });

  // Sheet 2: Markah Terperinci
  var s2 = [['Bil','Nama','No. Matrik','Kursus','Sem','Sesi','SVF',
    'PRJ1','PRJ2','PRJ3','PRJ4','LR1','PR1_PI','PR1_PF','Jumlah_3926','Gred_3926',
    'TR1','Buku Log','Komitmen','Presentation_PF','Presentation_PI','Soft Skills','Jumlah_3946','Gred_3946']];
  _laporanFiltered.forEach(function(s, i) {
    var o = s._obe || {};
    s2.push([i + 1, s.name || '', s.matric_no || '', s.kursus || '', s.semester || '', s.sesi || '', svfN(s),
      o.prj1 || 0, o.prj2 || 0, o.prj3 || 0, o.prj4 || 0, o.lr1 || 0,
      o.pr11_svib || 0, o.pr11_svfb || 0, o.b3926 || 0, o.g3926 || '—',
      o.tr1 || 0, o.tr1_logc || 0, o.tr1_svfc || 0, o.psvfT || 0, o.psviT || 0,
      o.pr12 || 0, o.b3946 || 0, o.g3946 || '—']);
  });

  // Sheet 3: BITU3926
  var s3 = [['Bil','Nama','No. Matrik','Kursus','SVF',
    'PRJ-1 (15%)','PRJ-2 (15%)','PRJ-3 (15%)','PRJ-4 (15%)','LR-1 (20%)','Presentation (20%)','Jumlah','Gred']];
  _laporanFiltered.forEach(function(s, i) {
    var o = s._obe || {};
    s3.push([i + 1, s.name || '', s.matric_no || '', s.kursus || '', svfN(s),
      o.prj1 || 0, o.prj2 || 0, o.prj3 || 0, o.prj4 || 0, o.lr1 || 0, o.pr11 || 0,
      o.b3926 || 0, o.g3926 || '—']);
  });

  // Sheet 4: BITU3946
  var s4 = [['Bil','Nama','No. Matrik','Kursus','SVF',
    'TR-1 (70%)','PR1-1 (20%)','PR1-2 (10%)','Jumlah','Gred']];
  _laporanFiltered.forEach(function(s, i) {
    var o = s._obe || {};
    s4.push([i + 1, s.name || '', s.matric_no || '', s.kursus || '', svfN(s),
      o.tr1 || 0, o.pr11_pbt || 0, o.pr12 || 0, o.b3946 || 0, o.g3946 || '—']);
  });

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s1), 'Ringkasan');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s2), 'Markah Terperinci');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s3), 'BITU3926');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s4), 'BITU3946');
  var dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, 'Laporan_LI_' + dateStr + '.xlsx');
}
// ===== END LAPORAN =====

// ===== STATUS PENSYARAH =====
var _spPensyarahList = [];
var _spStudentsMap   = {};
var _spOpenIdx       = -1;

async function loadStatusPensyarah() {
  var listEl = document.getElementById('sp-list');
  if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text3)">Memuatkan...</div>';
  try {
    var results = await Promise.all([
      sb.from('users').select('full_name, email').contains('roles', ['PENSYARAH']).order('full_name'),
      sb.from('students').select('id, matric_no, name, kursus, semester, sesi, svf_email, approval_status').order('name')
    ]);
    var pensyarahList = results[0].data || [];
    var students      = results[1].data || [];

    students.forEach(function(s) {
      s._selesai = (s.approval_status === 'approved');
    });

    _spStudentsMap = {};
    students.forEach(function(s) {
      var email = s.svf_email || '';
      if (!_spStudentsMap[email]) _spStudentsMap[email] = [];
      _spStudentsMap[email].push(s);
    });

    _spPensyarahList = pensyarahList;
    _spOpenIdx       = -1;
    renderStatusPensyarah();
  } catch (err) {
    console.error('loadStatusPensyarah error:', err);
    var listEl2 = document.getElementById('sp-list');
    if (listEl2) listEl2.innerHTML = '<div style="text-align:center;padding:1.5rem;color:red">Ralat memuatkan data. Sila muat semula halaman.</div>';
  }
}

function renderStatusPensyarah() {
  var listEl = document.getElementById('sp-list');
  if (!listEl) return;
  if (!_spPensyarahList.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text3)">Tiada pensyarah dalam sistem.</div>';
    return;
  }
  var html = '';
  _spPensyarahList.forEach(function(p, idx) {
    var students  = _spStudentsMap[p.email] || [];
    var total     = students.length;
    var selesai   = students.filter(function(s) { return s._selesai; }).length;
    var pct       = total > 0 ? Math.round(selesai / total * 100) : 0;
    var allSelesai = (total > 0 && selesai === total);
    var badge     = allSelesai
      ? '<span class="sp-badge sp-badge-selesai">&#10003; Selesai</span>'
      : '<span class="sp-badge sp-badge-pending">&#9203; Ada Pending</span>';
    var isOpen    = (_spOpenIdx === idx);
    var safeEmail = escHtml(p.email);

    html +=
      '<div class="sp-group' + (isOpen ? ' sp-group-open' : '') + '">' +
        '<div class="sp-group-header" onclick="toggleSPGroup(' + idx + ')">' +
          '<div class="sp-group-info">' +
            '<div class="sp-group-name">' + escHtml(p.full_name) + '</div>' +
            '<div class="sp-group-count">' + selesai + '/' + total + ' selesai</div>' +
          '</div>' +
          '<div class="sp-group-right">' +
            '<div class="sp-progress-wrap">' +
              '<div class="sp-progress-bar"><div class="sp-progress-fill" style="width:' + pct + '%"></div></div>' +
              '<span class="sp-pct-label">' + pct + '%</span>' +
            '</div>' +
            badge +
            '<button class="btn-secondary sp-copy-btn" onclick="event.stopPropagation();copySPEmail(\'' + safeEmail + '\', this)">&#128203; Copy Email</button>' +
            '<span class="sp-chevron">' + (isOpen ? '&#9650;' : '&#9660;') + '</span>' +
          '</div>' +
        '</div>';

    if (isOpen) {
      var pending = students.filter(function(s) { return !s._selesai; });
      var done    = students.filter(function(s) { return s._selesai; });
      html += '<div class="sp-group-body">';
      if (pending.length > 0) {
        html += '<div class="sp-group-section-label sp-label-pending">&#9203; PENDING (' + pending.length + ')</div>';
        html += renderSPStudentRows(pending);
      }
      if (done.length > 0) {
        html += '<div class="sp-group-section-label sp-label-selesai">&#9745; SELESAI (' + done.length + ')</div>';
        html += renderSPStudentRows(done);
      }
      if (total === 0) {
        html += '<div style="padding:1rem 1.25rem;color:var(--text3);text-align:center">Tiada pelajar ditugaskan.</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  });
  listEl.innerHTML = html;
}

function renderSPStudentRows(students) {
  var html =
    '<div class="table-wrap" style="margin:0;border-radius:0">' +
    '<table class="data-table" style="border-radius:0">' +
    '<thead><tr><th>#</th><th>Nama</th><th>No. Matrik</th><th>Kursus</th><th>Sem / Sesi</th><th>Status</th></tr></thead>' +
    '<tbody>';
  students.forEach(function(s, i) {
    var badge = s._selesai
      ? '<span class="status-badge status-active">Selesai</span>'
      : '<span class="status-badge status-inactive">Pending</span>';
    html += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + escHtml(s.name || '') + '</td>' +
      '<td>' + escHtml(s.matric_no || '') + '</td>' +
      '<td>' + escHtml(s.kursus || '') + '</td>' +
      '<td>' + escHtml((s.semester ? String(s.semester) : '—') + ' / ' + (s.sesi || '—')) + '</td>' +
      '<td>' + badge + '</td>' +
      '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function toggleSPGroup(idx) {
  _spOpenIdx = (_spOpenIdx === idx) ? -1 : idx;
  renderStatusPensyarah();
}

function copySPEmail(email, btnEl) {
  var origText = btnEl.innerHTML;
  function showCopied() {
    btnEl.innerHTML = '&#10003; Copied!';
    btnEl.classList.add('sp-copy-btn-success');
    setTimeout(function() {
      btnEl.innerHTML = origText;
      btnEl.classList.remove('sp-copy-btn-success');
    }, 1500);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(showCopied).catch(function() {
      fallbackCopy(email);
      showCopied();
    });
  } else {
    fallbackCopy(email);
    showCopied();
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}
// ===== END STATUS PENSYARAH =====

initAuth();
