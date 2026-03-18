# LI Evaluation App — UTeM FTMK
## Project Structure
- index.html — main HTML structure
- css/style.css — all styles
- js/app.js — all JavaScript logic
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

## Login System
- Login page (overlay) is the first thing the user sees on load
- Login identifier is **email** (type=email input)
- Sessions stored in `li_session` (localStorage); users list stored in `li_users` (localStorage)
- User object format: `{email, password, roles:[], displayName, active:bool}`
  - `active: false` disables login for that account
- Session object format: `{email, roles:[], displayName}`
- Default accounts seeded automatically on first load (re-seeds if old username-based format detected):
  - admin@utem.edu.my / admin123 (ADMIN)
  - ajkli@utem.edu.my / ajkli123 (AJK_LI)
  - pensyarah@utem.edu.my / pensyarah123 (PENSYARAH)
- Logged-in full name and role badge (effective role) shown at bottom of sidebar
- Logout button in topbar (top-right of main content); logout clears session and reloads page
- `getEffectiveRole(roles[])` in app.js resolves highest privilege from roles array
- `applyRoleRestrictions(roles[])` in app.js applies UI restrictions:
  - ADMIN: shows `.admin-only` elements (sidebar Pengurusan Pengguna section)
  - AJK_LI: no restrictions (full mark entry + view/print)
  - PENSYARAH: Reset button hidden; all inputs remain editable

## Layout (v3.0 — Sidebar Navigation)
- **Sidebar** (left, fixed 240px): dark blue (#1e3a8a), app logo/title, nav menu items, admin-only "Pengurusan Pengguna" section at bottom, user name + role badge in footer
- **Topbar** (right, sticky): hamburger (mobile), page title, BITU badges, logout button
- **Content area**: scrollable, renders selected page
- Mobile responsive: sidebar collapses off-screen, opens via hamburger button with overlay backdrop
- CSS variable: `--sidebar-bg: #1e3a8a`; `--sidebar-width: 240px`
- `.admin-only` elements are `display:none` by default; shown for ADMIN role via JS

## User Management Panel (ADMIN only — IMPLEMENTED)
- Accessible via "Pengurusan Pengguna" sidebar nav item (admin-only)
- Page ID: `#page-usermgmt`
- **Users table**: shows Nama Penuh, E-mel, Peranan (role badges), Status (Aktif/Tidak Aktif), Tindakan
- **Add user form**: Nama Penuh, E-mel, Kata Laluan, Peranan checkboxes (ADMIN/AJK_LI/PENSYARAH)
- **Tindakan per user**:
  - Edit — opens modal to change name, email, roles
  - Reset PW — opens modal to set new password (min 4 chars)
  - Nyahaktif/Aktifkan — toggle active status (hidden for own account)
  - Hapus — delete user with confirmation (hidden for own account)
- Admin cannot deactivate or delete their own account (self-protection)
- Edit modal updates session display if admin edits their own profile
- Deactivated accounts cannot log in

## Navigation
- `showTab(t)` in app.js handles page switching, updates sidebar nav active state and topbar title
- `openSidebar()` / `closeSidebar()` handle mobile sidebar toggle
- Tab names: `info`, `svi`, `svf`, `logbook`, `presentation`, `report`, `summary`, `usermgmt`

## Tech Stack
- Vanilla HTML, CSS, JavaScript only
- No frameworks, no build tools
- Hosted on GitHub Pages
- All data stored in localStorage
## Important Rules
- Never combine back into single file
- Always maintain separate html/css/js structure
- After every task, update this CLAUDE.md to reflect new changes
