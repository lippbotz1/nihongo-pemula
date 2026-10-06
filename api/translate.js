'use strict';

const MAX_INPUT = 1600;
const TIMEOUT_MS = 9000;
const UNAVAILABLE_NOTE = 'Jika Translate sedang tidak tersedia, coba lagi beberapa saat.';

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isJapanese(value) {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(String(value || ''));
}

function extractJson(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch (_) {}
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

function normalizeResult(value, input) {
  const x = value && typeof value === 'object' ? value : {};
  const japanese = cleanText(x.japanese);
  const romaji = cleanText(x.romaji);
  const meaning = cleanText(x.meaningIndonesia || x.meaning || x.indonesian);
  if (!japanese || !meaning || !romaji) return null;

  return {
    translatedText: japanese,
    romaji,
    meaning,
    formality: cleanText(x.formality) || 'Sopan / Polite',
    explanation: cleanText(x.explanation) || 'Terjemahan AI dengan bentuk bahasa Jepang yang natural dan sopan.',
    category: cleanText(x.category) || 'Ungkapan / Kosakata',
    pos: cleanText(x.pos) || '—',
    form: cleanText(x.form) || '—',
    jlpt: cleanText(x.jlpt) || 'Tidak ditentukan',
    alternative: cleanText(x.alternative) || '—',
    sourceLanguage: isJapanese(input) ? 'ja' : 'id'
  };
}

function buildPrompt(input, sl) {
  const source = sl === 'ja' ? 'Bahasa Jepang' : 'Bahasa Indonesia';
  const target = sl === 'ja' ? 'Bahasa Indonesia' : 'Bahasa Jepang';
  return [
    'Kamu adalah mesin penerjemah dan kamus Bahasa Jepang profesional.',
    `Bahasa sumber: ${source}. Bahasa tujuan: ${target}.`,
    'Terjemahkan teks pengguna secara akurat berdasarkan konteks, bukan sekadar kata per kata.',
    'Untuk output Bahasa Jepang, UTAMAKAN bentuk sopan/natural (丁寧語) kecuali konteks jelas membutuhkan bentuk lain.',
    'Jika input sudah Bahasa Jepang, pertahankan makna dan berikan bentuk Jepang natural; jika bentuknya kasar/kasual, boleh berikan versi sopan sebagai hasil utama.',
    'Romaji harus berupa romaji Latin standar dan TIDAK boleh mengandung Hiragana, Katakana, Kanji, atau karakter Jepang.',
    'meaningIndonesia harus menjelaskan arti dalam Bahasa Indonesia.',
    'formality wajib menyebut level seperti Kasual / Informal, Netral, Sopan / Polite, Formal, Honorific / 尊敬語, atau Humble / 謙譲語 bila relevan.',
    'alternative boleh berisi bentuk alternatif singkat; jangan mengarang jika tidak relevan.',
    'Jawab HANYA JSON valid tanpa markdown.',
    'Schema persis:',
    '{"japanese":"...","romaji":"...","meaningIndonesia":"...","formality":"...","explanation":"...","category":"...","pos":"...","form":"...","jlpt":"...","alternative":"..."}',
    `Teks pengguna: ${JSON.stringify(input)}`
  ].join('\n');
}

async function callGemini(input, sl) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY missing'), { provider: 'gemini', status: 503 });
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(input, sl) }] }],
        generationConfig: { temperature: 0.15, responseMimeType: 'application/json' }
      })
    });
    const text = await response.text();
    if (!response.ok) throw Object.assign(new Error('Gemini HTTP ' + response.status), { provider: 'gemini', status: response.status });
    const data = JSON.parse(text);
    const output = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const result = normalizeResult(extractJson(output), input);
    if (!result) throw Object.assign(new Error('Gemini returned invalid translation'), { provider: 'gemini', status: 502 });
    return result;
  } finally { clearTimeout(timer); }
}

async function callGroq(input, sl) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw Object.assign(new Error('GROQ_API_KEY missing'), { provider: 'groq', status: 503 });
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildPrompt('INPUT_PLACEHOLDER', sl).replace('Teks pengguna: "INPUT_PLACEHOLDER"', 'Teks pengguna diberikan pada pesan berikut.') },
          { role: 'user', content: input }
        ]
      })
    });
    const text = await response.text();
    if (!response.ok) throw Object.assign(new Error('Groq HTTP ' + response.status), { provider: 'groq', status: response.status });
    const data = JSON.parse(text);
    const output = data?.choices?.[0]?.message?.content || '';
    const result = normalizeResult(extractJson(output), input);
    if (!result) throw Object.assign(new Error('Groq returned invalid translation'), { provider: 'groq', status: 502 });
    return result;
  } finally { clearTimeout(timer); }
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method && req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });

  const q = cleanText(req.query?.q);
  const sl = String(req.query?.sl || '').toLowerCase();
  const tl = String(req.query?.tl || '').toLowerCase();
  if (!q) return sendJson(res, 400, { error: 'q_is_required' });
  if (q.length > MAX_INPUT) return sendJson(res, 413, { error: 'q_too_long', message: 'Teks terlalu panjang.' });
  if (!['id', 'ja'].includes(sl) || !['id', 'ja'].includes(tl) || sl === tl) {
    return sendJson(res, 400, { error: 'unsupported_language_pair' });
  }

  // AI-only: Gemini first, Groq second. No local dictionary, Google Translate,
  // MyMemory, offline translation, or cached translation is used here.
  try {
    const result = await callGemini(q, sl);
    return sendJson(res, 200, { ...result, provider: 'gemini', available: true });
  } catch (geminiError) {
    try {
      const result = await callGroq(q, sl);
      return sendJson(res, 200, { ...result, provider: 'groq', available: true });
    } catch (groqError) {
      return sendJson(res, 503, {
        error: 'translate_unavailable',
        available: false,
        message: UNAVAILABLE_NOTE,
        providers: {
          gemini: geminiError?.status || 503,
          groq: groqError?.status || 503
        }
      });
    }
  }
}

module.exports = handler;
