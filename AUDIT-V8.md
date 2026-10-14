# Nihongo Dasar V8 — hardening endpoint dan audit lanjutan

V8 berangkat dari V7 dan mempertahankan data serta struktur aplikasi. Perubahan terfokus pada pengurangan kebocoran informasi dari API dan validasi UID pada endpoint admin.

## Perubahan
- `api/admin-users.js`: memvalidasi UID menggunakan pola karakter aman sebelum operasi update/delete/reset password/reset device.
- `api/admin-users.js`: respons error kepada klien dibuat generik; detail hanya dicatat pada log server.
- `api/premium-content.js`: tidak mengembalikan pesan error internal secara mentah.
- `api/device-lock.js`: respons konflik tidak lagi menyebut nama perangkat lain.
- `package.json`: versi diperbarui ke V8.

## Pemeriksaan yang dijalankan
- Pemeriksaan sintaks JavaScript pada skrip dan endpoint API.
- Konsistensi `CORE_VOCAB` antara `index.html` dan `index-inline.js`.
- Kelengkapan struktur entri dan pemeriksaan ID HTML duplikat.
- Pemeriksaan statis aturan Firebase yang menolak akses klien langsung ke `device_lock`.
- Pemeriksaan bahwa respons error endpoint tidak mengandung pola kebocoran pesan internal.

## Batasan dan risiko yang tersisa
- Ini bukan penetration test dan tidak membuktikan keamanan produksi.
- Perlu uji Firebase/Vercel staging untuk autentikasi, token invalid/kedaluwarsa, otorisasi admin, transaksi dua perangkat, heartbeat, release, dan gangguan jaringan.
- Perlu menguji pemulihan kunci setelah tab/browser ditutup atau perangkat offline.
- `presence` dan `login_history` masih mengizinkan klien menulis data untuk UID sendiri pada Firebase Rules. Jika data ini digunakan untuk keputusan administratif/keamanan, pindahkan penulisannya ke endpoint server atau validasi bentuk data dengan rules yang ketat.
- Semua kosakata, romaji, contoh, terjemahan, dan label JLPT belum diverifikasi satu per satu oleh ahli.
- 26 pasangan Kanji/kana berulang dari audit sebelumnya perlu tinjauan editorial; tidak dihapus otomatis.

## Status
V8 adalah paket hardening kode dan audit statis. **Belum dinyatakan siap produksi** sebelum pengujian staging dan validasi bahasa selesai.
