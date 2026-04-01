# Session Log

## Session 2026-04-01 (6) — Urus Pelajar filter controls (v4.28)

### What was done
- **Part 1 — Filter row added to index.html**: Added filter row div ABOVE the Senarai Pelajar section-title bar inside `#page-uruspelajar`; contains label "Tapis:", `filter-pelajar-program` select (populated dynamically), `filter-pelajar-svf` select (Semua/Belum Assign/Dah Assign), "Set Semula" button, and `filter-pelajar-count` span showing "X pelajar"
- **Part 2 — Filter logic added to app.js**:
  - Added module-level `_pelajarFiltered = []` and `_pelajarPensyarahMap = {}` vars
  - `loadUruspelajar()` now stores pensyarahMap in `_pelajarPensyarahMap` (module-level), sets `_pelajarStudentsCache`, calls `populateProgramDropdown(filter-pelajar-program, true)`, then calls `applyFilterPelajar()` — removed inline row rendering
  - Added `applyFilterPelajar()` — filters by program and svf status, stores result in `_pelajarFiltered`, updates count span, resets select-all, calls `renderPelajarTable(_pelajarFiltered)`
  - Added `resetFilterPelajar()` — resets both filter dropdowns to `''`, calls `applyFilterPelajar()`
- **Part 3 — `renderPelajarTable(studentsArr)` extracted**: moved all row-rendering logic from `loadUruspelajar()` into new function; uses `_pelajarStudentsCache.indexOf(s)` as `cacheIdx` for Edit button so it works correctly on filtered subsets; shows "Tiada pelajar sepadan dengan tapisan." when filtered result is empty but cache has students
- **Part 4 — bulkAssignSVF verified**: already uses `cb.value` (matric_no) from checkboxes — no changes needed; `toggleAllStudents()` operates on DOM checkboxes, works correctly with filtered results
- **Part 5 — Version bump**: index.html v4.27 → v4.28; CLAUDE.md Urus Pelajar section updated; SESSION.md updated
- Fixed incidental bug: `loadUruspelajar()` loading indicator had `colspan="7"` instead of `colspan="8"` (table has 8 columns)

### Files changed
- index.html — added filter row div in `#page-uruspelajar` Senarai Pelajar section; updated version badge to v4.28
- js/app.js — added `_pelajarFiltered`, `_pelajarPensyarahMap` vars; refactored `loadUruspelajar()` to call `applyFilterPelajar()`; added `applyFilterPelajar()`, `resetFilterPelajar()`, `renderPelajarTable(studentsArr)`
- CLAUDE.md — updated Urus Pelajar section with filter controls documentation; updated version note to v4.28

## Session 2026-04-01 (5) — Profil Saya page & Upload Pensyarah mapping verification (v4.27)

### What was done
- **Part 1 — Upload Pensyarah mapping verified**: Confirmed `handleUploadPensyarah()` already correctly maps all four official Excel columns (`Nama Penuh` → `full_name`, `No Staf` → `no_staf`, `Jabatan` → `jabatan`, `Email` → `email`) via `normalizeRow()`. No code changes needed.
- **Part 2 — Profil Saya page** added for ALL roles (PENSYARAH, AJK_LI, ADMIN):
  - Added `profil-nav-item` ("👤 Profil Saya") to `#sidebar-nav-default` after Dashboard, before `admin-sep` — visible to all roles
  - Added `#page-profil` page with two sections: Maklumat Profil and Tukar Kata Laluan
  - Added `profil: 'Profil Saya'` to `TAB_TITLES`; added `if (t === 'profil') loadProfil()` in `showTab()`
  - `loadProfil()` — fetches `full_name, no_staf, jabatan, email` from `public.users` and populates form fields
  - `saveProfilMaklumat()` — updates `full_name, no_staf, jabatan`; updates `li_session.displayName` in localStorage and `#sidebar-user-name` on success
  - `saveProfilPassword()` — validates old password hash match via `hashPassword()`, then updates `password_hash` in DB; clears password fields on success
  - `profil-nav-item` is NOT in any role restriction hide list — visible by default
- Updated version badge from v4.24 → v4.27
- Updated CLAUDE.md: added Profil Saya Page section, Upload Pensyarah Column Format section, version note in Dashboard section

### Files changed
- index.html — added `profil-nav-item` nav item; added `#page-profil` page with two sections; updated version badge to v4.27
- js/app.js — added `profil` to TAB_TITLES; added loadProfil() case in showTab(); added PROFIL SAYA section with loadProfil(), saveProfilMaklumat(), saveProfilPassword()
- CLAUDE.md — added Profil Saya Page section, Upload Pensyarah Column Format section; updated version badge note to v4.27

## Session 2026-04-01 (4) — Urus Program page & dynamic program dropdowns (v4.26)

### What was done
- Added `public.programs` Supabase table with SQL migration (code PK, name, description, created_at); seeded with 7 default programs (BITC, BITD, BITM, BITI, BITS, BITE, BITZ); RLS enabled with passthrough anon policy
- Added `_programsCache = []` global and `loadProgramsCache()` async function; called in `initAuth()` after Supabase client init with `await`
- Added `populateProgramDropdown(selectEl, includeBlank)` helper that clears and repopulates any select from `_programsCache`
- Removed all hardcoded program `<option>` elements from `kursus`, `adp-kursus`, `edp-kursus` selects in index.html; left only blank option
- `initAuth()` now calls `populateProgramDropdown(kursus, true)` after cache load to pre-populate the main form dropdown
- `openAddPelajarModal()` and `openEditPelajarModal()` now call `populateProgramDropdown()` before showing their modals
- `loadLaporan()` populates `laporan-filter-kursus` dynamically from `_programsCache` before calling `filterLaporan()`
- Added "Urus Program" nav item (`urusProgram-nav-item`) in sidebar default nav, after Urus Pensyarah; ADMIN only
- Added `#page-urusProgram` page with programs table (Kod, Nama, Deskripsi, Bil. Pelajar, Tindakan) and note-box
- Added `add-program-modal` (ap-code uppercase enforced, ap-name, ap-desc, ap-error) and `edit-program-modal` (ep-old-code hidden, ep-code uppercase, ep-name, ep-desc, ep-error)
- Added URUS PROGRAM section in app.js: `loadUrusProgram()`, `openAddProgramModal()`, `closeAddProgramModal()`, `addProgram()`, `openEditProgramModal()`, `closeEditProgramModal()`, `saveEditProgram()`, `deleteProgram()`
  - Rename case in `saveEditProgram()`: inserts new code → migrates students.kursus → deletes old code
  - `deleteProgram()`: queries student count, shows confirm dialog with count, clears kursus then deletes program
- Updated `applyRoleRestrictions()`, `TAB_TITLES`, `showTab()` for `urusProgram` tab
- SQL migration block added to CLAUDE.md under `## SQL: programs table migration`

### Files changed
- index.html — removed hardcoded program options from kursus/adp-kursus/edp-kursus/laporan-filter-kursus; added urusProgram-nav-item; added #page-urusProgram; added add-program-modal and edit-program-modal
- js/app.js — added _programsCache, loadProgramsCache(), populateProgramDropdown(); updated initAuth(), applyRoleRestrictions(), TAB_TITLES, showTab(), openAddPelajarModal(), openEditPelajarModal(), loadLaporan(); added URUS PROGRAM section with all functions
- CLAUDE.md — added public.programs table schema, Programs Cache section, Urus Program Page section, SQL migration block; updated tab names list and version badge to v4.26

## Session 2026-04-01 (3) — Export Senarai Pelajar Excel button

### What was done
- Added "⬇ Export Excel" button to Urus Pelajar page (before "Muat Semula" button) in the Senarai Pelajar section-title bar
- Added `exportSenaraiPelajar()` function in js/app.js (after `// ===== END URUS PELAJAR =====`)
- Export reads from `_pelajarStudentsCache`; builds single-sheet XLSX with columns: Bil, Nama Pelajar, No Matrik, Program, Status Kelulusan (no SVF column)
- Status Kelulusan: "Diluluskan" if `approval_status === 'approved'`, else "Draf"
- Column widths set via `ws['!cols']`; filename format: `Senarai_Pelajar_YYYY-MM-DD.xlsx`
- Updated CLAUDE.md Urus Pelajar section to document the new Export Excel button

### Files changed
- index.html — added "⬇ Export Excel" button before "Muat Semula" in Senarai Pelajar section-title
- js/app.js — added `exportSenaraiPelajar()` function after END URUS PELAJAR marker
- CLAUDE.md — documented Export Excel button under Urus Pelajar section

## Session 2026-04-01 (2) — Laporan expand panel redesign (v4.25)

### What was done
- Redesigned Laporan student detail panel (accordion expand row) to use 4-column tables (Penilaian | Komponen | Markah | Jumlah) with rowspan matching official form layout
- Updated printLaporanStudent() to mirror the new panel layout exactly
- Fixed 3 data bugs in both screen and print: TR1 LI Report row showed wrong value (full tr1 instead of tr1_lapa+tr1_lapb), Presentation PF/PI rows showed raw scores (0–100) instead of weighted (÷10) values
- Fixed print border inconsistency: all th/td now use border:1px solid #333

### Files changed
- js/app.js — renderLaporanExpandedRow() rewritten; printLaporanStudent() fixed
- css/style.css — added .laporan-penilaian-cell, .laporan-jumlah-cell, .laporan-markah-cell; updated th/td borders
- CLAUDE.md — added v4.25 section

### Notes
- Laporan expand panel 3-column layout (Info | BITU3926 | BITU3946) was already correct; only table interiors changed
- printLaporanStudent() continues using window.open() approach (not #print-area) to avoid conflict with 7-page evaluation PDF

## Session 2026-04-01 — Laporan & Status Pensyarah pages

### What was done
- Added Laporan page (ADMIN + AJK_LI only): student marks table, filter by kursus/status, export Excel (4 sheets via SheetJS), accordion row expand with BITU3926 + BITU3946 detail breakdown, Cetak Laporan button
- Added Status Pensyarah page (ADMIN + AJK_LI only): grouped by pensyarah via svf_email, progress bar, Ada Pending/Selesai badge, Copy Email button, accordion expand showing student list
- Both pages wired in showTab(), TAB_TITLES, applyRoleRestrictions(), sidebar nav added before Settings
- Fixed: large blank gap at top of Laporan page
- Fixed: table content hidden under sidebar (layout container issue)
- Fixed: Cetak Laporan printing old 7-page report — replaced with self-contained window.open() print

### Files changed
- index.html — new sidebar nav items, #page-laporan, #page-statuspensyarah sections
- js/app.js — computeOBE(), loadLaporan(), filterLaporan(), renderLaporanTable(), toggleLaporanRow(), renderLaporanExpandedRow(), printLaporanStudent(), exportLaporanExcel(), loadStatusPensyarah(), renderStatusPensyarah(), renderSPStudentRows(), toggleSPGroup(), copySPEmail()
- css/style.css — .laporan-* classes, .sp-* classes

### Notes
- Cetak Laporan uses window.open('', '_blank') approach to avoid conflict with existing @media print CSS for 7-page report
- Selesai status = marks locked/approved
- Data loaded once on page load, filtered client-side
