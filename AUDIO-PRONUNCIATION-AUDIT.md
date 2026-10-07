# AUDIO / PRONUNCIATION FINAL AUDIT — NIHONGO DASAR

## Tujuan
Audit final dilakukan untuk memastikan teks yang dikirim ke TTS mengikuti bacaan yang ditampilkan, bukan membiarkan TTS menebak bacaan Kanji yang ambigu.

## Hasil audit data statis
- CORE_VOCAB: 1.000/1.000 memiliki JP + kana + romaji.
- Kosakata: audio menggunakan `kana` sebagai sumber TTS.
- Hiragana: 46 kartu dasar + 23 dakuten/handakuten, audio memakai kana langsung.
- Katakana: 46 kartu dasar + 23 dakuten/handakuten, audio memakai kana langsung.
- Kanji: 80/80 kartu memiliki mapping kana TTS eksplisit.
- Angka: 10/10 memiliki kana TTS eksplisit.
- Hari: 7/7 memiliki kana TTS eksplisit.
- Frasa: 18/18 memiliki data Jepang dan mekanisme TTS.
- Data vocabulary tidak memiliki kana kosong pada 1.000 record.
- Audit kana TTS: 0 kegagalan pada angka, hari, dan mapping Kanji.

## Kanji yang berpotensi ambigu
Untuk kartu Kanji tunggal, `data-speak` tidak lagi mengirim Kanji mentah. Setiap kartu menggunakan bacaan kana yang sesuai dengan romaji yang ditampilkan.

Contoh:
- 四 → `よん` → yon
- 七 → `なな` → nana
- 生 → `いきる` → ikiru
- 行 → `いく` → iku
- 来 → `くる` → kuru
- 語 → `ご` → go

Dengan cara ini, pilihan bacaan kartu dikunci oleh aplikasi. Jika sebuah Kanji mempunyai banyak onyomi/kunyomi, kartu tetap hanya mengajarkan satu bacaan yang ditampilkan pada kartu tersebut, bukan membiarkan TTS memilih sendiri.

## Angka
| Kanji | Romaji | Kana TTS |
|---|---|---|
| 一 | ichi | いち |
| 二 | ni | に |
| 三 | san | さん |
| 四 | yon | よん |
| 五 | go | ご |
| 六 | roku | ろく |
| 七 | nana | なな |
| 八 | hachi | はち |
| 九 | kyuu | きゅう |
| 十 | juu | じゅう |

## Hari
- 月曜日 → げつようび → getsuyoubi
- 火曜日 → かようび → kayoubi
- 水曜日 → すいようび → suiyoubi
- 木曜日 → もくようび → mokuyoubi
- 金曜日 → きんようび → kinyoubi
- 土曜日 → どようび → doyoubi
- 日曜日 → にちようび → nichiyoubi

## Kesopanan / formality
27 varian statis yang ditampilkan di bagian Kesopanan sekarang mempunyai `ttsKana` eksplisit jika teks Jepang mengandung Kanji.

Contoh:
- 誠にありがとうございます → まことにありがとうございます
- 申し訳ございません → もうしわけございません
- 召し上がる → めしあがる
- ご覧になる → ごらんになる

## Grammar
Contoh grammar statis sekarang juga memakai bacaan kana untuk TTS:
- 私は学生です。 → わたしはがくせいです。
- 水をください。 → みずをください。
- 日本へ行きたいです。 → にほんへいきたいです。

## Translate AI — perbaikan penting
Hasil Translate AI sebelumnya hanya mengirim teks Jepang ke TTS. Sekarang API meminta model mengembalikan field bacaan:
- `ttsKana`
- `bestTtsKana`
- `shortAlternativeTtsKana`
- `politenessLevels.*.ttsKana`

Field tersebut wajib berupa kana tanpa Kanji. Frontend menggunakan field kana tersebut untuk audio apabila tersedia. Ini mencegah TTS menebak bacaan Kanji tunggal/ambigu pada hasil Translate, rekomendasi AI, alternatif, dan kartu tingkat kesopanan.

Jika model mengembalikan `ttsKana` yang masih mengandung Kanji, server menolaknya sebagai bacaan TTS dan frontend memakai teks Jepang sebagai fallback konteks. Untuk hasil AI baru, prompt dan schema sekarang mewajibkan pembacaan kana.

## Voice selection
Aplikasi tetap menggunakan `ja-JP` dan memprioritaskan voice Jepang dengan locale `ja-JP` yang tersedia pada perangkat. Web Speech API menyediakan `lang` untuk bahasa utterance dan `voice` untuk memilih voice yang digunakan; daftar voice perangkat diperoleh melalui `getVoices()`.

## Verifikasi teknis
- `index.html` inline JavaScript: syntax OK
- `admin.html` inline JavaScript: syntax OK
- `index-inline.js`: syntax OK
- `api/translate.js`: syntax OK
- `api/admin-users.js`: syntax OK
- `api/premium-content.js`: syntax OK
- Static audio mapping audit: 0 failure
- Kanji cards: 80/80 mapped
- Numbers: 10/10 mapped
- Weekdays: 7/7 mapped
- Vocabulary: 1,000/1,000 have kana

## Batasan yang harus jujur disebutkan
Tidak ada aplikasi web yang dapat menjamin karakteristik suara fisik 100% identik di setiap HP/browser karena voice engine dan voice package disediakan oleh perangkat. Yang dikunci oleh aplikasi adalah **teks bacaan yang dikirim ke Japanese TTS**. Jadi aplikasi tidak lagi sengaja memberikan Kanji tunggal yang ambigu untuk ditebak TTS pada bagian yang sudah diaudit.
