# Nihongo Dasar V11 — Audit & Perubahan

## Perubahan utama
- Menambahkan sistem pengulangan kosakata terjadwal (spaced repetition) pada flashcard.
- Penilaian ingatan: Belum ingat (10 menit), Sulit (1 hari), Ingat (3 hari), Mudah (7 hari).
- Kartu yang jatuh tempo dihitung dan dapat dipelajari lewat Mode Review.
- Jadwal tersimpan di localStorage browser/perangkat yang digunakan; belum tersinkron antar perangkat atau akun.
- Membatasi ukuran sesi flashcard agar nilai yang tersimpan di localStorage tidak menyebabkan sesi terlalu besar.

## QA
Jalankan `npm run audit` dan `npm run audit:vocabulary`. Pemeriksaan ini statis, bukan pengganti pengujian browser, staging Firebase/Vercel, atau proofreading oleh pengajar bahasa Jepang.
