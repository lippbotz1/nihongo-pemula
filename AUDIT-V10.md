# Nihongo Dasar V10 — XSS regression hardening

Tanggal: 14 Oktober 2026.

## Perubahan V10

- Riwayat terjemahan sekarang meng-escape teks Jepang, romaji, arti Indonesia, dan atribut teks suara sebelum dirender sebagai HTML. Ini menutup jalur stored DOM-XSS yang dapat muncul bila isi localStorage berisi markup berbahaya.
- Pesan error login di-escape sebelum ditambahkan bersama tautan bantuan WhatsApp.
- Perubahan diterapkan konsisten pada `index.html` dan `index-inline.js`.
- QA regresi ditingkatkan untuk menguji perlindungan ini.

## Hasil pemeriksaan lokal

- `node qa-audit-v10.js`: 21 pemeriksaan statis lulus, 0 gagal.
- `node qa-audit.js`: pemeriksaan struktur kosakata dan sinkronisasi sumber dijalankan.
- Pemeriksaan sintaks API dan skrip JavaScript lokal lulus.
- Blok skrip inline `index.html` dan `admin.html` diperiksa dengan parser JavaScript.
- ZIP diperiksa menggunakan `unzip -t` setelah dibuat.

## Batasan

Audit ini bukan penetration test, bukan pengujian browser penuh, dan bukan verifikasi live Firebase/Vercel. Data kosakata belum melalui proofreading menyeluruh oleh pengajar/penutur asli. Terapkan ke staging dahulu dan lakukan tes login, riwayat terjemahan, device-lock, admin, serta perangkat seluler sebelum mengganti produksi.
