'use strict';

const CACHE = new Map();
const TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE = 200;

function cacheGet(key) {
  const item = CACHE.get(key);
  if (!item) return '';
  if (Date.now() - item.ts > TTL) {
    CACHE.delete(key);
    return '';
  }
  return item.value;
}

function cacheSet(key, value) {
  if (!value) return;
  CACHE.set(key, { ts: Date.now(), value });
  while (CACHE.size > MAX_CACHE) {
    const first = CACHE.keys().next().value;
    if (first === undefined) break;
    CACHE.delete(first);
  }
}

function latinOnly(value) {
  if (!value || typeof value !== 'string') return false;
  const s = value.trim();
  return !/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(s) &&
    /^[A-Za-z0-9\s.,!?"“”‘’'\-:;()\/]+$/.test(s);
}

function parseTranslation(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
  return data[0].map(function (part) {
    return Array.isArray(part) ? (part[0] || '') : '';
  }).join('').trim();
}

function parseRomanization(data) {
  if (!Array.isArray(data)) return '';

  // Google Translate's unofficial dt=rm response has appeared in more than
  // one shape. Prefer the dedicated transliteration block (data[2]).
  const block = data[2];
  if (Array.isArray(block)) {
    const parts = block.map(function (item) {
      if (Array.isArray(item)) return item[0] || '';
      return typeof item === 'string' ? item : '';
    }).filter(function (x) { return latinOnly(x); });
    const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) return joined;
  }

  // Older responses put the transliteration marker at the end of data[0].
  if (Array.isArray(data[0])) {
    const last = data[0][data[0].length - 1];
    if (Array.isArray(last) && last[0] === 1 && typeof last[1] === 'string' && latinOnly(last[1])) {
      return last[1].trim();
    }

    // Fallback: inspect all nested values, but never accept Japanese text.
    const candidates = [];
    function walk(value) {
      if (typeof value === 'string') {
        if (latinOnly(value) && value.trim()) candidates.push(value.trim());
        return;
      }
      if (Array.isArray(value)) value.forEach(walk);
    }
    data[0].forEach(walk);
    if (candidates.length) {
      // The first candidate in normal translation segments is often an
      // English gloss. Prefer the final candidate, which is the rm block.
      return candidates[candidates.length - 1];
    }
  }
  return '';
}

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

async function handler(req, res) {
  // Allow simple browser requests and health checks.
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method && req.method !== 'GET') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const query = req.query || {};
  const q = String(query.q || '').trim();
  const sl = String(query.sl || 'id').trim().toLowerCase();
  const tl = String(query.tl || 'ja').trim().toLowerCase();
  const mode = String(query.mode || 'translate').trim().toLowerCase();

  if (!q) return sendJson(res, 400, { error: 'q_is_required' });
  if (!['id', 'ja'].includes(sl) || !['id', 'ja'].includes(tl)) {
    return sendJson(res, 400, { error: 'unsupported_language_pair' });
  }
  if (!['translate', 'romaji'].includes(mode)) {
    return sendJson(res, 400, { error: 'unsupported_mode' });
  }

  const key = mode + '|' + sl + '|' + tl + '|' + q;
  const cached = cacheGet(key);
  if (cached) {
    return sendJson(res, 200, mode === 'romaji'
      ? { romaji: cached }
      : { translatedText: cached });
  }

  try {
    if (mode === 'romaji') {
      if (sl !== 'ja') return sendJson(res, 400, { error: 'romaji_requires_japanese' });

      const url = 'https://translate.googleapis.com/translate_a/single' +
        '?client=gtx&sl=ja&tl=en&dt=t&dt=rm&q=' + encodeURIComponent(q);

      const response = await fetch(url, {
        headers: { accept: 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        const romaji = parseRomanization(data);
        if (romaji && latinOnly(romaji)) {
          cacheSet(key, romaji);
          return sendJson(res, 200, { romaji: romaji });
        }
      }

      // Do not return Japanese text as a fake romaji result.
      return sendJson(res, 200, { romaji: '' });
    }

    if (sl === tl) {
      return sendJson(res, 200, { translatedText: q });
    }

    const url = 'https://translate.googleapis.com/translate_a/single' +
      '?client=gtx&sl=' + encodeURIComponent(sl) +
      '&tl=' + encodeURIComponent(tl) +
      '&dt=t&q=' + encodeURIComponent(q);

    const response = await fetch(url, {
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      return sendJson(res, 502, { error: 'translation_provider_unavailable' });
    }

    const data = await response.json();
    const translated = parseTranslation(data);
    if (!translated) {
      return sendJson(res, 502, { error: 'translation_unavailable' });
    }

    cacheSet(key, translated);
    return sendJson(res, 200, { translatedText: translated });
  } catch (error) {
    return sendJson(res, 502, { error: 'translation_service_unavailable' });
  }
}

module.exports = handler;
