# Admin Panel — Nihongo Premium V10

## Fungsi
`admin.html` terhubung ke Firebase Authentication + Realtime Database melalui endpoint server `/api/admin-users`.
Kamu tidak perlu upload ulang `index.html` ketika ada pembeli baru.

## Vercel Environment Variables
Tambahkan:
- `FIREBASE_PROJECT_ID` = `nihongo-premium`
- `FIREBASE_CLIENT_EMAIL` = email service account Firebase Admin SDK
- `FIREBASE_PRIVATE_KEY` = private key service account; boleh satu baris dengan `\\n` atau multiline sesuai Vercel
- `FIREBASE_DATABASE_URL` = `https://nihongo-premium-default-rtdb.asia-southeast1.firebasedatabase.app`
- `ADMIN_EMAILS` = `mealipplipp@gmail.com`
  - Jangan simpan password admin di file proyek, ZIP, atau database.

## Firebase
1. Authentication → Email/Password aktif.
2. Buat akun admin menggunakan Firebase Authentication dengan email yang sama dengan `ADMIN_EMAILS`.
3. Jangan masukkan password admin ke kode atau database Realtime Database.
4. Terapkan `FIREBASE-RULES.json`.

## Deploy
Upload seluruh folder project ke Vercel. Setelah environment variables disimpan, lakukan Redeploy.
Buka `/admin.html`.

## Alur penjualan
Pembeli bayar → buka `/admin.html` → login admin → isi email + password + durasi → Buat Akun → pembeli langsung bisa login di `index.html`.
Tidak perlu edit atau upload ulang `index.html`.

## Catatan keamanan
Endpoint admin memverifikasi Firebase ID token di server dan hanya mengizinkan email yang ada di `ADMIN_EMAILS`. Firebase Admin SDK memakai service-account secret yang hanya berada di environment server Vercel.
