# Nihongo Dasar — Audit V5
Tanggal: 13 Oktober 2026

## Perubahan V5
- Menambahkan 62 entri kosakata/pola tata bahasa tingkat N3/N2 ke `CORE_VOCAB` dengan bacaan kana, romaji, arti Indonesia, kategori, contoh Jepang, romaji contoh, dan terjemahan contoh.
- Menyinkronkan `CORE_VOCAB` pada `index.html` dan `index-inline.js`.
- Memperluas `qa-audit.js` agar menampilkan distribusi level JLPT dan kategori serta memeriksa kelengkapan struktur data.
- Menambahkan `FIREBASE-SECURITY-MIGRATION.md` dengan rencana migrasi device-lock yang aman tanpa merusak alur login secara mendadak.

## Batasan yang wajib diketahui
- Level N3/N2 pada entri tambahan merupakan klasifikasi editorial perkiraan untuk membantu belajar, bukan klaim bahwa setiap kata/pola termasuk daftar resmi JLPT tertentu.
- Ini adalah penambahan terstruktur, bukan validasi penutur asli untuk semua contoh. Terjemahan, nuansa, bacaan, dan romaji tetap perlu proofreading ahli sebelum dijual.
- Firebase `device_lock` masih menjadi release blocker sampai operasi dipindahkan ke endpoint server yang memverifikasi ID token dan menggunakan UID.
- Belum dilakukan pengujian runtime di browser, perangkat audio, Firebase staging, maupun alur pembayaran/Premium.

## Cara menguji
- `node qa-audit.js`
- `node --check index-inline.js`
- `node --check translate.js`
- `node --check api/translate.js`
- `node --check api/admin-users.js`
- `node --check api/premium-content.js`

## Checklist sebelum rilis
- [ ] Review linguistik setiap entri baru dengan pengajar/penutur Jepang.
- [ ] Implementasikan endpoint server untuk device-lock; tutup akses langsung database.
- [ ] Uji login, logout, multi-device, reset lock, dan percobaan akses lintas pengguna di staging.
- [ ] Uji Premium, admin, terjemahan, TTS, dan layout ponsel/desktop.
