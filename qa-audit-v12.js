#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=__dirname,fail=[];let n=0;const check=(v,m)=>{n++;if(!v)fail.push(m)};const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),js=read('index-inline.js'),pkg=JSON.parse(read('package.json'));
check(html.includes('id="examStartBtn"')&&html.includes('id="examLevel"'),'Exam start and level controls exist.');
check(html.includes('id="examTimer"')&&html.includes('id="examOptions"'),'Timed exam interface exists.');
check(html.includes('id="examExportBtn"'),'Learning progress export control exists.');
check(html.includes('bukan ujian resmi JLPT lengkap'),'Exam is clearly described as vocabulary practice, not the official full JLPT.');
for(const needle of ['V12 FINAL: vocabulary exam simulation','function initFinalExam()','function finish(reason)','function tick()','function exportProgress()'])check(js.includes(needle),`Expected exam feature missing: ${needle}`);
check(js.includes("const HISTORY_KEY='jl_exam_history_v1'"),'Exam history uses a versioned storage key.');
check(js.includes('h.unshift(record);saveHistory(h)'),'Exam results are saved locally.');
check(js.includes('x.slice(0,30)'),'Exam history storage is capped.');
check(js.includes("b.textContent=option")&&js.includes("$('examQuestion').textContent=questions[index].japanese"),'Exam content is rendered with textContent rather than HTML interpolation.');
check(js.includes('URL.createObjectURL(blob)')&&js.includes('nihongo-progres-belajar.json'),'Progress export downloads a JSON file.');
check(pkg.version.startsWith('v12.'),'Package version is V12.');
const files=[];function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const f=path.posix.join(dir,e.name);if(e.isDirectory())walk(f);else if(f.endsWith('.js'))files.push(f)}}walk('api');files.push('index-inline.js','qa-audit.js','qa-audit-v10.js','qa-audit-v11.js','qa-audit-v12.js','translate.js');
for(const f of files){const r=spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});if(r.status!==0)fail.push(`Syntax error ${f}: ${(r.stderr||r.stdout).trim()}`)}
console.log('Nihongo Dasar V12 FINAL static QA');console.log(`JavaScript files syntax-checked: ${files.length}`);console.log(`Static assertions: ${n-fail.length} passed, ${fail.length} failed`);if(fail.length){console.error(fail.map((x,i)=>`${i+1}. ${x}`).join('\n'));process.exitCode=1}else console.log('PASS: static checks only; browser/device testing, live Firebase/Vercel checks, and expert language review remain required.');
