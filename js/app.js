// ===== SUPABASE CONFIG =====
var SUPABASE_URL = 'https://lvbtzoqkgmjztolwdchi.supabase.co';
var SUPABASE_KEY = 'sb_publishable_ChFCyvoYGVutAaFdwKZbtA_bq0P3DAR';
var sb = null;

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
    var resp = await sb.from('users')
      .select('email, full_name, roles, is_active, password_hash')
      .eq('email', email)
      .single();

    var user = resp.data;
    if (resp.error || !user || user.password_hash !== pass || user.is_active === false) {
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
}

function applyRoleRestrictions(roles) {
  var eff = getEffectiveRole(roles);
  // Always reset management sidebar items to hidden first
  ['admin-sep', 'admin-label', 'admin-nav-item', 'uruspelajar-nav-item', 'uruspensyarah-nav-item'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (eff === 'ADMIN') {
    ['admin-sep', 'admin-label', 'admin-nav-item', 'uruspelajar-nav-item', 'uruspensyarah-nav-item'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
    return;
  }
  if (eff === 'AJK_LI') {
    ['admin-sep', 'admin-label', 'uruspelajar-nav-item', 'uruspensyarah-nav-item'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
    return;
  }
  if (eff === 'PENSYARAH') {
    document.querySelectorAll('.btn-danger').forEach(function(btn) {
      btn.classList.add('hidden-by-role');
    });
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
// ===== END SIDEBAR TOGGLE =====

var pilihan = 1, hadir = 1;

var TAB_TITLES = {
  info: 'Maklumat Pelajar',
  svi: 'Penyelia Industri (SVI)',
  svf: 'Penyelia Fakulti (SVF)',
  logbook: 'e-Logbook',
  presentation: 'Pembentangan',
  report: 'Laporan LI',
  summary: 'Ringkasan & Gred',
  usermgmt: 'Pengurusan Pengguna',
  uruspelajar: 'Urus Pelajar',
  uruspensyarah: 'Urus Pensyarah'
};

function showTab(t) {
  document.querySelectorAll('.nav-item[data-tab]').forEach(function(el) {
    el.classList.toggle('active', el.getAttribute('data-tab') === t);
  });
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('page-' + t).classList.add('active');
  document.getElementById('topbar-title').textContent = TAB_TITLES[t] || t;
  if (t === 'summary') calcSummary();
  if (t === 'usermgmt') loadUserMgmt();
  if (t === 'uruspelajar') loadUruspelajar();
  if (t === 'uruspensyarah') loadUruspensyarah();
  closeSidebar();
  window.scrollTo(0, 0);
}

function clamp(el, max) { var vv = parseInt(el.value); if (isNaN(vv) || vv < 0) el.value = 0; else if (vv > max) el.value = max; }
function selectPilihan(n) { pilihan = n; document.getElementById("opt-p1").classList.toggle("selected", n === 1); document.getElementById("opt-p2").classList.toggle("selected", n === 2); document.getElementById("rep_p1_wrap").style.display = n === 1 ? "" : "none"; document.getElementById("rep_p2_wrap").style.display = n === 2 ? "" : "none"; document.getElementById("pilihan-note").innerHTML = "Menggunakan <strong>Pilihan " + n + "</strong> &mdash; " + (n === 1 ? "Tugasan Teknikal 80% (max 40m) + Pentadbiran 20% (max 10m)" : "Tugasan Teknikal 60% (max 30m) + Pentadbiran 40% (max 20m)"); calcReport(); scheduleSave(); }
function selectHadir(n) { hadir = n; document.getElementById("opt-hadir").classList.toggle("selected", n === 1); document.getElementById("opt-thadir").classList.toggle("selected", n === 0); scheduleSave(); }
function selectR(id, val, el) { document.getElementById(id).value = val; el.closest(".radio-group").querySelectorAll(".radio-opt").forEach(function(r) { r.classList.remove("selected"); }); el.classList.add("selected"); scheduleSave(); }
function v(id) { return Math.max(0, parseInt(document.getElementById(id).value) || 0); }
function setBar(id, val, max) { document.getElementById(id).style.width = Math.min(100, Math.round(val / max * 100)) + "%"; }
function fmt(n) { return parseFloat(n.toFixed(1)); }
function calcSVI() { var a = v("svi_a1") + v("svi_a2") + v("svi_a3") + v("svi_a4"); var b = v("svi_b1") + v("svi_b2") + v("svi_b3") + v("svi_b4") + v("svi_b5") + v("svi_b6") + v("svi_b7") + v("svi_b8") + v("svi_b9") + v("svi_b10"); document.getElementById("svi_a_total").textContent = a + " / 50"; document.getElementById("svi_b_total").textContent = b + " / 50"; document.getElementById("svi_total").textContent = (a + b) + " / 100"; setBar("svi_a_bar", a, 50); setBar("svi_b_bar", b, 50); scheduleSave(); }
function calcSVF() { var a = v("svf_a1") + v("svf_a2") + v("svf_a3") + v("svf_a4") + v("svf_a5"); var b = v("svf_b1"), c = v("svf_c1"); document.getElementById("svf_a_total").textContent = a + " / 90"; document.getElementById("svf_ab_total").textContent = (a + b) + " / 100"; document.getElementById("svf_total").textContent = (a + b + c) + " / 110"; setBar("svf_a_bar", a, 90); scheduleSave(); }
function calcLog() { var a = v("log_a1"), b = v("log_b1"), c = v("log_c1"); document.getElementById("log_a_total").textContent = a + " / 40"; document.getElementById("log_b_total").textContent = b + " / 20"; document.getElementById("log_total").textContent = (a + b + c) + " / 70"; setBar("log_a_bar", a, 40); setBar("log_b_bar", b, 20); scheduleSave(); }
function calcPres() { var svf = v("psvf_a") + v("psvf_b1") + v("psvf_b2") + v("psvf_b3") + v("psvf_b4") + v("psvf_b5") + v("psvf_c1") + v("psvf_c2") + v("psvf_c3") + v("psvf_d1") + v("psvf_d2") + v("psvf_d3") + v("psvf_d4"); var svi = v("psvi_a") + v("psvi_b1") + v("psvi_b2") + v("psvi_b3") + v("psvi_b4") + v("psvi_b5") + v("psvi_c1") + v("psvi_c2") + v("psvi_c3") + v("psvi_d1") + v("psvi_d2") + v("psvi_d3") + v("psvi_d4"); document.getElementById("psvf_total").textContent = svf + " / 100"; document.getElementById("psvi_total").textContent = svi + " / 100"; setBar("psvf_bar", svf, 100); setBar("psvi_bar", svi, 100); scheduleSave(); }
function calcReport() { var a4 = pilihan === 1 ? (v("rep_a4_tech_p1") + v("rep_a4_admin_p1")) : (v("rep_a4_tech_p2") + v("rep_a4_admin_p2")); var a = v("rep_a1") + v("rep_a2") + v("rep_a3") + a4 + v("rep_a5") + v("rep_a6") + v("rep_a7"); var b = v("rep_b1"); document.getElementById("rep_a_total").textContent = a + " / 60"; document.getElementById("rep_b_total").textContent = b + " / 10"; document.getElementById("rep_total").textContent = (a + b) + " / 70"; setBar("rep_a_bar", a, 60); scheduleSave(); }
function getGrade(m) { if (m >= 80) return { g: "A", cls: "grade-A" }; if (m >= 75) return { g: "A-", cls: "grade-A" }; if (m >= 70) return { g: "B+", cls: "grade-B" }; if (m >= 65) return { g: "B", cls: "grade-B" }; if (m >= 60) return { g: "B-", cls: "grade-B" }; if (m >= 55) return { g: "C+", cls: "grade-C" }; if (m >= 50) return { g: "C", cls: "grade-C" }; if (m >= 47) return { g: "C-", cls: "grade-C" }; if (m >= 44) return { g: "D+", cls: "grade-D" }; if (m >= 40) return { g: "D", cls: "grade-D" }; return { g: "E", cls: "grade-E" }; }
function calcSummary() { document.getElementById("s_nama").textContent = document.getElementById("nama_pelajar").value || "\u2014"; document.getElementById("s_matrik").textContent = document.getElementById("no_matrik").value || "\u2014"; document.getElementById("s_kursus").textContent = document.getElementById("kursus").value || "\u2014"; document.getElementById("s_sesi").textContent = document.getElementById("sesi").value + " Sem " + document.getElementById("semester").value; document.getElementById("s_svf").textContent = document.getElementById("svf_name").value || "\u2014"; document.getElementById("s_svi").textContent = document.getElementById("svi_name").value || "\u2014"; document.getElementById("s_org").textContent = document.getElementById("organisasi").value || "\u2014"; document.getElementById("s_svi_rating").textContent = document.getElementById("svi_rating").value || "\u2014"; document.getElementById("s_svf_rating").textContent = document.getElementById("svf_rating").value || "\u2014"; document.getElementById("s_svf_status").textContent = document.getElementById("svf_status").value || "\u2014"; var sviA = v("svi_a1") + v("svi_a2") + v("svi_a3") + v("svi_a4"); var sviB = v("svi_b1") + v("svi_b2") + v("svi_b3") + v("svi_b4") + v("svi_b5") + v("svi_b6") + v("svi_b7") + v("svi_b8") + v("svi_b9") + v("svi_b10"); var svfA = v("svf_a1") + v("svf_a2") + v("svf_a3") + v("svf_a4") + v("svf_a5"); var logT = v("log_a1") + v("log_b1") + v("log_c1"); var psvfT = v("psvf_a") + v("psvf_b1") + v("psvf_b2") + v("psvf_b3") + v("psvf_b4") + v("psvf_b5") + v("psvf_c1") + v("psvf_c2") + v("psvf_c3") + v("psvf_d1") + v("psvf_d2") + v("psvf_d3") + v("psvf_d4"); var psviT = v("psvi_a") + v("psvi_b1") + v("psvi_b2") + v("psvi_b3") + v("psvi_b4") + v("psvi_b5") + v("psvi_c1") + v("psvi_c2") + v("psvi_c3") + v("psvi_d1") + v("psvi_d2") + v("psvi_d3") + v("psvi_d4"); var a4rep = pilihan === 1 ? (v("rep_a4_tech_p1") + v("rep_a4_admin_p1")) : (v("rep_a4_tech_p2") + v("rep_a4_admin_p2")); var repT = v("rep_a1") + v("rep_a2") + v("rep_a3") + a4rep + v("rep_a5") + v("rep_a6") + v("rep_a7") + v("rep_b1"); document.getElementById("sum_svi_a").textContent = sviA; document.getElementById("sum_svi_b").textContent = sviB; document.getElementById("sum_svf_a").textContent = svfA; document.getElementById("sum_log").textContent = logT; document.getElementById("sum_rep").textContent = repT; document.getElementById("sum_psvf").textContent = psvfT; document.getElementById("sum_psvi").textContent = psviT; document.getElementById("sum_soft").textContent = sviB; var sviA1 = v("svi_a1"); var sviA23 = v("svi_a2") + v("svi_a3") + v("svi_a4"); var svfA1 = v("svf_a1"); var svfA23 = v("svf_a2") + v("svf_a3") + v("svf_a4") + v("svf_a5"); var prj1 = fmt(sviA1 / 10 * 15); var prj2 = fmt(sviA23 / 40 * 15); var prj3 = fmt(svfA1 / 10 * 15); var prj4 = fmt(svfA23 / 80 * 15); var lr1 = fmt(logT / 70 * 20); var pr11 = fmt(sviB / 50 * 20); var hm = hadir ? 10 : 0; var b3926 = fmt(prj1 + prj2 + prj3 + prj4 + lr1 + pr11 + hm); document.getElementById("r_prj1r").textContent = sviA1; document.getElementById("r_prj1").textContent = prj1; document.getElementById("r_prj2r").textContent = sviA23; document.getElementById("r_prj2").textContent = prj2; document.getElementById("r_prj3r").textContent = svfA1; document.getElementById("r_prj3").textContent = prj3; document.getElementById("r_prj4r").textContent = svfA23; document.getElementById("r_prj4").textContent = prj4; document.getElementById("r_lr1r").textContent = logT; document.getElementById("r_lr1").textContent = lr1; document.getElementById("r_pr11r").textContent = sviB; document.getElementById("r_pr11").textContent = pr11; document.getElementById("r_hadir_s").textContent = hm; document.getElementById("r_hadir_pct").textContent = hadir ? "Hadir" : "Tidak Hadir"; document.getElementById("r_hadir").textContent = hm; document.getElementById("sum_3926_total").textContent = b3926; var g1 = getGrade(b3926); var gb1 = document.getElementById("sum_3926_grade"); gb1.textContent = g1.g; gb1.className = "grade-pill " + g1.cls; var tr1 = fmt(repT / 70 * 70); var p11svf = fmt(psvfT / 100 * 10); var p11svi = fmt(psviT / 100 * 10); var pr12 = fmt(sviB / 50 * 10); var b3946 = fmt(tr1 + p11svf + p11svi + pr12); document.getElementById("r2_tr1r").textContent = repT; document.getElementById("r2_tr1").textContent = tr1; document.getElementById("r2_svfr").textContent = psvfT; document.getElementById("r2_svf").textContent = p11svf; document.getElementById("r2_svir").textContent = psviT; document.getElementById("r2_svi").textContent = p11svi; document.getElementById("r2_pr12r").textContent = sviB; document.getElementById("r2_pr12").textContent = pr12; document.getElementById("sum_3946_total").textContent = b3946; var g2 = getGrade(b3946); var gb2 = document.getElementById("sum_3946_grade"); gb2.textContent = g2.g; gb2.className = "grade-pill " + g2.cls; }
function exportCSV() { var nama = document.getElementById("nama_pelajar").value || ""; var matrik = document.getElementById("no_matrik").value || ""; var sviA = v("svi_a1") + v("svi_a2") + v("svi_a3") + v("svi_a4"); var sviB = v("svi_b1") + v("svi_b2") + v("svi_b3") + v("svi_b4") + v("svi_b5") + v("svi_b6") + v("svi_b7") + v("svi_b8") + v("svi_b9") + v("svi_b10"); var logT = v("log_a1") + v("log_b1") + v("log_c1"); var psvfT = v("psvf_a") + v("psvf_b1") + v("psvf_b2") + v("psvf_b3") + v("psvf_b4") + v("psvf_b5") + v("psvf_c1") + v("psvf_c2") + v("psvf_c3") + v("psvf_d1") + v("psvf_d2") + v("psvf_d3") + v("psvf_d4"); var psviT = v("psvi_a") + v("psvi_b1") + v("psvi_b2") + v("psvi_b3") + v("psvi_b4") + v("psvi_b5") + v("psvi_c1") + v("psvi_c2") + v("psvi_c3") + v("psvi_d1") + v("psvi_d2") + v("psvi_d3") + v("psvi_d4"); var a4rep = pilihan === 1 ? (v("rep_a4_tech_p1") + v("rep_a4_admin_p1")) : (v("rep_a4_tech_p2") + v("rep_a4_admin_p2")); var repT = v("rep_a1") + v("rep_a2") + v("rep_a3") + a4rep + v("rep_a5") + v("rep_a6") + v("rep_a7") + v("rep_b1"); var rows = [["Field", "Value"], ["Nama Pelajar", nama], ["No Matrik", matrik], ["Kursus", document.getElementById("kursus").value], ["Semester", document.getElementById("semester").value], ["Sesi", document.getElementById("sesi").value], ["SVF", document.getElementById("svf_name").value], ["SVI", document.getElementById("svi_name").value], ["Organisasi", document.getElementById("organisasi").value], ["Pilihan Tugasan", "Pilihan " + pilihan], ["Amalan Kejuruteraan", hadir ? "Hadir" : "Tidak Hadir"], ["---", "--- SVI ---"], ["SVI A1", v("svi_a1")], ["SVI A2", v("svi_a2")], ["SVI A3", v("svi_a3")], ["SVI A4", v("svi_a4")], ["SVI Bah A", sviA], ["SVI Bah B", sviB], ["SVI Total", sviA + sviB], ["SVI Penilaian", document.getElementById("svi_rating").value], ["---", "--- SVF ---"], ["SVF A1", v("svf_a1")], ["SVF A2", v("svf_a2")], ["SVF A3", v("svf_a3")], ["SVF A4", v("svf_a4")], ["SVF A5", v("svf_a5")], ["SVF B", v("svf_b1")], ["SVF Komitmen", v("svf_c1")], ["SVF Penilaian", document.getElementById("svf_rating").value], ["SVF Status", document.getElementById("svf_status").value], ["---", "--- Logbook ---"], ["Logbook Kandungan", v("log_a1")], ["Logbook Persembahan", v("log_b1")], ["Logbook Penghantaran", v("log_c1")], ["Logbook Total", logT], ["---", "--- Pembentangan ---"], ["Pembentangan SVF", psvfT], ["Pembentangan SVI", psviT], ["---", "--- Laporan LI ---"], ["Laporan LI Total", repT], ["---", "--- Gred Akhir ---"], ["BITU3926 Markah", document.getElementById("sum_3926_total").textContent], ["BITU3926 Gred", document.getElementById("sum_3926_grade").textContent], ["BITU3946 Markah", document.getElementById("sum_3946_total").textContent], ["BITU3946 Gred", document.getElementById("sum_3946_grade").textContent]]; var csv = rows.map(function(r) { return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"); var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "LI_" + (matrik || "pelajar") + "_" + new Date().toISOString().slice(0, 10) + ".csv"; a.click(); }
function resetAll() { if (!confirm("Reset semua data? Tindakan ini tidak boleh diundo.")) return; document.querySelectorAll("input[type=number]").forEach(function(i) { i.value = 0; }); document.querySelectorAll("input[type=text]").forEach(function(i) { i.value = ""; }); document.querySelectorAll("textarea").forEach(function(i) { i.value = ""; }); document.querySelectorAll("select").forEach(function(i) { i.selectedIndex = 0; }); document.querySelectorAll("input[type=hidden]").forEach(function(i) { i.value = ""; }); document.querySelectorAll(".radio-opt").forEach(function(i) { i.classList.remove("selected"); }); pilihan = 1; hadir = 1; document.getElementById("opt-p1").classList.add("selected"); document.getElementById("opt-hadir").classList.add("selected"); document.getElementById("rep_p1_wrap").style.display = ""; document.getElementById("rep_p2_wrap").style.display = "none"; calcSVI(); calcSVF(); calcLog(); calcPres(); calcReport(); showTab("info"); currentStudentId = null; setSaveStatus(''); }

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

function collectSections() {
  return {
    svi: {
      a1: gVal('svi_a1'), a2: gVal('svi_a2'), a3: gVal('svi_a3'), a4: gVal('svi_a4'),
      b1: gVal('svi_b1'), b2: gVal('svi_b2'), b3: gVal('svi_b3'), b4: gVal('svi_b4'),
      b5: gVal('svi_b5'), b6: gVal('svi_b6'), b7: gVal('svi_b7'), b8: gVal('svi_b8'),
      b9: gVal('svi_b9'), b10: gVal('svi_b10'),
      ulasan: gVal('svi_ulasan'), rating: gVal('svi_rating')
    },
    svf: {
      a1: gVal('svf_a1'), a2: gVal('svf_a2'), a3: gVal('svf_a3'), a4: gVal('svf_a4'), a5: gVal('svf_a5'),
      b1: gVal('svf_b1'), c1: gVal('svf_c1'),
      ulasan: gVal('svf_ulasan'), rating: gVal('svf_rating'), status: gVal('svf_status')
    },
    logbook: {
      a1: gVal('log_a1'), b1: gVal('log_b1'), c1: gVal('log_c1')
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
      psvi_d1: gVal('psvi_d1'), psvi_d2: gVal('psvi_d2'), psvi_d3: gVal('psvi_d3'), psvi_d4: gVal('psvi_d4')
    },
    report: {
      a1: gVal('rep_a1'), a2: gVal('rep_a2'), a3: gVal('rep_a3'),
      a4_tech_p1: gVal('rep_a4_tech_p1'), a4_admin_p1: gVal('rep_a4_admin_p1'),
      a4_tech_p2: gVal('rep_a4_tech_p2'), a4_admin_p2: gVal('rep_a4_admin_p2'),
      a5: gVal('rep_a5'), a6: gVal('rep_a6'), a7: gVal('rep_a7'), b1: gVal('rep_b1'),
      ulasan: gVal('rep_ulasan'), pilihan: pilihan
    },
    meta: { hadir: hadir }
  };
}

function populateSection(section, data) {
  if (!data) return;
  var fieldMap = {
    svi: ['a1','a2','a3','a4','b1','b2','b3','b4','b5','b6','b7','b8','b9','b10'],
    svf: ['a1','a2','a3','a4','a5','b1','c1'],
    logbook: ['a1','b1','c1']
  };

  if (section === 'svi') {
    fieldMap.svi.forEach(function(k) { var el = document.getElementById('svi_' + k); if (el && data[k] !== undefined) el.value = data[k]; });
    if (data.ulasan !== undefined) { var el = document.getElementById('svi_ulasan'); if (el) el.value = data.ulasan; }
    if (data.rating) { var el = document.getElementById('svi_rating'); if (el) el.value = data.rating; }
    calcSVI();
  } else if (section === 'svf') {
    fieldMap.svf.forEach(function(k) { var el = document.getElementById('svf_' + k); if (el && data[k] !== undefined) el.value = data[k]; });
    if (data.ulasan !== undefined) { var el = document.getElementById('svf_ulasan'); if (el) el.value = data.ulasan; }
    if (data.rating) { var el = document.getElementById('svf_rating'); if (el) el.value = data.rating; }
    if (data.status) { var el = document.getElementById('svf_status'); if (el) el.value = data.status; }
    calcSVF();
  } else if (section === 'logbook') {
    fieldMap.logbook.forEach(function(k) { var el = document.getElementById('log_' + k); if (el && data[k] !== undefined) el.value = data[k]; });
    calcLog();
  } else if (section === 'presentation') {
    Object.keys(data).forEach(function(k) { var el = document.getElementById(k); if (el && data[k] !== undefined) el.value = data[k]; });
    calcPres();
  } else if (section === 'report') {
    ['a1','a2','a3','a4_tech_p1','a4_admin_p1','a4_tech_p2','a4_admin_p2','a5','a6','a7','b1'].forEach(function(k) {
      var el = document.getElementById('rep_' + k); if (el && data[k] !== undefined) el.value = data[k];
    });
    if (data.ulasan !== undefined) { var el = document.getElementById('rep_ulasan'); if (el) el.value = data.ulasan; }
    if (data.pilihan) { pilihan = parseInt(data.pilihan) || 1; selectPilihan(pilihan); }
    calcReport();
  } else if (section === 'meta') {
    if (data.hadir !== undefined) {
      hadir = parseInt(data.hadir);
      document.getElementById('opt-hadir').classList.toggle('selected', hadir === 1);
      document.getElementById('opt-thadir').classList.toggle('selected', hadir === 0);
    }
  }
}

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
    var upserts = Object.keys(sections).map(function(sec) {
      return {
        student_id:      currentStudentId,
        evaluator_email: session.email,
        section:         sec,
        data:            sections[sec],
        updated_at:      now
      };
    });

    var mResp = await sb.from('marks')
      .upsert(upserts, { onConflict: 'student_id,section' });

    if (mResp.error) throw mResp.error;
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

    // Populate student info fields
    document.getElementById('nama_pelajar').value = student.name || '';
    document.getElementById('kursus').value       = student.kursus || '';
    document.getElementById('semester').value     = student.semester || '';
    document.getElementById('sesi').value         = student.sesi || '';
    document.getElementById('organisasi').value   = student.organisasi || '';
    document.getElementById('svf_name').value     = student.svf_name || '';
    document.getElementById('svi_name').value     = student.svi_name || '';

    // Load marks (suppress auto-save while populating form)
    var mResp = await sb.from('marks').select('section,data').eq('student_id', student.id);
    if (!mResp.error && mResp.data) {
      _suppressSave = true;
      mResp.data.forEach(function(row) { populateSection(row.section, row.data); });
      _suppressSave = false;
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
  var users = resp.data;
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
  if (document.getElementById('um-add-r-psy').checked)   roles.push('PENSYARAH');
  if (!roles.length) {
    errEl.textContent = 'Pilih sekurang-kurangnya satu peranan.'; errEl.style.display = 'block'; return;
  }

  var resp = await sb.from('users').insert({
    full_name: name, email: email, password_hash: pw, roles: roles, is_active: true
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
  document.getElementById('um-add-r-psy').checked   = true;
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
  var resp = await sb.from('users').update({ password_hash: pw }).eq('email', email);
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
  for (var i = 0; i < _uploadPensyarahRows.length; i++) {
    var r = _uploadPensyarahRows[i];
    if (r._status === 'invalid')                        { skipped++; continue; }
    if (r._status === 'konflik' && !includeConflicts)   { skipped++; continue; }
    var resp = await sb.from('users').upsert({
      full_name: r.full_name, no_staf: r.no_staf, jabatan: r.jabatan,
      email: r.email, password_hash: 'utem1234', roles: ['PENSYARAH'], is_active: true
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

async function loadUruspelajar() {
  var tbody = document.getElementById('pelajar-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1.5rem">Memuatkan...</td></tr>';

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
  var query = sb.from('students').select('id, matric_no, name, kursus, svf_email').order('name');
  if (eff === 'PENSYARAH' && session) {
    query = query.eq('svf_email', session.email);
  }
  var stResp = await query;
  if (stResp.error) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;padding:1.5rem">Ralat memuatkan data.</td></tr>';
    return;
  }
  var students = stResp.data || [];

  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1.5rem">Tiada pelajar. Muat naik senarai pelajar terlebih dahulu.</td></tr>';
    return;
  }

  var html = '';
  students.forEach(function(s) {
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
    html += '<tr>' +
      '<td style="text-align:center"><input type="checkbox" class="student-checkbox" value="' + mid + '"></td>' +
      '<td>' + mid + '</td>' +
      '<td>' + escHtml(s.name || '') + '</td>' +
      '<td style="font-size:12.5px">' + escHtml(s.kursus || '') + '</td>' +
      '<td>' + svfBadge + '</td>' +
      '<td><select class="svf-assign-select" onchange="assignSVF(\'' + mid + '\',this.value)" style="font-size:12px;padding:4px 6px;border:var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);font-family:inherit;max-width:220px">' + opts + '</select></td>' +
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
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1.5rem">Tiada pensyarah.</td></tr>';
    return;
  }
  var html = '';
  rows.forEach(function(u) {
    var isActive = u.is_active !== false;
    var eid = escHtml(u.email);
    html += '<tr>' +
      '<td>' + escHtml(u.full_name || '') + '</td>' +
      '<td>' + escHtml(u.no_staf || '') + '</td>' +
      '<td>' + escHtml(u.jabatan || '') + '</td>' +
      '<td style="font-size:12px">' + eid + '</td>' +
      '<td><span class="status-badge ' + (isActive ? 'status-active' : 'status-inactive') + '">' + (isActive ? 'Aktif' : 'Tidak Aktif') + '</span></td>' +
      '<td><div class="um-actions">' +
        '<button class="btn-sm btn-sm-edit" onclick="openEpModal(\'' + eid + '\')">Edit</button>' +
        '<button class="btn-sm btn-sm-reset" onclick="openPwModal(\'' + eid + '\')">Reset PW</button>' +
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

initAuth();
