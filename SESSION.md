# Session Log

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
