// ===== AUTH =====
var DEFAULT_USERS = [
  {email:'admin@utem.edu.my',      password:'admin123',      roles:['ADMIN'],     displayName:'Administrator',           active:true},
  {email:'ajkli@utem.edu.my',      password:'ajkli123',      roles:['AJK_LI'],    displayName:'AJK Latihan Industri',    active:true},
  {email:'pensyarah@utem.edu.my',  password:'pensyarah123',  roles:['PENSYARAH'], displayName:'Pensyarah',               active:true}
];

// Returns 'ADMIN', 'AJK_LI', or 'PENSYARAH' based on highest privilege in the roles array
function getEffectiveRole(roles) {
  if (!roles || roles.length === 0) return 'PENSYARAH';
  if (roles.indexOf('ADMIN') !== -1) return 'ADMIN';
  if (roles.indexOf('AJK_LI') !== -1) return 'AJK_LI';
  return 'PENSYARAH';
}

function initAuth() {
  // Re-seed if missing or old format (old format used 'username' not 'email')
  var stored = localStorage.getItem('li_users');
  var needReseed = !stored;
  if (!needReseed) {
    try { var u = JSON.parse(stored); if (!u[0] || !u[0].email) needReseed = true; } catch(e) { needReseed = true; }
  }
  if (needReseed) {
    localStorage.setItem('li_users', JSON.stringify(DEFAULT_USERS));
    localStorage.removeItem('li_session');
  }
  var session = getSession();
  // Discard sessions from old format (had 'username'/'role' instead of 'email'/'roles')
  if (session && (!session.email || !session.roles)) {
    localStorage.removeItem('li_session');
    session = null;
  }
  if (session) { showApp(session); }
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('li_session')); } catch(e) { return null; }
}

function doLogin() {
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  var pass  = document.getElementById('login-password').value;
  var users = JSON.parse(localStorage.getItem('li_users') || '[]');
  var user  = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].email.toLowerCase() === email && users[i].password === pass) {
      // Reject deactivated accounts
      if (users[i].active === false) { break; }
      user = users[i]; break;
    }
  }
  var errEl = document.getElementById('login-error');
  if (!user) {
    errEl.textContent = 'E-mel atau kata laluan tidak sah.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  var sess = {email: user.email, roles: user.roles, displayName: user.displayName};
  localStorage.setItem('li_session', JSON.stringify(sess));
  showApp(sess);
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
  var roleLabels = {ADMIN:'Admin', AJK_LI:'AJK LI', PENSYARAH:'Pensyarah'};

  // Sidebar user info
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
  // ADMIN — show admin sidebar items, no other restrictions
  if (eff === 'ADMIN') {
    ['admin-sep', 'admin-label', 'admin-nav-item'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
    return;
  }
  // AJK_LI — can key in marks and view/print; no user management
  if (eff === 'AJK_LI') return;
  // PENSYARAH — can key in marks; Ringkasan & Gred is view-only (hide Reset)
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

var pilihan=1,hadir=1;

var TAB_TITLES = {
  info:'Maklumat Pelajar',
  svi:'Penyelia Industri (SVI)',
  svf:'Penyelia Fakulti (SVF)',
  logbook:'e-Logbook',
  presentation:'Pembentangan',
  report:'Laporan LI',
  summary:'Ringkasan & Gred',
  usermgmt:'Pengurusan Pengguna'
};

function showTab(t) {
  // Update sidebar nav active state
  document.querySelectorAll('.nav-item[data-tab]').forEach(function(el) {
    el.classList.toggle('active', el.getAttribute('data-tab') === t);
  });
  // Show the correct page
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('page-' + t).classList.add('active');
  // Update topbar title
  document.getElementById('topbar-title').textContent = TAB_TITLES[t] || t;
  // If summary, recalculate
  if (t === 'summary') calcSummary();
  // If usermgmt, load user table
  if (t === 'usermgmt') loadUserMgmt();
  // Close sidebar on mobile
  closeSidebar();
  window.scrollTo(0, 0);
}

function clamp(el,max){var vv=parseInt(el.value);if(isNaN(vv)||vv<0)el.value=0;else if(vv>max)el.value=max;}
function selectPilihan(n){pilihan=n;document.getElementById("opt-p1").classList.toggle("selected",n===1);document.getElementById("opt-p2").classList.toggle("selected",n===2);document.getElementById("rep_p1_wrap").style.display=n===1?"":"none";document.getElementById("rep_p2_wrap").style.display=n===2?"":"none";document.getElementById("pilihan-note").innerHTML="Menggunakan <strong>Pilihan "+n+"</strong> &mdash; "+(n===1?"Tugasan Teknikal 80% (max 40m) + Pentadbiran 20% (max 10m)":"Tugasan Teknikal 60% (max 30m) + Pentadbiran 40% (max 20m)");calcReport();}
function selectHadir(n){hadir=n;document.getElementById("opt-hadir").classList.toggle("selected",n===1);document.getElementById("opt-thadir").classList.toggle("selected",n===0);}
function selectR(id,val,el){document.getElementById(id).value=val;el.closest(".radio-group").querySelectorAll(".radio-opt").forEach(function(r){r.classList.remove("selected");});el.classList.add("selected");}
function v(id){return Math.max(0,parseInt(document.getElementById(id).value)||0);}
function setBar(id,val,max){document.getElementById(id).style.width=Math.min(100,Math.round(val/max*100))+"%";}
function fmt(n){return parseFloat(n.toFixed(1));}
function calcSVI(){var a=v("svi_a1")+v("svi_a2")+v("svi_a3")+v("svi_a4");var b=v("svi_b1")+v("svi_b2")+v("svi_b3")+v("svi_b4")+v("svi_b5")+v("svi_b6")+v("svi_b7")+v("svi_b8")+v("svi_b9")+v("svi_b10");document.getElementById("svi_a_total").textContent=a+" / 50";document.getElementById("svi_b_total").textContent=b+" / 50";document.getElementById("svi_total").textContent=(a+b)+" / 100";setBar("svi_a_bar",a,50);setBar("svi_b_bar",b,50);}
function calcSVF(){var a=v("svf_a1")+v("svf_a2")+v("svf_a3")+v("svf_a4")+v("svf_a5");var b=v("svf_b1"),c=v("svf_c1");document.getElementById("svf_a_total").textContent=a+" / 90";document.getElementById("svf_ab_total").textContent=(a+b)+" / 100";document.getElementById("svf_total").textContent=(a+b+c)+" / 110";setBar("svf_a_bar",a,90);}
function calcLog(){var a=v("log_a1"),b=v("log_b1"),c=v("log_c1");document.getElementById("log_a_total").textContent=a+" / 40";document.getElementById("log_b_total").textContent=b+" / 20";document.getElementById("log_total").textContent=(a+b+c)+" / 70";setBar("log_a_bar",a,40);setBar("log_b_bar",b,20);}
function calcPres(){var svf=v("psvf_a")+v("psvf_b1")+v("psvf_b2")+v("psvf_b3")+v("psvf_b4")+v("psvf_b5")+v("psvf_c1")+v("psvf_c2")+v("psvf_c3")+v("psvf_d1")+v("psvf_d2")+v("psvf_d3")+v("psvf_d4");var svi=v("psvi_a")+v("psvi_b1")+v("psvi_b2")+v("psvi_b3")+v("psvi_b4")+v("psvi_b5")+v("psvi_c1")+v("psvi_c2")+v("psvi_c3")+v("psvi_d1")+v("psvi_d2")+v("psvi_d3")+v("psvi_d4");document.getElementById("psvf_total").textContent=svf+" / 100";document.getElementById("psvi_total").textContent=svi+" / 100";setBar("psvf_bar",svf,100);setBar("psvi_bar",svi,100);}
function calcReport(){var a4=pilihan===1?(v("rep_a4_tech_p1")+v("rep_a4_admin_p1")):(v("rep_a4_tech_p2")+v("rep_a4_admin_p2"));var a=v("rep_a1")+v("rep_a2")+v("rep_a3")+a4+v("rep_a5")+v("rep_a6")+v("rep_a7");var b=v("rep_b1");document.getElementById("rep_a_total").textContent=a+" / 60";document.getElementById("rep_b_total").textContent=b+" / 10";document.getElementById("rep_total").textContent=(a+b)+" / 70";setBar("rep_a_bar",a,60);}
function getGrade(m){if(m>=80)return{g:"A",cls:"grade-A"};if(m>=75)return{g:"A-",cls:"grade-A"};if(m>=70)return{g:"B+",cls:"grade-B"};if(m>=65)return{g:"B",cls:"grade-B"};if(m>=60)return{g:"B-",cls:"grade-B"};if(m>=55)return{g:"C+",cls:"grade-C"};if(m>=50)return{g:"C",cls:"grade-C"};if(m>=47)return{g:"C-",cls:"grade-C"};if(m>=44)return{g:"D+",cls:"grade-D"};if(m>=40)return{g:"D",cls:"grade-D"};return{g:"E",cls:"grade-E"};}
function calcSummary(){document.getElementById("s_nama").textContent=document.getElementById("nama_pelajar").value||"\u2014";document.getElementById("s_matrik").textContent=document.getElementById("no_matrik").value||"\u2014";document.getElementById("s_kursus").textContent=document.getElementById("kursus").value||"\u2014";document.getElementById("s_sesi").textContent=document.getElementById("sesi").value+" Sem "+document.getElementById("semester").value;document.getElementById("s_svf").textContent=document.getElementById("svf_name").value||"\u2014";document.getElementById("s_svi").textContent=document.getElementById("svi_name").value||"\u2014";document.getElementById("s_org").textContent=document.getElementById("organisasi").value||"\u2014";document.getElementById("s_svi_rating").textContent=document.getElementById("svi_rating").value||"\u2014";document.getElementById("s_svf_rating").textContent=document.getElementById("svf_rating").value||"\u2014";document.getElementById("s_svf_status").textContent=document.getElementById("svf_status").value||"\u2014";var sviA=v("svi_a1")+v("svi_a2")+v("svi_a3")+v("svi_a4");var sviB=v("svi_b1")+v("svi_b2")+v("svi_b3")+v("svi_b4")+v("svi_b5")+v("svi_b6")+v("svi_b7")+v("svi_b8")+v("svi_b9")+v("svi_b10");var svfA=v("svf_a1")+v("svf_a2")+v("svf_a3")+v("svf_a4")+v("svf_a5");var logT=v("log_a1")+v("log_b1")+v("log_c1");var psvfT=v("psvf_a")+v("psvf_b1")+v("psvf_b2")+v("psvf_b3")+v("psvf_b4")+v("psvf_b5")+v("psvf_c1")+v("psvf_c2")+v("psvf_c3")+v("psvf_d1")+v("psvf_d2")+v("psvf_d3")+v("psvf_d4");var psviT=v("psvi_a")+v("psvi_b1")+v("psvi_b2")+v("psvi_b3")+v("psvi_b4")+v("psvi_b5")+v("psvi_c1")+v("psvi_c2")+v("psvi_c3")+v("psvi_d1")+v("psvi_d2")+v("psvi_d3")+v("psvi_d4");var a4rep=pilihan===1?(v("rep_a4_tech_p1")+v("rep_a4_admin_p1")):(v("rep_a4_tech_p2")+v("rep_a4_admin_p2"));var repT=v("rep_a1")+v("rep_a2")+v("rep_a3")+a4rep+v("rep_a5")+v("rep_a6")+v("rep_a7")+v("rep_b1");document.getElementById("sum_svi_a").textContent=sviA;document.getElementById("sum_svi_b").textContent=sviB;document.getElementById("sum_svf_a").textContent=svfA;document.getElementById("sum_log").textContent=logT;document.getElementById("sum_rep").textContent=repT;document.getElementById("sum_psvf").textContent=psvfT;document.getElementById("sum_psvi").textContent=psviT;document.getElementById("sum_soft").textContent=sviB;var sviA1=v("svi_a1");var sviA23=v("svi_a2")+v("svi_a3")+v("svi_a4");var svfA1=v("svf_a1");var svfA23=v("svf_a2")+v("svf_a3")+v("svf_a4")+v("svf_a5");var prj1=fmt(sviA1/10*15);var prj2=fmt(sviA23/40*15);var prj3=fmt(svfA1/10*15);var prj4=fmt(svfA23/80*15);var lr1=fmt(logT/70*20);var pr11=fmt(sviB/50*20);var hm=hadir?10:0;var b3926=fmt(prj1+prj2+prj3+prj4+lr1+pr11+hm);document.getElementById("r_prj1r").textContent=sviA1;document.getElementById("r_prj1").textContent=prj1;document.getElementById("r_prj2r").textContent=sviA23;document.getElementById("r_prj2").textContent=prj2;document.getElementById("r_prj3r").textContent=svfA1;document.getElementById("r_prj3").textContent=prj3;document.getElementById("r_prj4r").textContent=svfA23;document.getElementById("r_prj4").textContent=prj4;document.getElementById("r_lr1r").textContent=logT;document.getElementById("r_lr1").textContent=lr1;document.getElementById("r_pr11r").textContent=sviB;document.getElementById("r_pr11").textContent=pr11;document.getElementById("r_hadir_s").textContent=hm;document.getElementById("r_hadir_pct").textContent=hadir?"Hadir":"Tidak Hadir";document.getElementById("r_hadir").textContent=hm;document.getElementById("sum_3926_total").textContent=b3926;var g1=getGrade(b3926);var gb1=document.getElementById("sum_3926_grade");gb1.textContent=g1.g;gb1.className="grade-pill "+g1.cls;var tr1=fmt(repT/70*70);var p11svf=fmt(psvfT/100*10);var p11svi=fmt(psviT/100*10);var pr12=fmt(sviB/50*10);var b3946=fmt(tr1+p11svf+p11svi+pr12);document.getElementById("r2_tr1r").textContent=repT;document.getElementById("r2_tr1").textContent=tr1;document.getElementById("r2_svfr").textContent=psvfT;document.getElementById("r2_svf").textContent=p11svf;document.getElementById("r2_svir").textContent=psviT;document.getElementById("r2_svi").textContent=p11svi;document.getElementById("r2_pr12r").textContent=sviB;document.getElementById("r2_pr12").textContent=pr12;document.getElementById("sum_3946_total").textContent=b3946;var g2=getGrade(b3946);var gb2=document.getElementById("sum_3946_grade");gb2.textContent=g2.g;gb2.className="grade-pill "+g2.cls;}
function exportCSV(){var nama=document.getElementById("nama_pelajar").value||"";var matrik=document.getElementById("no_matrik").value||"";var sviA=v("svi_a1")+v("svi_a2")+v("svi_a3")+v("svi_a4");var sviB=v("svi_b1")+v("svi_b2")+v("svi_b3")+v("svi_b4")+v("svi_b5")+v("svi_b6")+v("svi_b7")+v("svi_b8")+v("svi_b9")+v("svi_b10");var logT=v("log_a1")+v("log_b1")+v("log_c1");var psvfT=v("psvf_a")+v("psvf_b1")+v("psvf_b2")+v("psvf_b3")+v("psvf_b4")+v("psvf_b5")+v("psvf_c1")+v("psvf_c2")+v("psvf_c3")+v("psvf_d1")+v("psvf_d2")+v("psvf_d3")+v("psvf_d4");var psviT=v("psvi_a")+v("psvi_b1")+v("psvi_b2")+v("psvi_b3")+v("psvi_b4")+v("psvi_b5")+v("psvi_c1")+v("psvi_c2")+v("psvi_c3")+v("psvi_d1")+v("psvi_d2")+v("psvi_d3")+v("psvi_d4");var a4rep=pilihan===1?(v("rep_a4_tech_p1")+v("rep_a4_admin_p1")):(v("rep_a4_tech_p2")+v("rep_a4_admin_p2"));var repT=v("rep_a1")+v("rep_a2")+v("rep_a3")+a4rep+v("rep_a5")+v("rep_a6")+v("rep_a7")+v("rep_b1");var rows=[["Field","Value"],["Nama Pelajar",nama],["No Matrik",matrik],["Kursus",document.getElementById("kursus").value],["Semester",document.getElementById("semester").value],["Sesi",document.getElementById("sesi").value],["SVF",document.getElementById("svf_name").value],["SVI",document.getElementById("svi_name").value],["Organisasi",document.getElementById("organisasi").value],["Pilihan Tugasan","Pilihan "+pilihan],["Amalan Kejuruteraan",hadir?"Hadir":"Tidak Hadir"],["---","--- SVI ---"],["SVI A1",v("svi_a1")],["SVI A2",v("svi_a2")],["SVI A3",v("svi_a3")],["SVI A4",v("svi_a4")],["SVI Bah A",sviA],["SVI Bah B",sviB],["SVI Total",sviA+sviB],["SVI Penilaian",document.getElementById("svi_rating").value],["---","--- SVF ---"],["SVF A1",v("svf_a1")],["SVF A2",v("svf_a2")],["SVF A3",v("svf_a3")],["SVF A4",v("svf_a4")],["SVF A5",v("svf_a5")],["SVF B",v("svf_b1")],["SVF Komitmen",v("svf_c1")],["SVF Penilaian",document.getElementById("svf_rating").value],["SVF Status",document.getElementById("svf_status").value],["---","--- Logbook ---"],["Logbook Kandungan",v("log_a1")],["Logbook Persembahan",v("log_b1")],["Logbook Penghantaran",v("log_c1")],["Logbook Total",logT],["---","--- Pembentangan ---"],["Pembentangan SVF",psvfT],["Pembentangan SVI",psviT],["---","--- Laporan LI ---"],["Laporan LI Total",repT],["---","--- Gred Akhir ---"],["BITU3926 Markah",document.getElementById("sum_3926_total").textContent],["BITU3926 Gred",document.getElementById("sum_3926_grade").textContent],["BITU3946 Markah",document.getElementById("sum_3946_total").textContent],["BITU3946 Gred",document.getElementById("sum_3946_grade").textContent]];var csv=rows.map(function(r){return r.map(function(c){return'"'+String(c).replace(/"/g,'""')+'"';}).join(",");}).join("\n");var blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="LI_"+(matrik||"pelajar")+"_"+new Date().toISOString().slice(0,10)+".csv";a.click();}
function resetAll(){if(!confirm("Reset semua data? Tindakan ini tidak boleh diundo."))return;document.querySelectorAll("input[type=number]").forEach(function(i){i.value=0;});document.querySelectorAll("input[type=text]").forEach(function(i){i.value="";});document.querySelectorAll("textarea").forEach(function(i){i.value="";});document.querySelectorAll("select").forEach(function(i){i.selectedIndex=0;});document.querySelectorAll("input[type=hidden]").forEach(function(i){i.value="";});document.querySelectorAll(".radio-opt").forEach(function(i){i.classList.remove("selected");});pilihan=1;hadir=1;document.getElementById("opt-p1").classList.add("selected");document.getElementById("opt-hadir").classList.add("selected");document.getElementById("rep_p1_wrap").style.display="";document.getElementById("rep_p2_wrap").style.display="none";calcSVI();calcSVF();calcLog();calcPres();calcReport();showTab("info");}

// ===== USER MANAGEMENT =====
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem('li_users') || '[]'); } catch(e) { return []; }
}
function saveUsers(users) {
  localStorage.setItem('li_users', JSON.stringify(users));
}

function loadUserMgmt() {
  var users = getUsers();
  var session = getSession();
  var tbody = document.getElementById('um-tbody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:1.5rem">Tiada pengguna.</td></tr>';
    return;
  }
  var html = '';
  users.forEach(function(u, i) {
    var isActive = u.active !== false;
    var isSelf = session && u.email.toLowerCase() === session.email.toLowerCase();
    var rolesHtml = (u.roles || []).map(function(r) {
      return '<span class="role-badge role-' + escHtml(r) + '" style="font-size:10px;padding:2px 7px">' + escHtml(r) + '</span>';
    }).join(' ');
    html += '<tr>' +
      '<td>' + escHtml(u.displayName || '') + (isSelf ? ' <span style="font-size:10px;color:var(--text3)">(anda)</span>' : '') + '</td>' +
      '<td style="font-size:12.5px">' + escHtml(u.email) + '</td>' +
      '<td>' + rolesHtml + '</td>' +
      '<td><span class="status-badge ' + (isActive ? 'status-active' : 'status-inactive') + '">' + (isActive ? 'Aktif' : 'Tidak Aktif') + '</span></td>' +
      '<td><div class="um-actions">' +
        '<button class="btn-sm btn-sm-edit" onclick="openEditModal(' + i + ')">Edit</button>' +
        '<button class="btn-sm btn-sm-reset" onclick="openPwModal(' + i + ')">Reset PW</button>' +
        (isSelf ? '' : '<button class="btn-sm ' + (isActive ? 'btn-sm-deactivate' : 'btn-sm-activate') + '" onclick="toggleUserActive(' + i + ')">' + (isActive ? 'Nyahaktif' : 'Aktifkan') + '</button>') +
        (isSelf ? '' : '<button class="btn-sm btn-sm-del" onclick="deleteUser(' + i + ')">Hapus</button>') +
      '</div></td>' +
    '</tr>';
  });
  tbody.innerHTML = html;
}

function addUser() {
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
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].email.toLowerCase() === email) {
      errEl.textContent = 'E-mel sudah digunakan.'; errEl.style.display = 'block'; return;
    }
  }
  users.push({email: email, password: pw, roles: roles, displayName: name, active: true});
  saveUsers(users);
  // Clear form
  document.getElementById('um-add-name').value = '';
  document.getElementById('um-add-email').value = '';
  document.getElementById('um-add-pw').value = '';
  document.getElementById('um-add-r-admin').checked = false;
  document.getElementById('um-add-r-ajk').checked = false;
  document.getElementById('um-add-r-psy').checked = true;
  sucEl.textContent = 'Pengguna ' + name + ' berjaya ditambah.';
  sucEl.style.display = 'block';
  loadUserMgmt();
}

function openEditModal(idx) {
  var users = getUsers();
  var u = users[idx];
  if (!u) return;
  document.getElementById('um-edit-idx').value = idx;
  document.getElementById('um-edit-name').value = u.displayName || '';
  document.getElementById('um-edit-email').value = u.email;
  document.getElementById('um-edit-r-admin').checked = (u.roles || []).indexOf('ADMIN') !== -1;
  document.getElementById('um-edit-r-ajk').checked   = (u.roles || []).indexOf('AJK_LI') !== -1;
  document.getElementById('um-edit-r-psy').checked   = (u.roles || []).indexOf('PENSYARAH') !== -1;
  document.getElementById('um-edit-error').style.display = 'none';
  var modal = document.getElementById('um-edit-modal');
  modal.style.display = 'flex';
  modal.classList.add('open');
}

function closeEditModal() {
  var modal = document.getElementById('um-edit-modal');
  modal.style.display = 'none';
  modal.classList.remove('open');
}

function saveEditUser() {
  var idx   = parseInt(document.getElementById('um-edit-idx').value);
  var name  = document.getElementById('um-edit-name').value.trim();
  var email = document.getElementById('um-edit-email').value.trim().toLowerCase();
  var errEl = document.getElementById('um-edit-error');
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
  var users = getUsers();
  // Check email uniqueness (excluding current user)
  for (var i = 0; i < users.length; i++) {
    if (i !== idx && users[i].email.toLowerCase() === email) {
      errEl.textContent = 'E-mel sudah digunakan oleh pengguna lain.'; errEl.style.display = 'block'; return;
    }
  }
  users[idx].displayName = name;
  users[idx].email       = email;
  users[idx].roles       = roles;
  saveUsers(users);
  // Update session display name if editing self
  var session = getSession();
  if (session && session.email.toLowerCase() === users[idx].email.toLowerCase()) {
    session.displayName = name;
    session.roles = roles;
    localStorage.setItem('li_session', JSON.stringify(session));
    document.getElementById('sidebar-user-name').textContent = name;
    var eff = getEffectiveRole(roles);
    var roleLabels = {ADMIN:'Admin', AJK_LI:'AJK LI', PENSYARAH:'Pensyarah'};
    var badge = document.getElementById('sidebar-role-badge');
    badge.className = 'role-badge role-' + eff;
    badge.textContent = roleLabels[eff] || eff;
  }
  closeEditModal();
  loadUserMgmt();
}

function openPwModal(idx) {
  var users = getUsers();
  var u = users[idx];
  if (!u) return;
  document.getElementById('um-pw-idx').value = idx;
  document.getElementById('um-pw-label').textContent = 'Kata Laluan Baharu untuk ' + (u.displayName || u.email);
  document.getElementById('um-new-pw').value = '';
  document.getElementById('um-pw-error').style.display = 'none';
  var modal = document.getElementById('um-pw-modal');
  modal.style.display = 'flex';
  modal.classList.add('open');
}

function closePwModal() {
  var modal = document.getElementById('um-pw-modal');
  modal.style.display = 'none';
  modal.classList.remove('open');
}

function saveResetPw() {
  var idx = parseInt(document.getElementById('um-pw-idx').value);
  var pw  = document.getElementById('um-new-pw').value;
  var errEl = document.getElementById('um-pw-error');
  errEl.style.display = 'none';
  if (!pw || pw.length < 4) {
    errEl.textContent = 'Kata laluan mestilah sekurang-kurangnya 4 aksara.'; errEl.style.display = 'block'; return;
  }
  var users = getUsers();
  if (!users[idx]) return;
  users[idx].password = pw;
  saveUsers(users);
  closePwModal();
  loadUserMgmt();
}

function toggleUserActive(idx) {
  var users = getUsers();
  if (!users[idx]) return;
  users[idx].active = users[idx].active === false ? true : false;
  saveUsers(users);
  loadUserMgmt();
}

function deleteUser(idx) {
  var users = getUsers();
  if (!users[idx]) return;
  var u = users[idx];
  if (!confirm('Padam pengguna "' + (u.displayName || u.email) + '"? Tindakan ini tidak boleh diundo.')) return;
  users.splice(idx, 1);
  saveUsers(users);
  loadUserMgmt();
}
// ===== END USER MANAGEMENT =====

initAuth();
