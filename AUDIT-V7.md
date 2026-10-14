# Nihongo Dasar V7 — Audit lanjutan

V7 adalah paket audit lanjutan berbasis kode V6, bukan klaim bahwa seluruh fungsi telah diuji di produksi. Database pembelajaran dan alur aplikasi dipertahankan agar perubahan audit tidak merusak fitur yang ada.

## Pemeriksaan yang dijalankan
- Konsistensi `CORE_VOCAB` di `index.html` dan `index-inline.js`: PASS, 1.108 entri pada masing-masing.
- Kolom data utama dan contoh: PASS menurut validasi struktur otomatis.
- Pemeriksaan sintaks JavaScript: PASS.
- Pemeriksaan ID pada HTML: 134 ID, tidak ada ID duplikat.
- Pemeriksaan statis alur `device_lock` dan Firebase Rules: PASS.

## Hal yang masih perlu tindakan
- 26 pasangan kanji/kana berulang harus ditinjau secara editorial, bukan dihapus otomatis.
- Validasi terjemahan, bacaan, romaji, contoh kalimat, dan level JLPT belum dilakukan menyeluruh oleh ahli.
- Firebase/Vercel belum diuji runtime karena memerlukan staging dan konfigurasi proyek pemilik.
- Login, Premium, admin, TTS, dan tampilan responsif perlu pengujian end-to-end.

Lihat `RELEASE-CHECKLIST-V7.md` untuk langkah sebelum rilis.
