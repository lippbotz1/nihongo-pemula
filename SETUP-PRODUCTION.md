# Nihongo Premium v9 — production setup

1. Deploy this folder to Vercel.
2. In Firebase Authentication, enable Email/Password. Create each customer account there.
3. In Realtime Database, apply FIREBASE-RULES.json.
4. Create `nihongo_public` with `wa`, `pricing`, and `reviews`.
5. For each Firebase Auth user, create `/licenses/<UID>` with `active:true`, `duration:30|90|365|9999`, and `expiresAt` as a Unix timestamp in milliseconds (or omit for lifetime).
6. The customer login now uses Firebase Auth; passwords are never stored in localStorage or bundled into the site.
7. Translation browser calls go only to `/api/translate`; provider access is server-side.

IMPORTANT: the learning vocabulary is still bundled in the client in v9 for compatibility with the existing learning UI. If you need hard DRM-grade protection of premium vocabulary, move that dataset behind an authenticated API before selling high-value proprietary content.


## V10 Secure Premium Content

V10 menambahkan endpoint `/api/premium-content`. Data vocabulary Premium tidak lagi dibundel di `index.html`; endpoint memerlukan Firebase ID Token dan memvalidasi lisensi melalui Firebase Admin SDK. Pastikan environment Firebase Admin di Vercel tetap terpasang seperti pada SETUP-ADMIN.md. Jangan menghapus `premium-content.json`.
