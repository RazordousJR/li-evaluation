# LI Evaluation App — UTeM FKIK
## Project Structure
- index.html — main HTML structure
- css/style.css — all styles
- js/app.js — all JavaScript logic
## App Purpose
Industrial Training (Latihan Industri) evaluation form for UTeM FKIK (Fakulti Teknologi Maklumat dan Komunikasi), Universiti Teknikal Malaysia Melaka (UTeM).
Covers two courses: BITU3926 (Latihan Industri) and BITU3946 (Laporan Latihan Industri).
## Evaluation Components
- Penyelia Industri / SVI — Industry Supervisor evaluation
- Penyelia Fakulti / SVF — Faculty Supervisor evaluation
- e-Logbook — logbook assessment
- Pembentangan — presentation assessment (SVF & SVI)
- Laporan LI — industrial training report assessment
- Ringkasan & Gred — final marks summary and grade
## User Roles (to be implemented)
- ADMIN — full access, can add/delete users, reset passwords, edit everything
- AJK_LI — can view and print OBE reports, cannot add users or edit submitted marks
- PENSYARAH — can only key in marks and fill student/supervisor details, Ringkasan & Gred is read-only
## Tech Stack
- Vanilla HTML, CSS, JavaScript only
- No frameworks, no build tools
- Hosted on GitHub Pages
- All data stored in localStorage
## Important Rules
- Never combine back into single file
- Always maintain separate html/css/js structure
- After every task, update this CLAUDE.md to reflect new changes
