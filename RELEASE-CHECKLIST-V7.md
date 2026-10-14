# Nihongo Dasar — Release checklist V7

Tanggal: 13 Oktober 2026

## Hasil pemeriksaan statis yang dijalankan
- `node qa-audit.js`: PASS untuk konsistensi database dan pemeriksaan regresi device-lock.
- `node --check index-inline.js`: PASS.
- `node --check api/device-lock.js`: PASS.
- `node --check api/admin-users.js`: PASS.
- `node --check api/premium-content.js`: PASS.
- `node --check api/translate.js`: PASS.
- `node --check translate.js`: PASS.
- Pemeriksaan ID HTML di `index.html`: 134 ID, tidak ada ID duplikat.
- Struktur ZIP: diperiksa setelah arsip dibuat.

## Temuan editorial
Database berisi 1.108 entri dan sinkron antara `index.html` dan `index-inline.js`. Terdapat 26 pasangan kanji/kana yang berulang. Jangan hapus otomatis; tinjau apakah duplikasi itu benar-benar redundan atau variasi konteks/kategori.

Distribusi label level: N5 644, N4 358, N3 54, N2 39, belum ditetapkan 13. Label tersebut adalah klasifikasi editorial aplikasi, bukan daftar resmi atau jaminan level JLPT.

## Pengujian yang BELUM dilakukan
- Pengujian browser interaktif di Android, iOS, dan desktop.
- Uji Firebase/Vercel staging dengan project dan kredensial nyata.
- Uji dua perangkat, token kedaluwarsa, jaringan putus, dan recovery lock.
- Uji alur Premium/pembayaran/admin end-to-end.
- Verifikasi audio/TTS di browser nyata.
- Proofreading semua materi oleh pengajar atau penutur asli Jepang.

## Sebelum produksi
1. Deploy ke staging terlebih dahulu.
2. Pastikan environment variables Firebase Admin tersedia di Vercel.
3. Pastikan aturan Realtime Database sudah sesuai dengan `FIREBASE-RULES.json`; backup rules lama sebelum mengganti.
4. Jalankan test login, logout, refresh, dua perangkat, reset admin, token invalid, dan kegagalan jaringan.
5. Uji semua tab dan fungsi di layar kecil serta besar.
6. Jangan mengklaim terjemahan atau klasifikasi JLPT telah terverifikasi ahli sebelum proofreading selesai.

Status rilis: **belum dinyatakan siap produksi** karena pengujian runtime dan proofreading linguistik belum selesai.
