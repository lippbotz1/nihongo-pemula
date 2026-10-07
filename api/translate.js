'use strict';

const MAX_INPUT = 1600;
const TIMEOUT_MS = 9000;
const UNAVAILABLE_NOTE = 'Jika Translate sedang tidak tersedia, coba lagi beberapa saat.';

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}
function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function isJapanese(value) { return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(String(value || '')); }
function extractJson(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch (_) {} }
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {} }
  return null;
}
function kanaText(value) {
  const v = cleanText(value);
  if (!v) return '';
  // TTS reading must be kana-only (plus normal Japanese punctuation/spaces).
  // Kanji is intentionally rejected because a single kanji can have multiple readings.
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(v) ? '' : v;
}
function level(x, key) {
  const v = x?.politenessLevels?.[key] || {};
  return {
    available: v.available === true,
    japanese: cleanText(v.japanese),
    ttsKana: kanaText(v.ttsKana),
    romaji: cleanText(v.romaji),
    meaningIndonesia: cleanText(v.meaningIndonesia || v.meaning),
    usage: cleanText(v.usage)
  };
}
function normalizeResult(value, input) {
  const x = value && typeof value === 'object' ? value : {};
  const japanese = cleanText(x.japanese), romaji = cleanText(x.romaji);
  const meaning = cleanText(x.meaningIndonesia || x.meaning || x.indonesian);
  if (!japanese || !meaning || !romaji) return null;
  const rec = x.recommendation || {};
  const recommendation = {
    bestLabel: cleanText(rec.bestLabel) || 'Sopan / Polite',
    bestJapanese: cleanText(rec.bestJapanese) || japanese,
    bestTtsKana: kanaText(rec.bestTtsKana),
    bestRomaji: cleanText(rec.bestRomaji) || romaji,
    bestMeaning: cleanText(rec.bestMeaning) || meaning,
    bestUsage: cleanText(rec.bestUsage) || 'Pilihan paling aman untuk percakapan umum.',
    reason: cleanText(rec.reason) || 'Bentuk ini terdengar natural dan sopan untuk konteks umum.',
    shortAlternativeJapanese: cleanText(rec.shortAlternativeJapanese),
    shortAlternativeTtsKana: kanaText(rec.shortAlternativeTtsKana),
    shortAlternativeRomaji: cleanText(rec.shortAlternativeRomaji),
    shortAlternativeMeaning: cleanText(rec.shortAlternativeMeaning)
  };
  return {
    translatedText: japanese, ttsKana: kanaText(x.ttsKana), romaji, meaning,
    formality: cleanText(x.formality) || recommendation.bestLabel,
    explanation: cleanText(x.explanation) || 'Terjemahan AI dengan bentuk Bahasa Jepang yang natural dan sopan.',
    category: cleanText(x.category) || 'Ungkapan / Kosakata',
    pos: cleanText(x.pos) || '—', form: cleanText(x.form) || '—', jlpt: cleanText(x.jlpt) || 'Tidak ditentukan',
    alternative: cleanText(x.alternative) || '—', sourceLanguage: isJapanese(input) ? 'ja' : 'id',
    recommendation,
    politenessLevels: {
      casual: level(x, 'casual'), neutral: level(x, 'neutral'), polite: level(x, 'polite'),
      formal: level(x, 'formal'), honorific: level(x, 'honorific'), humble: level(x, 'humble')
    }
  };
}

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    japanese: {type:'string'}, romaji:{type:'string'}, meaningIndonesia:{type:'string'}, formality:{type:'string'}, explanation:{type:'string'},
    category:{type:'string'}, pos:{type:'string'}, form:{type:'string'}, jlpt:{type:'string'}, alternative:{type:'string'},
    recommendation: {type:'object', properties:{
      bestLabel:{type:'string'}, bestJapanese:{type:'string'}, bestTtsKana:{type:'string'}, bestRomaji:{type:'string'}, bestMeaning:{type:'string'}, bestUsage:{type:'string'}, reason:{type:'string'},
      shortAlternativeJapanese:{type:'string'}, shortAlternativeTtsKana:{type:'string'}, shortAlternativeRomaji:{type:'string'}, shortAlternativeMeaning:{type:'string'}
    }, required:['bestLabel','bestJapanese','bestTtsKana','bestRomaji','bestMeaning','bestUsage','reason','shortAlternativeJapanese','shortAlternativeTtsKana','shortAlternativeRomaji','shortAlternativeMeaning']},
    politenessLevels: {type:'object', properties:{
      casual:{type:'object',properties:{available:{type:'boolean'},japanese:{type:'string'},ttsKana:{type:'string'},romaji:{type:'string'},meaningIndonesia:{type:'string'},usage:{type:'string'}},required:['available','japanese','ttsKana','romaji','meaningIndonesia','usage']},
      neutral:{type:'object',properties:{available:{type:'boolean'},japanese:{type:'string'},ttsKana:{type:'string'},romaji:{type:'string'},meaningIndonesia:{type:'string'},usage:{type:'string'}},required:['available','japanese','ttsKana','romaji','meaningIndonesia','usage']},
      polite:{type:'object',properties:{available:{type:'boolean'},japanese:{type:'string'},ttsKana:{type:'string'},romaji:{type:'string'},meaningIndonesia:{type:'string'},usage:{type:'string'}},required:['available','japanese','ttsKana','romaji','meaningIndonesia','usage']},
      formal:{type:'object',properties:{available:{type:'boolean'},japanese:{type:'string'},ttsKana:{type:'string'},romaji:{type:'string'},meaningIndonesia:{type:'string'},usage:{type:'string'}},required:['available','japanese','ttsKana','romaji','meaningIndonesia','usage']},
      honorific:{type:'object',properties:{available:{type:'boolean'},japanese:{type:'string'},ttsKana:{type:'string'},romaji:{type:'string'},meaningIndonesia:{type:'string'},usage:{type:'string'}},required:['available','japanese','ttsKana','romaji','meaningIndonesia','usage']},
      humble:{type:'object',properties:{available:{type:'boolean'},japanese:{type:'string'},romaji:{type:'string'},meaningIndonesia:{type:'string'},usage:{type:'string'}},required:['available','japanese','romaji','meaningIndonesia','usage']}
    }, required:['casual','neutral','polite','formal','honorific','humble']}
  },
  required:['japanese','romaji','meaningIndonesia','formality','explanation','category','pos','form','jlpt','alternative','recommendation','politenessLevels']
};

function buildPrompt(input, sl) {
  const source = sl === 'ja' ? 'Bahasa Jepang' : 'Bahasa Indonesia';
  const target = sl === 'ja' ? 'Bahasa Indonesia' : 'Bahasa Jepang';
  return [
    'Kamu adalah penerjemah Jepang profesional sekaligus guru bahasa Jepang.',
    `Bahasa sumber: ${source}. Bahasa tujuan: ${target}.`,
    'Terjemahkan berdasarkan makna dan konteks, bukan kata-per-kata. Untuk output Jepang, prioritaskan bentuk sopan (丁寧語) yang natural sebagai hasil utama.',
    'Setiap input harus memiliki REKOMENDASI AI: pilih satu versi Jepang yang paling natural dan aman untuk konteks umum, jelaskan alasannya, dan bila masuk akal berikan versi singkat alternatif.',
    'Buat perbandingan tingkat kesopanan: casual, neutral, polite (丁寧語), formal, honorific (尊敬語), humble (謙譲語). Jangan memaksakan semua level. Jika sebuah level tidak punya bentuk khusus yang natural untuk kalimat tersebut, set available=false dan semua teks level itu kosong.',
    'Honorific dan humble hanya boleh diisi jika bentuk tersebut benar-benar sesuai secara tata bahasa dan konteks. Jangan mengarang bentuk hormat/humble hanya agar keenam kartu terisi.',
    'Untuk kalimat perkenalan, permintaan, pekerjaan, pelanggan, atasan, layanan, dan situasi resmi, jelaskan pilihan yang paling aman. Rekomendasi harus terdengar seperti jawaban manusia yang natural.',
    'Romaji wajib berupa Latin standar, bersih, konsisten, tanpa Kanji/Hiragana/Katakana. Jangan gunakan ejaan fonetik Indonesia seperti Kon-ni-chi-wa.',
    'SANGAT PENTING UNTUK AUDIO: setiap field Jepang yang akan dibaca TTS WAJIB memiliki field ttsKana/bestTtsKana/shortAlternativeTtsKana. Isinya harus menjadi pembacaan persis dari teks Jepang tersebut dalam HIRAGANA/KATAKANA, tanpa Kanji. Jangan menebak bacaan Kanji; tulis furigana lengkap untuk seluruh teks, termasuk partikel (misalnya は sebagai wa hanya jika teksnya memang dibaca wa).',
    'ttsKana harus benar-benar cocok dengan teks Jepang dan romaji yang diberikan. Untuk Kanji dengan banyak bacaan, pilih bacaan yang tepat sesuai konteks kalimat/arti yang ditulis. Jika bentuk level unavailable=false, ttsKana harus berupa string kosong.',
    'meaningIndonesia harus berupa arti Indonesia yang natural. explanation dan usage harus ringkas tetapi berguna untuk belajar.',
    'Jika input berupa Bahasa Jepang, pertahankan teks sumber sebagai konteks dan tetap berikan rekomendasi bentuk Jepang yang natural bila perlu.',
    'Jawab HANYA JSON sesuai schema. Jangan menambahkan markdown atau komentar.',
    JSON.stringify({input, schema:JSON_SCHEMA})
  ].join('\n');
}

async function callGemini(input, sl) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY missing'), {provider:'gemini',status:503});
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const controller = new AbortController(), timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try {
    const response=await fetch(url,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({
      contents:[{role:'user',parts:[{text:buildPrompt(input,sl)}]}],
      generationConfig:{temperature:0.15,responseMimeType:'application/json',responseSchema:JSON_SCHEMA}
    })});
    const text=await response.text();
    if(!response.ok)throw Object.assign(new Error('Gemini HTTP '+response.status),{provider:'gemini',status:response.status});
    const data=JSON.parse(text), output=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    const result=normalizeResult(extractJson(output),input);
    if(!result)throw Object.assign(new Error('Gemini returned invalid translation'),{provider:'gemini',status:502});
    return result;
  } finally {clearTimeout(timer);}
}
async function callGroq(input, sl) {
  const key=process.env.GROQ_API_KEY;
  if(!key)throw Object.assign(new Error('GROQ_API_KEY missing'),{provider:'groq',status:503});
  const model=process.env.GROQ_MODEL||'openai/gpt-oss-20b';
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try {
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({
      model,temperature:0.15,response_format:{type:'json_object'},messages:[
        {role:'system',content:buildPrompt('INPUT_PLACEHOLDER',sl).replace(/\{"input":"INPUT_PLACEHOLDER","schema":/,'{"input":"INPUT_PLACEHOLDER","schema":')},
        {role:'user',content:input}
      ]
    })});
    const text=await response.text();
    if(!response.ok)throw Object.assign(new Error('Groq HTTP '+response.status),{provider:'groq',status:response.status});
    const data=JSON.parse(text), output=data?.choices?.[0]?.message?.content||'';
    const result=normalizeResult(extractJson(output),input);
    if(!result)throw Object.assign(new Error('Groq returned invalid translation'),{provider:'groq',status:502});
    return result;
  } finally {clearTimeout(timer);}
}
async function handler(req,res){
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');return res.status(204).end();}
  if(req.method&&req.method!=='GET')return sendJson(res,405,{error:'method_not_allowed'});
  const q=cleanText(req.query?.q), sl=String(req.query?.sl||'').toLowerCase(), tl=String(req.query?.tl||'').toLowerCase();
  if(!q)return sendJson(res,400,{error:'q_is_required'});
  if(q.length>MAX_INPUT)return sendJson(res,413,{error:'q_too_long',message:'Teks terlalu panjang.'});
  if(!['id','ja'].includes(sl)||!['id','ja'].includes(tl)||sl===tl)return sendJson(res,400,{error:'unsupported_language_pair'});
  try {const result=await callGemini(q,sl);return sendJson(res,200,{...result,provider:'gemini',available:true});}
  catch(geminiError){try{const result=await callGroq(q,sl);return sendJson(res,200,{...result,provider:'groq',available:true});}
  catch(groqError){return sendJson(res,503,{error:'translate_unavailable',available:false,message:UNAVAILABLE_NOTE,providers:{gemini:geminiError?.status||503,groq:groqError?.status||503}});}}
}
module.exports=handler;
