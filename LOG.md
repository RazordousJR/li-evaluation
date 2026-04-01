# Bug & Fix Log

## 2026-04-01 — BITU3946 TR1 row showed full total instead of report sub-total

**Type:** Bug
**Page/Feature:** Laporan — expanded row BITU3946 detail table
**Symptom:** "TR1 — LI Report" row displayed the full tr1 total (all 4 sub-components including logbook and komitmen) instead of just the Laporan document contribution (tr1_lapa + tr1_lapb)
**Root cause:** `renderLaporanExpandedRow()` used `obe.tr1` for both the TR1 row and the Laporan group Jumlah column. `printLaporanStudent()` used `fn(o.tr1_lapa)` (Laporan A only, missing Laporan B).
**Fix:** Screen: use `tr1_lapa + tr1_lapb` for TR1 row, keep `tr1` for Jumlah column. Print: same fix applied.

## 2026-04-01 — BITU3946 Presentation rows showed raw 0–100 scores instead of weighted 0–10

**Type:** Bug
**Page/Feature:** Laporan — expanded row BITU3946 detail table
**Symptom:** Presentation PF and PI rows showed raw evaluation scores (e.g. 82.00, 94.00) instead of their weighted contribution to the 20% Pembentangan component (e.g. 8.20, 9.40)
**Root cause:** Both `renderLaporanExpandedRow()` and `printLaporanStudent()` used `obe.psvfT` and `obe.psviT` directly (raw 0–100 totals). Correct formula: each / 10 (since `pr11_pbt = (psvfT + psviT) / 200 * 20`).
**Fix:** Divide by 10: `psvfT / 10` and `psviT / 10` for the individual row display.

## 2026-04-01 — Print report had inconsistent border colors

**Type:** Bug
**Page/Feature:** Laporan — printLaporanStudent() print output
**Symptom:** `<th>` had `border:1px solid #1e3a8a` (blue) while `<td>` had `border:1px solid #ccc` (light grey). Grid lines were visually inconsistent.
**Fix:** Both `th` and `td` changed to `border:1px solid #333` throughout print CSS.



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
