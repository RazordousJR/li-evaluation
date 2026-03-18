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

## Layout (v3.0 — Sidebar Navigation)
- **Sidebar** (left, fixed 240px): dark blue (#1e3a8a), app logo/title, nav menu items, management section at bottom, user name + role badge in footer
- **Topbar** (right, sticky): hamburger (mobile), page title, BITU badges, save-status indicator, logout button
- **Content area**: scrollable, renders selected page
- Mobile responsive: sidebar collapses off-screen, opens via hamburger button with overlay backdrop
- CSS variable: `--sidebar-bg: #1e3a8a`; `--sidebar-width: 240px`
- Management nav items (`admin-sep`, `admin-label`, `admin-nav-item`, `uruspelajar-nav-item`, `uruspensyarah-nav-item`) have `style="display:none"` inline; shown by role in `applyRoleRestrictions()`
  - `uruspelajar-nav-item` and `uruspensyarah-nav-item` shown for ADMIN and AJK_LI
  - `admin-nav-item` shown for ADMIN only

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
  - **Padam** button (ADMIN & AJK_LI only): confirmation dialog lists student name + matric, warns about marks deletion
    - On confirm: deletes from `public.marks` (by student_id), then from `public.students`
    - `deleteStudent(matricNo, name)` handles this flow
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
- Tab names: `info`, `svi`, `svf`, `logbook`, `presentation`, `report`, `summary`, `usermgmt`, `uruspelajar`, `uruspensyarah`

## Tech Stack
- Vanilla HTML, CSS, JavaScript only (no frameworks, no build tools)
- Supabase JS v2 via CDN (`jsdelivr`) for database backend
- SheetJS (xlsx@0.18.5) via CDN for .xlsx/.csv file parsing
- Session persisted in `localStorage` (`li_session` key only)
- Hosted on GitHub Pages

## Important Rules
- Never combine back into single file
- Always maintain separate html/css/js structure
- After every task, update this CLAUDE.md to reflect new changes
