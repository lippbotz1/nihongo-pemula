# Nihongo Dasar — Audit Lanjutan V3
Tanggal: 12 Oktober 2026

## Hasil audit tambahan
- Database utama: 1048 entri.
- Entri unik berdasarkan bentuk kata/ungkapan: 1022.
- Duplikasi bentuk kata: 26 bentuk; sebagian dapat berupa homonim, variasi kategori, atau pengulangan yang perlu keputusan editorial. Tidak dihapus otomatis agar level/kategori yang mungkin sengaja dibedakan tidak hilang.
- Distribusi level saat ini: N5: 644, Belum ditetapkan: 13, N4: 358, N3: 33.
- Contoh kalimat yang jelas tidak alami pada entri frasa/ungkapan diperbaiki secara konservatif: 1 entri. Pada kasus tersebut contoh diganti dengan ungkapan itu sendiri agar pengguna tidak mempelajari kalimat yang salah konteks.
- Database `CORE_VOCAB` disinkronkan pada `index.html` dan `index-inline.js`.

## Batasan audit
- Perbaikan otomatis hanya diterapkan pada pola yang sangat jelas tidak alami (misalnya ungkapan dipaksa menjadi objek “dimakan/dipelajari/dirasakan” atau dipakai dalam pola “Saya adalah ...”). Ini bukan proofreading lengkap seluruh kosakata.
- Bacaan, romaji, nuansa terjemahan, dan tingkat JLPT seluruh entri masih memerlukan pemeriksaan linguistik per kategori.
- Distribusi level menunjukkan materi masih berat di N5/N4. Jika produk diposisikan sebagai platform lebih lengkap, tahap berikutnya perlu menambah materi N3/N2 secara terstruktur, bukan sekadar menambah jumlah entri.

## Keamanan / deployment
- Jangan deploy `FIREBASE-RULES.json` saat ini ke produksi tanpa perbaikan `device_lock`: izin baca/tulis terlalu luas bagi semua pengguna terautentikasi.
- Jangan langsung mengubah aturan ke deny-all tanpa migrasi kode; login/device-lock akan gagal. Solusi aman perlu mengikat data lock ke UID yang terautentikasi atau memindahkan operasi lock ke endpoint server dengan otorisasi.
- Pemeriksaan sintaks tidak menggantikan pengujian runtime Firebase Auth, lisensi Premium, pembayaran, admin, atau TTS pada perangkat nyata.

## Contoh entri yang diperbaiki
- 日本語を勉強する

## Checklist sebelum rilis
- [ ] Uji login, refresh, tutup-buka browser, logout, dan reset perangkat di staging.
- [ ] Uji pengguna non-admin tidak dapat membaca/mengubah data admin atau lock pengguna lain.
- [ ] Uji masa aktif Premium dan harga dari admin.
- [ ] Uji TTS pada Chrome Android dan desktop.
- [ ] Proofread kategori kosakata, romaji, contoh, dan terjemahan oleh penutur/pengajar Jepang.


## Addendum V4 — static QA follow-up

- Re-ran a programmatic extraction/parse of `CORE_VOCAB` in both `index.html` and `index-inline.js`.
- Found a real mismatch between the two embedded arrays in V3 despite the earlier note saying they were synchronized. V4 replaces the `index.html` array with the array from `index-inline.js`; both now parse as 1,048 entries and match exactly.
- Added `qa-audit.js` so the same consistency and required-field checks can be repeated locally with Node.js: `node qa-audit.js`.
- Static check result: 1,048 entries in each file; no missing core fields; 26 duplicate kanji+kana keys remain for editorial review. They were not auto-deleted because duplicate meanings/categories can be intentional.
- JavaScript syntax checks passed for `index-inline.js`, `translate.js`, `api/translate.js`, `api/admin-users.js`, and `api/premium-content.js`.

### Important release blockers remain
1. `FIREBASE-RULES.json` still grants any authenticated user read/write access to `device_lock/$emailKey`. Do not deploy these rules unchanged. The front-end currently addresses lock records by an email-derived key, so simply tightening the rules without migrating the client/server flow can break device locking.
2. No real-browser runtime tests were performed in this static audit. Audio/TTS, Firebase Auth, Premium expiry, admin actions, and responsive UI still require staging tests.
3. Static field completeness is not linguistic proof. Romaji, readings, level labels, translations, and example naturalness still need editorial review by a qualified Japanese speaker/teacher.
