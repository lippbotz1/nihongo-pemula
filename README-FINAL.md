# Nihongo Dasar V12 FINAL

## File utama
- `index.html`: website pembelajaran
- `index-inline.js`: logika pembelajaran, quiz, flashcard/review, simulasi ujian, ekspor progres
- `admin.html`: panel admin lokal
- `api/`: endpoint serverless untuk Vercel
- `FIREBASE-RULES.json`: contoh aturan database yang perlu ditinjau sebelum diterapkan

## QA lokal
Gunakan Node.js versi 18 atau lebih baru:

```bash
npm run audit
npm run audit:vocabulary
```

`npm run audit` menjalankan pemeriksaan statis dan sintaks; ini tidak melakukan login live ke Firebase atau deploy Vercel.

## Deploy
1. Ekstrak isi folder ini ke repositori proyek.
2. Periksa `vercel.json` dan semua endpoint di `api/`.
3. Atur environment variables yang diperlukan melalui dashboard Vercel (jangan taruh rahasia server di file HTML).
4. Pastikan Firebase Authentication, Realtime Database Rules, dan konfigurasi proyek sesuai dengan proyek Firebase milikmu.
5. Deploy ke staging terlebih dahulu; lakukan tes login, lisensi, device lock, admin, ujian, dan ekspor progres sebelum publikasi.
6. `admin.html` adalah panel lokal; jangan mengunggahnya ke hosting publik bila memang ingin tetap lokal.

## Catatan
- Progres, favorit, jadwal review, dan riwayat ujian tersimpan di browser lokal.
- Simulasi ujian hanya menguji kosakata dan bukan ujian resmi JLPT lengkap.
- Proofreading kosakata oleh pengajar bahasa Jepang dan tes runtime di perangkat nyata masih diperlukan sebelum penjualan.
