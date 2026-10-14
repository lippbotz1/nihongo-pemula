# Nihongo Dasar V12 FINAL — Audit & Catatan Rilis

## Perubahan V12
- Simulasi ujian kosakata bertimer 10 menit dengan pilihan level N5, N4, N3, N2, atau semua level.
- Maksimal 20 soal acak per sesi; jawaban dikunci setelah dipilih dan nilai dihitung otomatis.
- Riwayat maksimal 30 hasil disimpan secara lokal di browser.
- Ekspor progres belajar sebagai JSON, termasuk favorit, kosakata dikuasai, jadwal review, nilai kuis terbaik, dan riwayat simulasi.
- UI menyatakan dengan jelas bahwa ini adalah simulasi kosakata, bukan ujian resmi JLPT lengkap.
- Mempertahankan flashcard spaced repetition, kamus/kosakata, quiz, admin, API, dan konfigurasi Firebase dari V11.

## QA yang dijalankan
- `node qa-audit-v12.js`
- `node qa-audit-v11.js`
- `node qa-audit-v10.js`
- `node qa-audit.js`
- `node --check index-inline.js`
- Pemeriksaan sintaks seluruh file JavaScript API dan skrip audit.
- Pemeriksaan arsip ZIP setelah dibuat.

## Batasan yang belum bisa dinyatakan lulus
- Belum diuji langsung di browser Android/desktop.
- Belum ada pengujian live pada proyek Firebase/Vercel pengguna.
- Hasil ekspor dan jadwal review hanya berasal dari penyimpanan lokal browser; tidak tersinkron ke akun/perangkat lain.
- Isi kosakata belum mendapat proofreading menyeluruh oleh pengajar bahasa Jepang; 26 pasangan kanji/kana duplikat masih perlu pemeriksaan editorial.
- Simulasi ujian ini menguji kosakata saja, bukan keseluruhan komponen resmi JLPT.

## Saran sebelum rilis publik/komersial
1. Deploy ke staging terpisah dan uji login, device lock, lisensi, panel admin, dan API dengan akun uji.
2. Tinjau Firebase Realtime Database Rules dan Vercel environment variables di dashboard proyek sendiri.
3. Jangan memasukkan service-account private key atau rahasia server ke HTML/browser.
4. Minta peninjauan bahasa oleh pengajar dan lakukan uji aksesibilitas/responsif.
