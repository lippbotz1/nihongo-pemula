# Nihongo Dasar V9 — Security regression pass and release preparation

Tanggal paket: 14 Oktober 2026.

## Perubahan kode yang dibuat

- Verifikasi Firebase ID token pada endpoint admin dan device-lock sekarang meminta pemeriksaan revocation (`verifyIdToken(token, true)`). Token yang sudah dicabut semestinya ditolak oleh Firebase Admin SDK.
- Endpoint admin melindungi akun yang email-nya terdaftar di `ADMIN_EMAILS` dari operasi update lisensi, penghapusan akun, reset password, dan reset device. Ini mencegah akun admin ikut terhapus/diubah lewat operasi manajemen user biasa.
- Password akun baru dan reset password admin dinaikkan ke minimal 12 karakter; UI admin disamakan dengan validasi server.
- Penyimpanan konfigurasi harga membatasi jumlah paket hingga 30, panjang label/deskripsi, rentang hari, dan angka harga.
- Header keamanan dasar (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) ditambahkan pada endpoint admin dan device-lock; respons tetap `no-store`.
- QA regresi V9 ditambahkan dan perintah `npm run audit` disediakan.

## Pemeriksaan yang dijalankan

- `node --check` untuk endpoint API dan skrip JavaScript.
- Pemeriksaan sintaks tiga blok JavaScript inline pada `index.html` dan `admin.html`.
- Pemeriksaan sinkronisasi `CORE_VOCAB` menggunakan `qa-audit.js`.
- QA statis untuk revocation checking, perlindungan target admin, validasi password, pembatasan konfigurasi harga, Firebase Rules, dan tidak adanya akses langsung klien ke `device_lock`.

## Data materi

- `CORE_VOCAB`: 1.108 entri di `index.html` dan `index-inline.js`.
- Distribusi label saat ini: N5 644, N4 358, N3 54, N2 39, belum ditetapkan 13.
- 26 pasangan Kanji/kana berulang tetap ditandai untuk pemeriksaan editorial; tidak dihapus otomatis karena bisa jadi ada perbedaan konteks/kategori.

## Batasan yang belum selesai

- Ini adalah audit kode statis, bukan penetration test dan bukan bukti sistem aman di produksi.
- Belum ada pengujian live Firebase/Vercel, dua sesi perangkat bersamaan, token dicabut, pengguna admin vs non-admin, pembayaran, atau browser/perangkat nyata.
- Akun admin yang email-nya cocok dengan `ADMIN_EMAILS` dilindungi oleh operasi manajemen user, tetapi konfigurasi env dan daftar admin tetap harus dikelola aman di Vercel.
- Endpoint admin masih membaca beberapa cabang presence/history untuk panel admin; aksesnya bergantung pada kontrol admin allowlist.
- Validasi bahasa oleh pengajar/penutur asli belum dilakukan untuk seluruh kosakata. Pemeriksaan struktur bukan pemeriksaan akurasi linguistik.
- Terapkan ke staging terlebih dahulu dan siapkan backup sebelum mengganti produksi.
