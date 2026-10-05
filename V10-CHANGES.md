# Nihongo Premium V10 — Secure Premium Content

## Perubahan utama
- Data vocabulary Premium `CORE_VOCAB` tidak lagi dibundel di `index.html`.
- Data Premium dipindahkan ke dalam serverless function `/api/premium-content` sehingga tidak tersedia sebagai file JSON publik/static.
- Endpoint `/api/premium-content` memverifikasi Firebase ID Token dan lisensi Premium melalui Firebase Admin SDK sebelum mengirim data.
- Browser hanya meminta konten Premium setelah login dan lisensi aktif.
- Endpoint memakai `Cache-Control: private, no-store` dan timeout fetch client 8 detik.
- Expiry lisensi tetap diverifikasi server-side saat meminta konten.
- Sistem v9.1 (renewal, expiry watcher, admin management) dipertahankan.

## Batasan
Setelah user Premium menerima data ke browser, data tersebut secara teknis tetap dapat dilihat oleh user tersebut. Tidak ada aplikasi web client-side yang dapat menjamin anti-copy 100%.

## Deployment
Environment Firebase Admin yang sama seperti v9.1 tetap diperlukan:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- FIREBASE_DATABASE_URL
- ADMIN_EMAILS

## Hardening V10 final
- `premium-content.json` publik dihapus dari root project.
- Dataset 359 kosakata dibundel langsung ke serverless endpoint yang dilindungi Firebase ID Token + lisensi aktif.
- `ADMIN_EMAILS` disiapkan untuk `mealipplipp@gmail.com`; password tidak disimpan di source/ZIP.
