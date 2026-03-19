# LI Evaluation App — UTeM FTMK
## Project Structure
- index.html — main HTML structure
- css/style.css — all styles
- js/app.js — all JavaScript logic
- supabase/schema.sql — SQL to create all Supabase tables (run once in SQL Editor)

## App Purpose
Industrial Training (Latihan Industri) evaluation form for UTeM FTMK (Fakulti Teknologi Maklumat dan Komunikasi), Universiti Teknikal Malaysia Melaka (UTeM).
Covers two courses: BITU3926 (Latihan Industri) and BITU3946 (Laporan Latihan Industri).

## Evaluation Components
- Penyelia Industri / SVI — Industry Supervisor evaluation
- Penyelia Fakulti / SVF — Faculty Supervisor evaluation
- e-Logbook — logbook assessment
- Pembentangan — presentation assessment (SVF & SVI)
- Laporan LI — industrial training report assessment
- Ringkasan & Gred — final marks summary and grade

## User Roles (IMPLEMENTED)
- A user can hold multiple roles stored as an array (e.g. `roles: ['AJK_LI', 'PENSYARAH']`)
- Effective access is the highest privilege role: ADMIN > AJK_LI > PENSYARAH
- ADMIN — full access to everything including user management panel and Urus Pelajar
- AJK_LI — can key in marks, view/print OBE reports, access Urus Pelajar; cannot manage users
- PENSYARAH — can key in marks only; Ringkasan & Gred is view-only (Reset button hidden)

## Login System (v4.0 — Supabase Backend)
- Login page (overlay) is the first thing the user sees on load
- Login identifier is **email** (type=email input)
- **Sessions stored in `li_session` (localStorage)** — only `{email, roles, displayName}` (no sensitive data)
- **Users list stored in Supabase `public.users` table** (replaces `li_users` localStorage)
- Supabase user row format: `{id, full_name, email, password_hash, roles:text[], is_active, no_staf, jabatan, created_at}`
  - `is_active: false` disables login for that account
  - `no_staf` and `jabatan` are optional fields for staff info (pensyarah)
- Default accounts seeded via `supabase/schema.sql`:
  - admin@utem.edu.my / admin123 (ADMIN)
  - ajkli@utem.edu.my / ajkli123 (AJK_LI)
  - pensyarah@utem.edu.my / pensyarah123 (PENSYARAH)
- `doLogin()` is async — queries Supabase, compares password_hash, sets session in localStorage
- Logout clears `li_session` and reloads page
- `getEffectiveRole(roles[])` resolves highest privilege from roles array
- `applyRoleRestrictions(roles[])` applies UI restrictions; always resets then re-applies on each login

## Supabase Configuration
- URL: `https://lvbtzoqkgmjztolwdchi.supabase.co`
- Key: publishable anon key (visible in app.js — internal tool, RLS disabled)
- CDN: `@supabase/supabase-js@2` via jsdelivr (no npm/build step)
- SheetJS CDN: `xlsx@0.18.5` via jsdelivr (for .xlsx/.csv upload parsing)
- Client initialized as `sb` global in `initAuth()`
- RLS disabled on all tables; anon role granted full access
- **Setup**: Run `supabase/schema.sql` once in Supabase Dashboard → SQL Editor
- **Upgrade existing DB**: The migration section at the bottom of schema.sql has `ALTER TABLE IF NOT EXISTS` statements to add new columns

## Database Tables
### `public.users`
Columns: `id` (uuid PK), `full_name`, `email` (unique), `password_hash`, `roles` (text[]), `is_active`, `no_staf`, `jabatan`, `created_at`
- Replaces `li_users` localStorage
- All user management CRUD goes through this table
- `no_staf` and `jabatan` populated via Upload Pensyarah feature

### `public.students`
Columns: `id` (uuid PK), `name`, `matric_no` (unique), `kursus`, `semester`, `sesi`, `organisasi`, `svf_name`, `svi_name`, `svf_email`, `created_at`
- Created/updated on every auto-save (upsert by `matric_no`)
- `svf_email` — links to `public.users.email` for SVF assignment in Urus Pelajar panel
- Bulk-uploadable via Urus Pelajar → Upload Pelajar

### `public.marks`
Columns: `id` (uuid PK), `student_id` (FK → students), `evaluator_email`, `section`, `data` (jsonb), `submitted_at`, `updated_at`
- `section` values: `'svi'` | `'svf'` | `'logbook'` | `'presentation'` | `'report'` | `'meta'`
- `data` is a JSON object with all field values for that section
- Unique constraint on `(student_id, section)` — one record per student per section

## Student & Marks Persistence (NEW in v4.0)
- **Auto-save**: 2-second debounce after any input change (`scheduleSave()`)
- Auto-save triggers on: all number inputs (via calc functions), all text/textarea/select fields
- `saveAll()` — async; upserts student row then upserts all 6 marks sections
- Requires `no_matrik` (matric number) to be filled before any save occurs
- **Load**: "Muat" button next to matric number field calls `loadByMatric(matric)`
  - Fetches student row + all marks sections from Supabase and populates the form
  - `_suppressSave` flag prevents spurious auto-saves during load
- Save status indicator in topbar: `● Belum disimpan` / `↑ Menyimpan...` / `✓ Tersimpan` / `✗ Ralat simpan`

## Layout (v4.6 — Contextual Sidebar Navigation)
- **Sidebar** (left, fixed 240px): dark blue (#1e3a8a), app logo/title, contextual nav menu, user name + role badge in footer
- **Topbar** (right, sticky): hamburger (mobile), page title, BITU badges, save-status indicator, logout button
- **Content area**: scrollable, renders selected page
- Mobile responsive: sidebar collapses off-screen, opens via hamburger button with overlay backdrop
- CSS variable: `--sidebar-bg: #1e3a8a`; `--sidebar-width: 240px`
- **Contextual Sidebar** — two nav states managed by `#sidebar-nav-default` and `#sidebar-nav-eval` divs:
  - **Default state** (`#sidebar-nav-default`, visible when no student selected): Dashboard + management items (Urus Pelajar, Urus Pensyarah, Pengurusan Pengguna)
  - **Eval state** (`#sidebar-nav-eval`, visible when student is selected): ← Kembali ke Dashboard, student name/matric label, divider, eval section links (Maklumat Pelajar, SVI, SVF, e-Logbook, Pembentangan, Laporan LI, Ringkasan & Gred)
  - `showEvalSidebar(student)` — switches to eval state, populates `#sidebar-student-label`
  - `showDefaultSidebar()` — switches back to default state
  - Called from `loadStudentForEval()` (shows eval) and `goBackToDashboard()` (shows default)
- Management nav items (`admin-sep`, `admin-label`, `admin-nav-item`, `uruspelajar-nav-item`, `uruspensyarah-nav-item`) are inside `#sidebar-nav-default`; shown by role in `applyRoleRestrictions()`
  - `uruspelajar-nav-item` and `uruspensyarah-nav-item` shown for ADMIN and AJK_LI
  - `admin-nav-item` shown for ADMIN only
- `info-nav-item` now lives inside `#sidebar-nav-eval`; still hidden for PENSYARAH via `applyRoleRestrictions()`

## User Management Panel (ADMIN only — IMPLEMENTED)
- Accessible via "Pengurusan Pengguna" sidebar nav item (admin-only)
- Page ID: `#page-usermgmt`
- **Users table**: shows only users with ADMIN or AJK_LI roles (PENSYARAH-only users excluded)
- **Add user form**: Nama Penuh, E-mel, Kata Laluan, Peranan checkboxes (ADMIN/AJK_LI only — PENSYARAH removed)
- **Tindakan per user** (keyed by email, not array index):
  - Edit — opens modal to change name, email, roles (async Supabase update)
  - Reset PW — opens modal to set new password, min 4 chars (async Supabase update)
  - Nyahaktif/Aktifkan — toggle `is_active` in Supabase (hidden for own account)
  - Hapus — delete from Supabase with confirmation (hidden for own account)
- Hidden inputs use `um-edit-key` and `um-pw-key` (store email) instead of old array-index `um-edit-idx`/`um-pw-idx`
- Edit modal updates session + sidebar if admin edits their own profile
- Deactivated accounts cannot log in

## Urus Pensyarah Panel (ADMIN + AJK_LI — IMPLEMENTED)
- Accessible via "Urus Pensyarah" sidebar nav item (ADMIN and AJK_LI)
- Page ID: `#page-uruspensyarah`
- **Upload Pensyarah** button:
  - Accepts .xlsx or .csv with columns: Nama Penuh, No Staf, Jabatan, Email
  - Parses with SheetJS; checks for duplicates before showing preview
  - **Duplicate detection** (see below) before confirming
  - On confirm: upserts into `public.users` with `roles: ['PENSYARAH']`, `password_hash: 'utem1234'`
  - Reports success/skipped/error count via alert
- **Tambah Pensyarah** button (manual entry):
  - Opens `add-pensyarah-modal` with fields: Nama Penuh, No Staf, Jabatan, Email (must end with @utem.edu.my), Kata Laluan (optional, default 'utem1234')
  - `openAddPensyarahModal()` / `closeAddPensyarahModal()` / `saveAddPensyarah()`
  - Inserts into `public.users` with `roles: ['PENSYARAH']`
- **Pensyarah table**: Nama Penuh, No Staf, Jabatan, Email, Status, Tindakan
  - Tindakan: Edit (opens `ep-modal` with no_staf/jabatan/email/is_active) + Reset PW (reuses `um-pw-modal`) + Padam (ADMIN only)
  - `ep-modal` — edit pensyarah modal with fields: Nama Penuh, No Staf, Jabatan, E-mel, Status checkbox
  - **Padam** (ADMIN only, hidden for own account): checks if pensyarah has assigned students
    - If students exist: shows warning with count, offers "Padam & Auto-Unassign"
    - If no students: shows simple confirmation
    - On confirm: sets `svf_email = NULL` for assigned students, then deletes from `public.users`
    - `deletePensyarah(email, name)` handles this flow
- **Search/filter**: text input filters table client-side by Nama or Jabatan; `filterPensyarah()` + `renderPensyarahTable()`

## Urus Pelajar Panel (ADMIN + AJK_LI — IMPLEMENTED)
- Accessible via "Urus Pelajar" sidebar nav item (ADMIN and AJK_LI)
- Page ID: `#page-uruspelajar`
- **Upload Pelajar** button:
  - Accepts .xlsx or .csv with columns: Nama Pelajar, No Matrik, Nama Program
  - "Nama Program" maps to `kursus` column in students table
  - **Duplicate detection** (see below) before confirming
  - On confirm: upserts into `public.students` (unique key: `matric_no`)
  - Reports success/skipped/error count via alert
- **Tambah Pelajar** button (manual entry):
  - Opens `add-pelajar-modal` with fields: Nama Pelajar, No Matrik, Nama Program (dropdown: BITC/BITD/BITM/BITI/BITS/BITE/BITZ)
  - `openAddPelajarModal()` / `closeAddPelajarModal()` / `saveAddPelajar()`
  - Inserts into `public.students`
- **Students table**: checkbox, No Matrik, Nama Pelajar, Program, SVF Ditetapkan, Tukar SVF, Tindakan (7 cols)
  - SVF Ditetapkan shows pensyarah full_name (green badge) or red "Belum Assign" badge if `svf_email` is null
  - Tukar SVF: dropdown per row populated from `public.users` where `'PENSYARAH' = ANY(roles)`; changing triggers immediate `assignSVF()` call
  - **Edit** button (ADMIN & AJK_LI only): opens `edit-pelajar-modal` with fields: Nama Pelajar, No Matrik, Nama Program (dropdown)
    - `openEditPelajarModal(idx)` — reads from `_pelajarStudentsCache[idx]`, populates and shows modal
    - `closeEditPelajarModal()` / `saveEditPelajar()` — updates `public.students WHERE id = student.id`, refreshes list
  - **Padam** button (ADMIN & AJK_LI only): confirmation dialog lists student name + matric, warns about marks deletion
    - On confirm: deletes from `public.marks` (by student_id), then from `public.students`
    - `deleteStudent(matricNo, name)` handles this flow
  - `_pelajarStudentsCache[]` — module-level array storing current students for modal reference
- **Bulk assign**: checkboxes per row + "Assign SVF Terpilih" button + bulk SVF dropdown
  - `toggleAllStudents()` selects/deselects all via header checkbox
  - `bulkAssignSVF()` updates all selected students' `svf_email` in parallel
- **PENSYARAH role**: if a PENSYARAH accesses this page, only students where `svf_email = their email` are shown (no Padam button)

## Upload Duplicate Detection (Upload Pensyarah & Upload Pelajar)
Both upload flows perform duplicate checking against Supabase before showing the preview modal:
- **Baru** (green) — no match found in existing records; will be inserted
- **Kemaskini** (amber) — exact key match (email for pensyarah, matric_no for pelajar); will be updated via upsert
- **Konflik** (red) — name matches existing record but key is different (possible duplicate data entry error)
- **Tidak Sah** (red) — invalid format (pensyarah only: invalid email); always skipped
- If any Konflik rows are detected, a warning banner appears in the preview modal with a checkbox
  "Saya faham dan ingin teruskan juga baris konflik"
- Baris konflik are **skipped by default**; checkbox must be ticked to include them
- `prepareUploadPensyarahPreview()` and `prepareUploadPelajarPreview()` — async functions that fetch existing
  records then classify each row before showing preview modal

## Navigation
- `showTab(t)` in app.js handles page switching, updates sidebar nav active state and topbar title
- `openSidebar()` / `closeSidebar()` handle mobile sidebar toggle
- Tab names: `dashboard`, `info`, `svi`, `svf`, `logbook`, `presentation`, `report`, `summary`, `usermgmt`, `uruspelajar`, `uruspensyarah`
- **Dashboard** is the new landing page for all roles (replaces `info` as default)
- `loadDashboard()` detects role and calls role-specific render function

## Dashboard (v4.2 — Enhanced Admin)

### ADMIN Dashboard
- Page: `#page-dashboard` → `#dash-admin` + `#dash-ajkli` sections (both shown for ADMIN)
- 4 stat cards (in `#dash-admin`): Total Pelajar, Total Pensyarah, Pelajar Lengkap (all 5 sections), Belum Assign SVF
- `renderAdminDashboard()` queries students, users (PENSYARAH), and marks in parallel
- Below stat cards: full AJK_LI view (progress bar + filters + student table) via `#dash-ajkli`
- ADMIN can click any student row → opens Evaluation Form for that student (same as AJK_LI)
- `loadDashboard()` for ADMIN calls both `renderAdminDashboard()` and `loadAjkliDashboard()`

### AJK_LI Dashboard
- Page: `#page-dashboard` → `#dash-ajkli` section
- Progress bar showing % completion across all students
- Filter dropdowns: by Pensyarah (SVF) and by Program
- Student table: No Matrik, Nama, Program, SVF, Status Markah (Lengkap/Belum Lengkap)
- Click row → opens Evaluation Form for that student
- `loadAjkliDashboard()`, `filterAjkliDashboard()`, `renderAjkliTable()`
- `_ajkliStudents[]` and `_ajkliPensyarahMap{}` globals cache loaded data

### PENSYARAH Dashboard
- Page: `#page-dashboard` → `#dash-pensyarah` section
- Shows only students where `svf_email = session.email`
- Table: No Matrik, Nama, Program, Nama SVI, Syarikat, Status
- Status computed from marks evaluator_email-filtered query
- Click row → triggers `openStudentEval(student)` flow
- `loadPensyarahDashboard()`, `_pensyarahDashStudents[]` global

## Student Profile Setup (v4.2)
- `openStudentEval(student)` — entry point for selecting a student from any dashboard
- For PENSYARAH and ADMIN: if `svi_name` or `organisasi` is empty → shows `#student-profile-modal`
  - Modal fields: Nama SVI, Nama Syarikat/Organisasi
  - `saveStudentProfile()` updates `public.students` then calls `loadStudentForEval()`
  - `_pendingStudentEval` global stores student while modal is open
  - `closeStudentProfileModal()` closes and clears pending
- For AJK_LI: skips modal, goes directly to `loadStudentForEval()`

## Evaluation Form (v4.2 — Enhanced Admin Context)
- `loadStudentForEval(student)` — loads student data and marks, then calls `showTab('svi')`
  - Sets `currentStudent`, `currentStudentId`, and `_currentEvalEmail` globals
  - `_currentEvalEmail` = `student.svf_email` for ADMIN/AJK_LI; `session.email` for PENSYARAH
  - Marks loaded filtered by `_currentEvalEmail` (ADMIN sees/edits the assigned SVF's marks)
  - Populates `#eval-student-bar` with read-only student info
  - Populates page-info fields via `_suppressSave` to prevent spurious saves
- `#eval-student-bar` — sticky bar in content-area showing Pelajar, Matrik, Program, SVF, SVI, Syarikat + Back button
  - Visible only when `currentStudent` is set AND in eval tabs (svi/svf/logbook/presentation/report/summary)
- `goBackToDashboard()` — clears `currentStudent`, calls `showTab('dashboard')`
- PENSYARAH role: `#info-nav-item` hidden (access eval form only via dashboard)
- Ringkasan & Gred: READ-ONLY for PENSYARAH (Reset button hidden via `btn-danger hidden-by-role`)

## Marks Persistence (v4.2 Update)
- Unique constraint on `public.marks`: `(student_id, evaluator_email, section)`
- Each evaluator can have their own marks record per section
- `_currentEvalEmail` global determines which email is used for save/load
  - ADMIN/AJK_LI: uses `student.svf_email` (or fallback to session.email if no SVF assigned)
  - PENSYARAH: uses `session.email`
- `saveAll()` upserts with `onConflict: 'student_id,evaluator_email,section'` using `_currentEvalEmail`
- `loadByMatric()` filters marks by `evaluator_email` for PENSYARAH role
- "Pelajar Lengkap" status = strict field-level validation via `isStudentComplete(marksMap)` (see below)
- **Migration**: Run the DO block in `supabase/schema.sql` migration section to update existing DB

## Confirmation Checkbox per Section (v4.5)
- Each eval section (SVI, SVF, Logbook, Pembentangan, Laporan LI) has a confirmation checkbox at the bottom
- Checkbox ID pattern: `{section}-confirm-cb` (e.g. `svi-confirm-cb`, `svf-confirm-cb`, etc.)
- Checkbox label: "Saya sahkan bahawa semua markah di atas adalah muktamad"
- Ticking OR unticking checkbox triggers **immediate save** (no 2-second debounce) via `onConfirmChange(section)`
- `onConfirmChange(section)` — calls `updateSimpanBtn(section)` then `saveAll()` immediately (clears debounce timer)
- `updateSimpanBtn(section)` — toggles sidebar badge only (Simpan button removed)
- Checkbox state saved as `confirmed: true/false` in the section's jsonb `data` field in Supabase
- When loading saved marks, checkbox state is restored by `populateSection()`
- When a section is confirmed, a green "✓" badge appears next to the section name in the sidebar nav (`{section}-confirm-badge`)
- `getCbVal(id)` helper — returns boolean checkbox value

## Strict Completion Check (v4.4 — Confirmation-Based)
- `isStudentComplete(marksMap)` — simplified to check `confirmed: true` in each section's data
  - A student is "Lengkap" only when all 5 sections (`svi`, `svf`, `logbook`, `presentation`, `report`) exist AND each has `confirmed: true`
  - Previous field-level validation removed — confirmation checkbox is the sole completion gate
- All 3 dashboards (ADMIN, AJK_LI, PENSYARAH) use `isStudentComplete()` — marks fetched with `data` column

## Auto-Save Only (v4.5 — Simpan Button Removed)
- Manual Simpan buttons have been **removed** from all 5 eval sections
- Saves happen via: (1) 2-second debounce auto-save on any input change, (2) immediate save when confirmation checkbox is ticked/unticked
- Save status indicator in topbar shows progress as usual

## Student Profile Modal Fix (v4.4)
- `openStudentEval(student)` does a direct targeted Supabase query: `select('svi_name, organisasi').eq('id', student.id)`
- Modal only shows if `svi_name` IS NULL/empty OR `organisasi` IS NULL/empty in Supabase (fresh from DB)
- Fresh `svi_name` and `organisasi` values are written back to the student object AND to `_ajkliStudents` and `_pensyarahDashStudents` local arrays immediately
- After `saveStudentProfile()`, ALL local arrays (`_ajkliStudents`, `_pensyarahDashStudents`) are updated with new svi_name/organisasi
- SVI/Org indicator (`#svi-org-indicator`) in the eval form header shows "✓ SVI: [nama] | ✓ Syarikat: [nama]" in green when both are filled
  - `#svi-indicator-name` and `#org-indicator-name` elements hold the values
  - Indicator shown by `loadStudentForEval()`, hidden by `goBackToDashboard()` and `showTab()` when not in eval tabs

## Editable SVI & Syarikat in Eval Form Header (v4.5)
- `esb-svi` and `esb-org` in `#eval-student-bar` are now `<input type="text">` fields (styled as `.esb-input`)
- A **"Kemaskini"** button (`esb-kemaskini-btn`) appears next to these fields in `#eval-student-bar`
- On click: `kemaskiniSviOrg()` saves `svi_name` and `organisasi` to `public.students WHERE id = currentStudent.id`
- Updates all local caches (`currentStudent`, `_ajkliStudents`, `_pensyarahDashStudents`) and the info-page hidden fields
- Shows inline feedback in `#esb-kemaskini-feedback`: "✓ Maklumat dikemaskini" (green) or "✗ Ralat" (red)
- Available to all roles (ADMIN, AJK_LI, PENSYARAH)
- CSS classes: `.esb-input`, `.esb-field-editable`, `.esb-kemaskini-group`, `.esb-kemaskini-btn`, `.esb-kemaskini-feedback`, `.esb-kmk-success`, `.esb-kmk-error`

## Tech Stack
- Vanilla HTML, CSS, JavaScript only (no frameworks, no build tools)
- Supabase JS v2 via CDN (`jsdelivr`) for database backend
- SheetJS (xlsx@0.18.5) via CDN for .xlsx/.csv file parsing
- Session persisted in `localStorage` (`li_session` key only)
- Hosted on GitHub Pages

## Laporan LI — Bahagian B Fields (v4.7)
- Bahagian B split into 4 separate fields (total /40, not /10):
  - `rep_b1`: Kualiti Bahasa (max 10) — Struktur ayat, Ketepatan makna/fakta, Penggunaan Bahasa Inggeris
  - `rep_b2`: Kualiti Persembahan (max 10) — Gambarajah yang sesuai dan tepat
  - `rep_b3`: Kekemasan (max 10) — Penulisan kemas, typo minimum, susun letak yang bersesuaian
  - `rep_b4`: Menepati Format Laporan (max 10) — Halaman tajuk, Penghargaan, Abstrak, Senarai kandungan, Daftar jadual/rajah/singkatan, Teks, Rujukan, Lampiran
- Jumlah Laporan LI is now /100 (Bahagian A /60 + Bahagian B /40)
- `calcReport()` sums rep_b1+rep_b2+rep_b3+rep_b4; shows /40 for Bahagian B, /100 total
- `calcSummary()` BITU3946: TR1 computed from 4 components (see TR1 Calculation below)
- `collectFormData()`, `populateSection()`, `exportCSV()` all include b1-b4

## Ringkasan & Gred — Markah Amalan Kejuruteraan Removed (v4.7)
- Amalan Kejuruteraan row removed from BITU3926 OBE table in Ringkasan & Gred
- Amalan Kejuruteraan input field removed from Maklumat Pelajar (info) page
- BITU3926 total no longer includes the +10 hadir bonus
- `calcSummary()`: `hm` variable removed; `b3926 = fmt(prj1 + prj2 + prj3 + prj4 + lr1 + pr11)`
- `selectHadir()` retained (no-op) for backward compat with saved meta data
- `populateSection('meta')` still loads hadir value silently (no UI side effects)

## SVF Bahagian A — Regrouped Fields (v4.8)
- Bahagian A fields reorganised into 3 named groups (A1, A2, A3) with subtotals per group:
  - **A1: Pengetahuan & Kemahiran** (max /30):
    - `svf_a1_admin`: Bidang Pentadbiran & Pengurusan (max /10)
    - `svf_a1_tech`: Bidang Teknikal (max /20)
    - Subtotal displayed in `#svf_a1_subtotal`
  - **A2: Kuantiti Hasil Kerja** (max /30):
    - `svf_a2_admin`: Bidang Pentadbiran & Pengurusan (max /10)
    - `svf_a2_tech`: Bidang Teknikal (max /20)
    - Subtotal displayed in `#svf_a2_subtotal`
  - **A3: Mutu Hasil Kerja** (max /30): single field `svf_a3`
  - Bahagian A Total = A1 + A2 + A3 = /90 (unchanged)
- HTML: `.score-group-header` class for group labels; `.subtotal-sub` class for group subtotals
- Old field names `svf_a1`–`svf_a5` no longer exist; replaced by new names above

## OBE Calculations — BITU3926 Full Component List (v4.10)
- **PRJ-1 (15%)** = SVI A1+A2: `(svi_a1 + svi_a2) / 30 * 15`
- **PRJ-2 (15%)** = SVI A3+A4: `(svi_a3 + svi_a4) / 20 * 15`
- **PRJ-3 (15%)** = SVF A1: `(svf_a1_admin + svf_a1_tech) / 30 * 15`
- **PRJ-4 (15%)** = SVF A2+A3: `(svf_a2_admin + svf_a2_tech + svf_a3) / 60 * 15`
- **LR1 (20%)** = e-Logbook total: `(log_a1 + log_b1 + log_c1) / 70 * 20`
- **PR1-1 (20%)** = Pembentangan (SVF Bah. B + SVI Bah. B):
  - SVF Bah. B = `svf_b1` (max 10)
  - SVI Bah. B = `sviB / 5` where sviB = sum of svi_b1..svi_b10 (raw max 50)
  - PR1-1 = SVF Bah. B + SVI Bah. B (max 20)
- `calcSummary()` variables: `sviA1`, `sviA23`, `prj1`, `prj2`, `prj3`, `prj4`, `lr1`, `pr11_svfb`, `pr11_svib`, `pr11`, `b3926`
- Ringkasan display IDs for PR1-1: `r_pr11_svfb_raw`, `r_pr11_svfb`, `r_pr11_svib_raw`, `r_pr11_svib`, `r_pr11`

## SVF Backward Compatibility (v4.8)
- `populateSection('svf')` auto-migrates old saved data (field names `a1`–`a5`) to new names:
  - `a1` → `a1_admin`, `a2` → `a1_tech`, `a3` → `a2_admin`, `a4` → `a2_tech`, `a5` → `a3`
- Migration only triggers when old `a1` key present and new `a1_admin` key absent

## Null-Safe DOM Helpers (v4.8 bugfix)
- `v(id)` — updated to null-safe: `var el = getElementById(id); return el ? parseInt(el.value)||0 : 0;`
- `setBar(id, val, max)` — updated to null-safe: checks element exists before setting width
- `calcSVF()` — all `getElementById` display updates wrapped with null checks to prevent crashes when SVF page elements are queried before the section is rendered

## TR1 Calculation — BITU3946 (v4.9)
TR1 (max 70) is composed of 4 components:
- **Component 1 — Laporan A (max 40)**: `(rep_a1 + rep_a2 + rep_a3 + rep_a4 + rep_a5 + rep_a6 + rep_a7) / 2`
  - raw Bahagian A max = 80 (sum of all A field maximums); divided by 2 → max 40
- **Component 2 — Laporan B (max 10)**: `(rep_b1 + rep_b2 + rep_b3 + rep_b4) / 40 * 10`
- **Component 3 — SVF Komitmen (max 10)**: `svf_c1` directly (no conversion)
- **Component 4 — Logbook Penghantaran (max 10)**: `log_c1` directly (no conversion)
- **TR1 = Component 1 + 2 + 3 + 4** (max 70)
- `calcSummary()` variables: `tr1_lapa`, `tr1_lapb`, `tr1_svfc`, `tr1_logc`, `tr1`
- `repA` = Bahagian A raw sum; `repB` = Bahagian B raw sum; `repT = repA + repB` (for stat card)
- Ringkasan display shows each component breakdown with IDs: `r2_tr1_lapa_raw`, `r2_tr1_lapa`, `r2_tr1_lapb_raw`, `r2_tr1_lapb`, `r2_tr1_svfc_raw`, `r2_tr1_svfc`, `r2_tr1_logc_raw`, `r2_tr1_logc`, `r2_tr1`

## PR1-1 and PR1-2 Calculation — BITU3946 (v4.10)
BITU3946 OBE components:
- **TR1 (70%)** = Laporan LI (see TR1 Calculation above)
- **PR1-1 (20%)** = Pembentangan — average of SVF and SVI presentation totals:
  - Formula: `(psvfT + psviT) / 200 * 20` where psvfT and psviT are each max 100
  - `calcSummary()` variable: `pr11_pbt`
  - Ringkasan display IDs: `r2_pr11_psvf_raw`, `r2_pr11_psvf`, `r2_pr11_psvi_raw`, `r2_pr11_psvi`, `r2_pr11`
- **PR1-2 (10%)** = Soft Skills = SVI Bah. B ÷ 5: `sviB / 50 * 10` (max 10)
  - Ringkasan display IDs: `r2_pr12r`, `r2_pr12`
- BITU3946 total: `tr1 + pr11_pbt + pr12` (70 + 20 + 10 = 100)

## Security (v4.11)
- **Password Hashing**: `hashPassword(pw)` — async SHA-256 via Web Crypto API (`crypto.subtle.digest`)
  - All password saves (login compare, reset PW, add user, add pensyarah, bulk upload) go through `hashPassword()` first
  - Default password `'utem1234'` for bulk upload is hashed before upsert
- **Session Timeout**: 5-minute idle auto-logout
  - `startIdleWatch()` — called after login; attaches `mousemove`, `keydown`, `click`, `touchstart`, `scroll` listeners
  - `resetIdleTimer()` — resets 5-min countdown on each interaction
  - `stopIdleWatch()` — called on logout; clears timer and removes listeners
  - On timeout: shows toast notification, then calls `doLogout()` after 3 seconds
  - Toast element: `#idle-toast` injected into DOM by `startIdleWatch()`
- **Migration**: Run pgcrypto migration in `supabase/schema.sql` to hash existing plaintext passwords in DB

## Future Upgrade Checklist
Track of planned improvements. Tick when done.

### Security
- [x] Password hashing proper (SHA-256 via Web Crypto API)
- [x] Session timeout bila idle (5 minit)
- [ ] Enable RLS (Row-Level Security) di Supabase dengan proper policies

### Export & Reporting
- [ ] Export PDF terus dari sistem (sekarang CSV je)
- [ ] Generate borang penilaian akhir auto (surat rasmi)
- [ ] OBE report yang boleh print cantik

### Notifikasi
- [ ] Email reminder kat pensyarah yang belum confirm markah
- [ ] Alert bila deadline nak dekat

### Audit Trail
- [ ] Log siapa edit markah, bila, dari berapa ke berapa

### Dashboard & UX
- [ ] Chart/graf — % pelajar lengkap, distribution markah
- [ ] Mobile input UX yang lebih baik

### Workflow
- [ ] Approval flow: pensyarah submit → AJK_LI approve → lock markah
- [ ] History/versioning markah (boleh tengok versi sebelum edit)

## Important Rules
- Never combine back into single file
- Always maintain separate html/css/js structure
- After every task, update this CLAUDE.md to reflect new changes
