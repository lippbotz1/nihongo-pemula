#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');const root=__dirname,fail=[];let n=0;const check=(v,m)=>{n++;if(!v)fail.push(m)};const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const h=read('index.html'),j=read('index-inline.js'),a=read('api/admin-users.js'),d=read('api/device-lock.js'),rules=JSON.parse(read('FIREBASE-RULES.json'));
check(h.includes('id="reviewDueCount"')&&h.includes('id="reviewModeToggle"'),'Review summary and mode controls must exist.');
for(const grade of ['again','hard','good','easy'])check(h.includes(`data-review-grade="${grade}"`)&&j.includes(`${grade}:`),`Spaced review grade ${grade} must have a UI control and schedule.`);
check(h.includes("JL_REVIEW='jl_spaced_review_v1'")&&j.includes("JL_REVIEW='jl_spaced_review_v1'"),'Spaced review schedule must use a versioned local-storage key.');
check(h.includes('function reviewDueItems()')&&j.includes('function reviewDueItems()')&&j.includes('Number(r.due||0)<=now'),'Due cards must be selected by timestamp.');
check(h.includes('function gradeReview(grade)')&&j.includes('function gradeReview(grade)')&&j.includes('jlSave(JL_REVIEW,reviewSchedule)'),'Review grading must persist schedule locally.');
check(j.includes(`Math.min(100,Number(localStorage.getItem('jl_flash_limit')||20))`),'Flashcard session size must be capped.');
check(a.includes('verifyIdToken(h.slice(7),true)'),'Admin API must check revoked tokens.');check(d.includes('verifyIdToken(header.slice(7), true)'),'Device API must check revoked tokens.');
check(rules.rules.device_lock?.['.read']===false&&rules.rules.device_lock?.['.write']===false,'Direct client device-lock access must be denied.');
check(h.includes(`escapeHtml(x.jp || '')`)&&j.includes(`escapeHtml(x.jp || '')`),'Translation history must escape Japanese text in both client sources.');
const files=[];function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const f=path.posix.join(dir,e.name);if(e.isDirectory())walk(f);else if(f.endsWith('.js'))files.push(f)}}walk('api');files.push('index-inline.js','qa-audit.js','qa-audit-v10.js','qa-audit-v11.js','translate.js');for(const f of files){const r=spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});if(r.status!==0)fail.push(`Syntax error ${f}: ${(r.stderr||r.stdout).trim()}`)}
console.log('Nihongo Dasar V11 static QA');console.log(`JavaScript files syntax-checked: ${files.length}`);console.log(`Static assertions: ${n-fail.length} passed, ${fail.length} failed`);if(fail.length){console.error(fail.map((x,i)=>`${i+1}. ${x}`).join('\n'));process.exitCode=1}else console.log('PASS: static checks only; browser, live Firebase/Vercel, and expert language review still required.');
