# Checklist staging sebelum rilis V8

## API & autentikasi
- [ ] Tanpa Authorization header: endpoint terlindungi mengembalikan 401.
- [ ] Token Firebase palsu/kedaluwarsa: ditolak.
- [ ] Akun non-admin memanggil `api/admin-users`: 403.
- [ ] UID kosong/berisi karakter path di semua aksi admin: 400 dan tidak ada operasi database.
- [ ] Error Firebase tidak membocorkan stack trace atau kredensial pada respons publik.

## Kunci perangkat
- [ ] Perangkat A dapat claim dan heartbeat.
- [ ] Perangkat B ditolak saat lease A masih aktif.
- [ ] Perangkat B dapat claim setelah lease kedaluwarsa sesuai kebijakan.
- [ ] Release dari perangkat B tidak dapat menghapus lock perangkat A.
- [ ] Token invalid ditolak; rules menolak akses klien langsung ke `device_lock`.
- [ ] Uji tab ditutup, browser force-stop, offline, dan pemulihan sesi.

## Firebase & admin
- [ ] Backup rules lama sebelum perubahan.
- [ ] Verifikasi `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, dan `FIREBASE_DATABASE_URL` di environment Vercel.
- [ ] `ADMIN_EMAILS` diisi hanya dengan email admin yang sah.
- [ ] Uji buat/perpanjang/nonaktifkan/hapus akun, reset password, reset device.
- [ ] Tentukan apakah `presence` dan `login_history` boleh ditulis klien; jangan gunakan data tersebut sebagai bukti keamanan tanpa validasi server.

## Browser & materi
- [ ] Uji layar kecil dan desktop, navigasi, pencarian, audio/TTS, login, Premium, dan admin.
- [ ] Proofread bahasa Jepang, kana/kanji, romaji, arti Indonesia, contoh, dan tingkat kesopanan.
- [ ] Verifikasi label level JLPT sebagai klasifikasi editorial, bukan jaminan resmi.

**Jangan rilis ke produksi sebelum seluruh item yang relevan diuji pada staging.**
