# Nihongo Premium — Final Package

## Vercel Environment Variables
Set these server-side in Vercel:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- FIREBASE_DATABASE_URL
- ADMIN_EMAILS

Do NOT put the Firebase service-account private key in HTML/JS or commit it to this ZIP.

## Firebase Authentication
Enable Email/Password in Firebase Authentication.

## Firebase Realtime Database
Apply FIREBASE-RULES.json in Realtime Database > Rules.

## Deploy
Upload this project to Vercel. The user app is `/` and the admin panel is `/admin.html`.

## Admin features
- Create premium account
- 30/90/365/Lifetime
- Renew without losing remaining time
- Change password
- Reset device lock
- Enable/disable
- Delete user

## Important security
If a Firebase service-account JSON/private key was ever exposed in a screenshot/chat, revoke that key in Google Cloud/Firebase IAM and generate a replacement before production use.


### Translate AI
Tambahkan Environment Variables berikut pada project Vercel yang sama:
`GEMINI_API_KEY` dan `GROQ_API_KEY`. Opsional: `GEMINI_MODEL` dan `GROQ_MODEL`. Translate tidak memiliki fallback lokal/offline. Jika Gemini gagal atau terkena rate limit, backend mencoba Groq. Jika keduanya gagal, endpoint mengembalikan HTTP 503 dan UI memberi catatan untuk mencoba lagi beberapa saat.
