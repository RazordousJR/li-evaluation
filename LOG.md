# Bug & Fix Log

## 2026-04-01 — Laporan detail table rendered as flat rows

**Type:** Bug
**Page/Feature:** Laporan — expanded row detail tables
**Symptom:** BITU3926 and BITU3946 detail tables showed as flat single-column rows instead of grouped 4-column layout
**Root cause:** Initial implementation did not use rowspan on Penilaian and Jumlah columns
**Fix:** Rebuilt tables using rowspan on Penilaian cell and Jumlah cell per row group to match 4-column layout: Penilaian | Komponen | Markah | Jumlah

## 2026-04-01 — Cetak Laporan triggered old 7-page evaluation report

**Type:** Bug
**Page/Feature:** Laporan — Cetak Laporan button
**Symptom:** Clicking Cetak Laporan navigated away to Ringkasan page and printed the full 7-page evaluation form
**Root cause:** printLaporanStudent() was still calling generatePDF() and showTab() from the existing report flow
**Fix:** Completely rewrote printLaporanStudent() — builds self-contained HTML string from laporanData[idx] in memory, opens via window.open('', '_blank'), writes HTML and calls print() in new window. No navigation, no Supabase calls.

## 2026-04-01 — Large blank space at top of Laporan page

**Type:** Bug
**Page/Feature:** Laporan page layout
**Symptom:** Page showed large empty area at top, content only visible after scrolling down
**Root cause:** #page-laporan had extra top padding/margin not consistent with other pages
**Fix:** Removed excess top spacing from #page-laporan container to match other page layouts

## 2026-04-01 — Laporan table hidden under sidebar

**Type:** Bug
**Page/Feature:** Laporan page layout
**Symptom:** Left columns (#, Nama) were clipped behind the sidebar
**Root cause:** #page-laporan table container did not respect sidebar width, not using same .content-area wrapper as other pages
**Fix:** Aligned #page-laporan container to use same layout approach as other pages so table starts after sidebar
