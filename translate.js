'use strict';

// AI-only translation architecture. The active Translate UI calls /api/translate.
// No local dictionary, offline translation, Google Translate, or MyMemory fallback.
// Gemini is primary; Groq is the secondary provider.
module.exports = {
  mode: 'ai-only',
  endpoint: '/api/translate',
  providers: ['gemini', 'groq']
};
