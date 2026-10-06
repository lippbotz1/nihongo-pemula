# Nihongo Premium Final

Includes the main learning/translator app, Firebase Auth login, admin dashboard, admin API, translation API, client translation engine, Vercel config, and Firebase rules.


## Translate AI-only
Translate pada aplikasi ini tidak lagi menggunakan kamus lokal/offline, Google Translate, atau MyMemory. Semua permintaan Translate dikirim ke `/api/translate`. Backend mencoba Gemini terlebih dahulu dan Groq sebagai cadangan. Jika kedua provider tidak tersedia/terkena limit, UI menampilkan: `Jika Translate sedang tidak tersedia, coba lagi beberapa saat.`

Environment Variables Vercel:
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `GEMINI_MODEL` (opsional; default `gemini-3.5-flash-lite`)
- `GROQ_MODEL` (opsional; default `openai/gpt-oss-20b`)
