# Checklist Rilis — Nihongo Dasar V12 FINAL

## Pemeriksaan lokal
- [x] Static QA V12 dan pemeriksaan sintaks JavaScript dijalankan.
- [x] QA kosakata membandingkan jumlah entri pada dua sumber.
- [x] UI simulasi ujian menjelaskan bahwa ini bukan ujian resmi JLPT lengkap.
- [x] Fitur ekspor progres menggunakan file JSON.
- [x] ZIP diperiksa dengan `unzip -t`.

## Wajib sebelum rilis publik
- [ ] Uji halaman di Android, iOS, dan desktop browser.
- [ ] Uji login/logout, token kedaluwarsa/dicabut, pembatasan perangkat, reset password, dan seluruh operasi admin pada staging.
- [ ] Verifikasi Firebase Rules dan environment variables di dashboard proyek.
- [ ] Periksa seluruh materi bahasa Jepang dengan peninjau yang kompeten.
- [ ] Uji keyboard, pembaca layar, kontras, dan kondisi jaringan lambat.
- [ ] Siapkan kebijakan privasi, ketentuan layanan, dan mekanisme backup/restore data.

Static QA bukan jaminan keamanan penuh atau pengganti pengujian runtime.
