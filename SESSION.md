# Session Log

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
