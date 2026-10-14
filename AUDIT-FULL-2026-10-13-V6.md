# Nihongo Dasar — Audit V6
Tanggal: 13 Oktober 2026

## Fokus V6
V6 memprioritaskan masalah keamanan yang telah ditandai sebagai penghambat rilis di V5: akses langsung klien ke `device_lock`.

## Perubahan
- Menambahkan `api/device-lock.js`, endpoint server yang memverifikasi Firebase ID token dengan Firebase Admin SDK.
- Identitas lock diambil dari UID token terverifikasi, bukan email/UID dari request body.
- Operasi claim/heartbeat menggunakan transaksi Realtime Database untuk menghindari dua perangkat mengklaim lock aktif secara bersamaan.
- Lease perangkat dianggap kedaluwarsa setelah 90 detik tanpa heartbeat; klien mengirim heartbeat setiap 30 detik.
- Release hanya menghapus lock jika `deviceId` cocok dengan pemilik lock.
- Klien `index.html` dan `index-inline.js` diarahkan ke endpoint server; tidak lagi membaca/menulis `device_lock` secara langsung.
- `FIREBASE-RULES.json` menolak akses baca/tulis klien pada cabang `device_lock`.
- Aksi reset perangkat admin sekarang menghapus `device_lock/<uid>` setelah memverifikasi pengguna melalui Firebase Admin.
- QA statis diperluas untuk mendeteksi regresi akses langsung ke `device_lock`.

## Pengujian yang berhasil
- `node --check index-inline.js`
- `node --check api/device-lock.js`
- `node --check api/admin-users.js`
- Pemeriksaan sintaks untuk API lain
- `node qa-audit.js`: data tetap sinkron, 1.108 entri, tidak ada masalah struktur, dan pemeriksaan statis keamanan lolos.
- ZIP dibuat ulang dan diverifikasi.

## Batasan / release checklist
Pemeriksaan ini belum mencakup pengujian runtime pada Firebase/Vercel staging. Sebelum produksi, lakukan:
- Deploy endpoint dan konfigurasi environment Firebase Admin terlebih dahulu; kemudian terapkan rules deny-all untuk `device_lock`.
- Uji login pertama, refresh, logout, dua perangkat bersamaan, lease kedaluwarsa, reset admin, token kedaluwarsa, serta percobaan akses silang antar-UID.
- Pastikan `FIREBASE_DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, dan `FIREBASE_PRIVATE_KEY` tersedia di Vercel.
- Uji kegagalan jaringan. Klien sengaja gagal menutup akses login ketika pemeriksaan lock tidak dapat diverifikasi.
- Lakukan proofreading bahasa oleh pengajar/penutur Jepang; pemeriksaan struktur bukan validasi linguistik.
- Uji Premium, admin, terjemahan, TTS, dan layout pada HP/desktop.

## Database
- Total: 1.108 entri
- N5: 644; N4: 358; N3: 54; N2: 39; belum ditetapkan: 13
- 26 pasangan Kanji/kana berulang tetap dilaporkan untuk tinjauan editorial, tidak dihapus otomatis.

Klasifikasi level bersifat editorial dan bukan daftar resmi JLPT. V6 tidak menyatakan situs sudah production-ready sebelum uji staging selesai.
