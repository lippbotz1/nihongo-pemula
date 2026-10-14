# Laporan Audit Nihongo Dasar — 12 Oktober 2026

## Perubahan yang diterapkan
- Mempertahankan struktur utama aplikasi (Belajar, Quiz, Translate, Checklist, Dashboard, Pengaturan) dan alur login/premium yang sudah ada.
- Menambahkan **48 entri kosakata Jepang** dengan kana, romaji, kelas kata, kategori, level JLPT, contoh kalimat, romaji contoh, dan arti Indonesia.
- Menambahkan tab **Bahasa Lain** yang bisa dipakai tanpa API: 32 frasa praktis dalam bahasa Jepang, Inggris, Korea, dan Mandarin, lengkap dengan pencarian, filter bahasa, arti/konteks, dan tombol audio.
- Audio pada tab multibahasa meminta voice sesuai bahasa (`ja-JP`, `en-US`, `ko-KR`, `zh-CN`) dan memilih voice yang tersedia. Browser/perangkat tetap menentukan voice yang terpasang.
- Merapikan panel multibahasa agar responsif, dengan dua kolom pada layar lebar dan satu kolom pada ponsel.
- Mengubah viewport agar tidak mematikan kemampuan zoom pengguna dan memperbarui judul halaman.
- Menyertakan file audit ini dalam ZIP.

## Pemeriksaan teknis yang dilakukan
- JavaScript inline utama lolos `node --check`.
- `api/translate.js`, `api/admin-users.js`, `api/premium-content.js`, dan `index-inline.js` lolos pemeriksaan sintaks Node.js.
- Database `CORE_VOCAB` pada `index-inline.js`: 1.000 entri awal + 48 entri baru = 1.048 entri.
- Tab Bahasa Lain ditambahkan sebagai tab belajar biasa; pencarian/filter berjalan lokal dan tidak membutuhkan API.

## Catatan penting sebelum dijual (belum bisa dipastikan hanya dari audit statis)
1. **Uji browser nyata masih wajib**: Firebase login, pemulihan sesi, pembelian/premium, pembayaran/WhatsApp, TTS di Android/iOS/desktop, dan layout pada perangkat berbeda perlu dites dengan kredensial dan deployment milik pemilik.
2. `FIREBASE-RULES.json` berisi aturan `device_lock` yang mengizinkan pengguna terautentikasi membaca/menulis cabang tersebut secara luas. Tinjau dan perketat sebelum produksi agar pengguna tidak dapat memanipulasi lock perangkat pengguna lain. Perubahan aturan tanpa memahami struktur data bisa merusak fitur, jadi tidak diubah otomatis.
3. Endpoint admin bergantung pada environment variables server (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`, `ADMIN_EMAILS`). Pastikan variabel ini dikonfigurasi di Vercel dan `ADMIN_EMAILS` hanya berisi email admin yang sah.
4. Firebase client config yang berada di frontend bukan pengganti keamanan. Keamanan data harus dijamin oleh Firebase Rules dan pemeriksaan otorisasi server; jangan pernah menaruh private key/service-account key atau API secret di HTML/JS publik.
5. Terjemahan, romaji, dan contoh baru ditulis dengan makna kontekstual umum, tetapi materi bahasa yang akan dijual tetap perlu ditinjau penutur/pengajar Jepang. Romaji hanyalah bantuan baca; kana adalah sumber bacaan TTS yang lebih aman daripada menebak bacaan kanji.
6. Tab Bahasa Lain adalah **frasa praktis pengantar**, bukan klaim kursus lengkap untuk Inggris, Korea, atau Mandarin. Untuk voice, perangkat yang tidak memiliki voice bahasa terkait dapat melafalkan dengan aksen yang keliru atau tidak tersedia.

## Saran tahap berikutnya
- Jalankan tes fungsional penuh di staging/Vercel sebelum mengganti build produksi.
- Lakukan audit hak akses Firebase Rules dan API admin, lalu tes negatif dengan akun non-admin.
- Lakukan proofreading bahasa per kategori serta tes TTS semua kartu pada beberapa browser.
