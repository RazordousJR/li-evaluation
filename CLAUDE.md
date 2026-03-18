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
- ADMIN — full access to everything including user management panel
- AJK_LI — can key in marks AND view/print OBE reports; cannot manage users
- PENSYARAH — can key in marks only; Ringkasan & Gred is view-only (Reset button hidden)

## Login System (v4.0 — Supabase Backend)
- Login page (overlay) is the first thing the user sees on load
- Login identifier is **email** (type=email input)
- **Sessions stored in `li_session` (localStorage)** — only `{email, roles, displayName}` (no sensitive data)
- **Users list stored in Supabase `public.users` table** (replaces `li_users` localStorage)
- Supabase user row format: `{id, full_name, email, password_hash, roles:text[], is_active, created_at}`
  - `is_active: false` disables login for that account
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
- Client initialized as `sb` global in `initAuth()`
- RLS disabled on all tables; anon role granted full access
- **Setup**: Run `supabase/schema.sql` once in Supabase Dashboard → SQL Editor

## Database Tables
### `public.users`
Columns: `id` (uuid PK), `full_name`, `email` (unique), `password_hash`, `roles` (text[]), `is_active`, `created_at`
- Replaces `li_users` localStorage
- All user management CRUD goes through this table

### `public.students`
Columns: `id` (uuid PK), `name`, `matric_no` (unique), `kursus`, `semester`, `sesi`, `organisasi`, `svf_name`, `svi_name`, `created_at`
- Created/updated on every auto-save (upsert by `matric_no`)

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
- **Sidebar** (left, fixed 240px): dark blue (#1e3a8a), app logo/title, nav menu items, admin-only "Pengurusan Pengguna" section at bottom, user name + role badge in footer
- **Topbar** (right, sticky): hamburger (mobile), page title, BITU badges, save-status indicator, logout button
- **Content area**: scrollable, renders selected page
- Mobile responsive: sidebar collapses off-screen, opens via hamburger button with overlay backdrop
- CSS variable: `--sidebar-bg: #1e3a8a`; `--sidebar-width: 240px`
- Admin nav items (`admin-sep`, `admin-label`, `admin-nav-item`) have `style="display:none"` inline; shown by ID in JS

## User Management Panel (ADMIN only — IMPLEMENTED)
- Accessible via "Pengurusan Pengguna" sidebar nav item (admin-only)
- Page ID: `#page-usermgmt`
- **Users table**: shows Nama Penuh, E-mel, Peranan (role badges), Status (Aktif/Tidak Aktif), Tindakan
- **Add user form**: Nama Penuh, E-mel, Kata Laluan, Peranan checkboxes (ADMIN/AJK_LI/PENSYARAH)
- **Tindakan per user** (keyed by email, not array index):
  - Edit — opens modal to change name, email, roles (async Supabase update)
  - Reset PW — opens modal to set new password, min 4 chars (async Supabase update)
  - Nyahaktif/Aktifkan — toggle `is_active` in Supabase (hidden for own account)
  - Hapus — delete from Supabase with confirmation (hidden for own account)
- Hidden inputs use `um-edit-key` and `um-pw-key` (store email) instead of old array-index `um-edit-idx`/`um-pw-idx`
- Edit modal updates session + sidebar if admin edits their own profile
- Deactivated accounts cannot log in

## Navigation
- `showTab(t)` in app.js handles page switching, updates sidebar nav active state and topbar title
- `openSidebar()` / `closeSidebar()` handle mobile sidebar toggle
- Tab names: `info`, `svi`, `svf`, `logbook`, `presentation`, `report`, `summary`, `usermgmt`

## Tech Stack
- Vanilla HTML, CSS, JavaScript only (no frameworks, no build tools)
- Supabase JS v2 via CDN (`jsdelivr`) for database backend
- Session persisted in `localStorage` (`li_session` key only)
- Hosted on GitHub Pages

## Important Rules
- Never combine back into single file
- Always maintain separate html/css/js structure
- After every task, update this CLAUDE.md to reflect new changes
