# Checklist rilis Nihongo Dasar V9

## Sebelum deploy
- [ ] Backup ZIP dan versi produksi saat ini.
- [ ] Pastikan `ADMIN_EMAILS` hanya berisi email administrator yang benar.
- [ ] Pastikan Firebase Admin environment variables tersedia hanya di Vercel server-side.
- [ ] Pastikan `FIREBASE-RULES.json` ditinjau dan aturan langsung klien ke `device_lock` ditolak.
- [ ] Jalankan `npm run audit` dan `npm run audit:vocabulary`.

## Uji staging wajib
- [ ] Admin yang diizinkan dapat login; email non-admin ditolak.
- [ ] Token ID yang tidak valid, kedaluwarsa, dan dicabut ditolak.
- [ ] Akun admin tidak dapat dihapus, diubah lisensinya, di-reset password, atau di-reset device melalui manajemen user biasa.
- [ ] Password di bawah 12 karakter ditolak baik di UI maupun API.
- [ ] Buat, perpanjang, nonaktifkan, dan hapus akun uji; pastikan lisensi dan akun Auth tetap konsisten.
- [ ] Uji device lock dari dua browser/perangkat, heartbeat, release, sesi stale, dan jaringan putus.
- [ ] Uji penyimpanan harga dengan array terlalu besar dan teks sangat panjang.
- [ ] Uji fitur belajar, pencarian, audio, halaman admin, dan tampilan mobile.
- [ ] Periksa log server dan pastikan tidak ada private key/token yang tercetak.

## Keputusan rilis
Jangan menyebut V9 siap produksi sampai seluruh uji staging yang relevan lulus dan aturan Firebase yang akan diterapkan sudah direview. QA statis saja tidak cukup.
