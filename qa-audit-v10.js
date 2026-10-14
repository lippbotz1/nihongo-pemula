#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
const failures = [];
let assertions = 0;
const check = (condition, message) => { assertions++; if (!condition) failures.push(message); };
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const adminApi = read('api/admin-users.js');
const deviceApi = read('api/device-lock.js');
const index = read('index.html');
const inline = read('index-inline.js');
const rules = JSON.parse(read('FIREBASE-RULES.json'));

check(adminApi.includes("verifyIdToken(h.slice(7),true)"), 'Admin API must verify revoked ID tokens.');
check(deviceApi.includes('verifyIdToken(header.slice(7), true)'), 'Device-lock API must verify revoked ID tokens.');
check(adminApi.includes('rejectAdminTarget(uid)'), 'Sensitive admin actions must protect allowlisted admin accounts.');
for (const action of ['update','delete','resetPassword','resetDevice']) {
  const marker = `if(a==='${action}')`;
  const at = adminApi.indexOf(marker);
  check(at >= 0 && adminApi.indexOf('rejectAdminTarget(uid)', at) >= 0 && adminApi.indexOf('if(a===', at + marker.length) > adminApi.indexOf('rejectAdminTarget(uid)', at), `Admin action ${action} must guard target admin accounts.`);
}
check(adminApi.includes('password.length<12'), 'Server-side account creation must require a 12-character password.');
check(adminApi.includes('b.pricing.length>30'), 'Pricing configuration must cap item count.');
check(adminApi.includes("String(p.desc||'').slice(0,300)"), 'Pricing descriptions must be length-limited.');
check(rules.rules.device_lock?.['.read'] === false && rules.rules.device_lock?.['.write'] === false, 'Firebase rules must deny direct client access to device_lock.');
check(!/firebaseDB\.ref\(['"]device_lock\//.test(index + inline), 'Client code must not access device_lock directly.');
check(index.includes("fetch('/api/device-lock'") && inline.includes("fetch('/api/device-lock'"), 'Both client sources must call the device-lock endpoint.');
check(!/return j\(res,\s*500,\s*\{[^}]*error:\s*e\.message/.test(adminApi), 'Admin API must not expose raw internal errors.');
check(!/return reply\(res,\s*500,\s*\{[^}]*error:\s*error\.message/.test(deviceApi), 'Device-lock API must not expose raw internal errors.');
for (const file of ['index.html','index-inline.js']) {
  const source = read(file);
  check(source.includes("escapeHtml(x.jp || '')") && source.includes("escapeHtml(x.romaji || '-')") && source.includes("escapeHtml(x.id || '')"), `${file} must escape all translated-history text before HTML rendering.`);
  check(source.includes("escapeAttr(x.ttsKana || x.jp || '')"), `${file} must escape translated-history speech attributes.`);
  check(source.includes('errEl.innerHTML = escapeHtml(res.msg)'), `${file} must escape login error text before adding the support link.`);
}

const files = [];
function walk(dir) { for (const ent of fs.readdirSync(path.join(root, dir), {withFileTypes:true})) { const rel = path.posix.join(dir, ent.name); if (ent.isDirectory()) walk(rel); else if (rel.endsWith('.js')) files.push(rel); } }
walk('api'); files.push('index-inline.js', 'qa-audit.js', 'qa-audit-v10.js', 'translate.js');
for (const f of files) {
  const {spawnSync} = require('child_process');
  const result = spawnSync(process.execPath, ['--check', path.join(root, f)], {encoding:'utf8'});
  if (result.status !== 0) failures.push(`JavaScript syntax failed: ${f}: ${(result.stderr || result.stdout).trim()}`);
}
console.log('Nihongo Dasar V10 static QA');
console.log(`JavaScript files syntax-checked: ${files.length}`);
console.log(`Core vocabulary rows: ${((index.match(/const CORE_VOCAB = /g)||[]).length ? 'present' : 'missing')} in index.html; ${(inline.match(/const CORE_VOCAB = /g)||[]).length ? 'present' : 'missing'} in index-inline.js`);
console.log(`Static assertions: ${assertions - failures.length} passed, ${failures.length} failed`);
if (failures.length) { console.error(failures.map((x,i)=>`${i+1}. ${x}`).join('\n')); process.exitCode=1; }
else console.log('PASS: static regression checks passed. This does not replace staging/runtime security tests or expert language review.');
