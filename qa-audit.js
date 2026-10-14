#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
const clientFiles = ['index.html', 'index-inline.js'];
function readVocab(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const start = source.indexOf('const CORE_VOCAB = ');
  if (start < 0) throw new Error(`${file}: CORE_VOCAB not found`);
  const valueStart = start + 'const CORE_VOCAB = '.length;
  const valueEnd = source.indexOf('const LEARNING_DB', valueStart);
  if (valueEnd < 0) throw new Error(`${file}: CORE_VOCAB terminator not found`);
  let literal = source.slice(valueStart, valueEnd).trim();
  if (literal.endsWith(';')) literal = literal.slice(0, -1);
  try { return JSON.parse(literal); }
  catch (e) { throw new Error(`${file}: CORE_VOCAB invalid JSON: ${e.message}`); }
}
const a = readVocab(clientFiles[0]), b = readVocab(clientFiles[1]);
const issues = [], duplicates = new Map(), levels = {}, categories = {};
if (JSON.stringify(a) !== JSON.stringify(b)) issues.push('CORE_VOCAB differs between index.html and index-inline.js');
const required = [0,1,2,3,4,5,7];
a.forEach((row, i) => {
  if (!Array.isArray(row) || row.length < 11) { issues.push(`Row ${i+1}: expected 11 fields`); return; }
  for (const col of required) if (typeof row[col] !== 'string' || !row[col].trim()) issues.push(`Row ${i+1} (${row[0]||'?'}): missing field ${col}`);
  for (const col of [8,9,10]) if (typeof row[col] !== 'string' || !row[col].trim()) issues.push(`Row ${i+1} (${row[0]||'?'}): incomplete example field ${col}`);
  const key = `${row[0]}\t${row[1]}`; duplicates.set(key,(duplicates.get(key)||0)+1);
  const level = row[6] || 'Belum ditetapkan'; levels[level]=(levels[level]||0)+1;
  const cat = row[5] || 'Tanpa kategori'; categories[cat]=(categories[cat]||0)+1;
  if (row[2] && row[2] !== row[2].trim()) issues.push(`Row ${i+1} (${row[0]}): romaji has outer whitespace`);
});
// Static security regression checks: the browser must not access device_lock directly.
for (const file of clientFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/firebaseDB\.ref\(['"]device_lock\//.test(source)) issues.push(`${file}: direct client access to device_lock remains`);
  if (!source.includes("fetch('/api/device-lock'")) issues.push(`${file}: secure device-lock endpoint call missing`);
}
const rules = JSON.parse(fs.readFileSync(path.join(root, 'FIREBASE-RULES.json'), 'utf8'));
if (rules.rules.device_lock?.['.read'] !== false || rules.rules.device_lock?.['.write'] !== false) issues.push('FIREBASE-RULES.json: device_lock must deny direct client read/write');
if (!fs.existsSync(path.join(root, 'api/device-lock.js'))) issues.push('api/device-lock.js missing');
const dup = [...duplicates.entries()].filter(([,n])=>n>1);
console.log('Nihongo static QA — V10 (legacy vocabulary checks)');
console.log(`index.html entries: ${a.length}`); console.log(`index-inline.js entries: ${b.length}`);
console.log('JLPT / level distribution:', JSON.stringify(levels));
console.log(`duplicate kanji+kana keys: ${dup.length}`);
console.log(`structural/security static issues: ${issues.length}`);
if (dup.length) console.log('Duplicates for manual editorial review:', dup.map(([k,n])=>`${k.replace('\t',' / ')} (${n})`).join('; '));
if (issues.length) { console.error(issues.join('\n')); process.exitCode=1; }
else console.log('PASS: data is synchronized and structurally complete; device_lock direct client access is denied in rules and routed through the server endpoint. This static check does not prove runtime security or linguistic accuracy.');
