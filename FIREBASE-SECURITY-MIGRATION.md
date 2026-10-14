# Firebase device-lock security migration — V6

## Status
V6 mengimplementasikan endpoint server untuk device lock dan aturan database yang menolak akses langsung klien. Perubahan tetap harus diuji di staging sebelum dinyatakan aman untuk produksi.

## Cara kerja
1. Klien mengirim Firebase ID token pada header `Authorization: Bearer ...` ke `/api/device-lock`.
2. Server memverifikasi token dengan Firebase Admin SDK dan mengambil `uid` dari token terverifikasi.
3. Server menyimpan lock pada `device_lock/<uid>` menggunakan transaksi database.
4. `claim`/`heartbeat` hanya memperbarui lock bila belum ada, lease sudah kedaluwarsa (90 detik), atau perangkat yang sama memilikinya.
5. `release` hanya menghapus lock jika device ID cocok.
6. Reset dari admin menghapus lock UID-keyed lewat API admin yang sudah mengautentikasi admin.
7. Firebase rules menolak `.read` dan `.write` langsung pada `device_lock`.

## Environment Vercel wajib
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (format newline aktual atau `\\n`)
- `FIREBASE_DATABASE_URL`
- `ADMIN_EMAILS` untuk endpoint admin yang sudah ada

## Urutan rollout penting
1. Pastikan environment Firebase Admin sudah disetel di Vercel.
2. Deploy V6 termasuk `api/device-lock.js`.
3. Terapkan isi `FIREBASE-RULES.json` ke Firebase Realtime Database Rules.
4. Uji login dan alur perangkat di staging. Jangan menerapkan rules deny-all pada proyek yang masih menjalankan frontend lama karena frontend lama membaca lock langsung dan akan gagal.

## Uji staging wajib
- Login dan refresh pada perangkat yang sama.
- Logout; pastikan lock dilepas.
- Login bersamaan dari dua perangkat; perangkat kedua harus ditolak selama lease aktif.
- Perangkat mati/putus jaringan; lock harus dapat diambil setelah lease kedaluwarsa.
- Reset lock dari admin; pastikan hanya admin yang dapat menjalankannya.
- Token hilang/kedaluwarsa; endpoint harus menolak permintaan.
- User A tidak dapat membaca atau mengubah lock User B lewat request.
- Simulasikan API tidak tersedia; login harus gagal tertutup dengan pesan yang bisa dipahami.

Catatan: device ID di browser adalah mekanisme pembatasan sesi, bukan identitas perangkat yang tahan manipulasi. Jangan menganggapnya sebagai DRM atau bukti keamanan perangkat fisik.
