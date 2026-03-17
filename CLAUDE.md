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
- ADMIN — full access to everything including user management
- AJK_LI — can key in marks AND view/print OBE reports; cannot manage users
- PENSYARAH — can key in marks only; Ringkasan & Gred is view-only (Reset button hidden)

## Login System
- Login page (overlay) is the first thing the user sees on load
- Login identifier is **email** (type=email input)
- Sessions stored in `li_session` (localStorage); users list stored in `li_users` (localStorage)
- User object format: `{email, password, roles:[], displayName}`
- Session object format: `{email, roles:[], displayName}`
- Default accounts seeded automatically on first load (re-seeds if old username-based format detected):
  - admin@utem.edu.my / admin123 (ADMIN)
  - ajkli@utem.edu.my / ajkli123 (AJK_LI)
  - pensyarah@utem.edu.my / pensyarah123 (PENSYARAH)
- Logged-in full name and role badge (effective role) shown in header top-right
- Logout button in header top-right; logout clears session and reloads page
- `getEffectiveRole(roles[])` in app.js resolves highest privilege from roles array
- `applyRoleRestrictions(roles[])` in app.js applies UI restrictions:
  - ADMIN: no restrictions
  - AJK_LI: no restrictions (full mark entry + view/print)
  - PENSYARAH: Reset button hidden; all inputs remain editable
- User management (add/delete users, reset passwords) — not yet implemented (ADMIN only future feature)
## Tech Stack
- Vanilla HTML, CSS, JavaScript only
- No frameworks, no build tools
- Hosted on GitHub Pages
- All data stored in localStorage
## Important Rules
- Never combine back into single file
- Always maintain separate html/css/js structure
- After every task, update this CLAUDE.md to reflect new changes
