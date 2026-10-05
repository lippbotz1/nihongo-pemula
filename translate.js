/* Nihongo Translate Engine v9 — client logic only; secrets/providers stay server-side. */
function normalizeTranslateKey(t){return String(t||'').normalize('NFKC').trim().replace(/[。、！？!?.,]+$/g,'').replace(/\s+/g,' ').toLowerCase()}
function cleanJp(t){return String(t||'').trim()}
const TRANSLATE_CACHE_KEY='nihongo_translate_cache_v2',TRANSLATE_CACHE_TTL=2592000000;
function getTranslateCache(key){try{const all=JSON.parse(localStorage.getItem(TRANSLATE_CACHE_KEY)||'{}');const hit=all[key];if(hit&&Date.now()-hit.ts<TRANSLATE_CACHE_TTL)return hit.data}catch(e){}return null}
function setTranslateCache(key,data){try{const all=JSON.parse(localStorage.getItem(TRANSLATE_CACHE_KEY)||'{}');all[key]={ts:Date.now(),data};const keys=Object.keys(all);while(keys.length>80)delete all[keys.shift()];localStorage.setItem(TRANSLATE_CACHE_KEY,JSON.stringify(all))}catch(e){}}
let translateAbortController=null;
async function fetchTranslateProvider(sl,tl,text,mode='translate'){const key=sl+'|'+tl+'|'+mode+'|'+normalizeTranslateKey(text);const cached=getTranslateCache(key);if(cached)return cached;if(translateAbortController)try{translateAbortController.abort()}catch(e){}translateAbortController=new AbortController();const signal=translateAbortController.signal;const endpoints=mode==='romaji'?['/api/translate?mode=romaji&sl=ja&tl=en&q='+encodeURIComponent(text)]:mode==='romaji-to-ja'?['/api/translate?mode=romaji-to-ja&sl=ja&tl=ja&q='+encodeURIComponent(text)]:['/api/translate?mode=translate&sl='+encodeURIComponent(sl)+'&tl='+encodeURIComponent(tl)+'&q='+encodeURIComponent(text)];for(const url of endpoints){try{const r=await fetch(url,{headers:{accept:'application/json'},signal});if(!r.ok)continue;const d=await r.json();let v=mode==='romaji'?d.romaji:(mode==='romaji-to-ja'?d.japanese:(d.translatedText||d.responseData?.translatedText||''));if(!v&&mode!=='romaji'&&Array.isArray(d?.[0]))v=d[0].map(x=>x?.[0]||'').join('');v=String(v||'').trim();if(v){setTranslateCache(key,v);return v}}catch(e){if(e?.name==='AbortError')throw e}}return ''}
function findLocalTranslation(input,isJp){
 const raw=String(input||'').trim(), clean=cleanJp(raw), key=normalizeTranslateKey(raw);
 if(!isJp && detectRomaji(raw)){
   const jp=romajiToJapanese(raw);
   if(jp){const e=dbFind(jp)||entryForJapanese(jp);return {jp,id:localWordMeaning[jp]||e?.meaning||'',e,source:'romaji'}}
 }
 if(isJp){
   const e=dbFind(clean)||entryForJapanese(clean); const id=localWordMeaning[clean]||e?.meaning||'';
   if(id)return {jp:clean,id,e};
   const p=Object.keys(JP_PHRASE_READINGS).find(k=>normalizeTranslateKey(k)===key);
   if(p)return {jp:p,id:localWordMeaning[p]||'',e:entryForJapanese(p)};
 }
 else {
   const direct=ID_TO_JP[key];
   if(direct)return {jp:direct,id:localWordMeaning[direct]||dbFind(direct)?.meaning||'',e:dbFind(direct)||entryForJapanese(direct)};
   const e=LEARNING_DB.find(x=>normalizeTranslateKey(x.meaning).split(/[;,/]/).some(v=>v.trim()===key)||normalizeTranslateKey(x.meaning)===key);
   if(e)return {jp:e.japanese,id:e.meaning,e};
   const p=Object.entries(localWordMeaning).find(([jp,id])=>normalizeTranslateKey(id)===key);
   if(p)return {jp:p[0],id:p[1],e:dbFind(p[0])||entryForJapanese(p[0])};
 }
 return null;
}
let currentTranslationState=null;
async function ensureRomaji(jp){const local=findLocalRomaji(jp);if(local)return local;const apiRomaji=await fetchTranslateProvider('ja','en',jp,'romaji');return romajiIsLatin(apiRomaji)?normalizeRomajiOutput(apiRomaji):''}
function showTranslationResult(jp,id,original,entry,romajiOverride){const clean=String(jp||'').trim(),e=entry||dbFind(clean)||entryForJapanese(clean),romaji=romajiOverride||findLocalRomaji(clean)||'';const formality=detectPoliteness(clean,e);currentTranslationState={jp:clean,id:String(id||''),romaji,originalText:original,entry:e,formality};document.getElementById('resultMain').textContent=clean;const romajiEl=document.getElementById('resultRomaji');romajiEl.textContent=romaji||'Bacaan belum tersedia';romajiEl.classList.toggle('romaji-unavailable',!romaji);document.getElementById('resultMeaning').textContent=id||'—';renderTranslateDetails(e,formality,clean,id);const resultBox=document.getElementById('translateResult');resultBox.classList.add('show');resultBox.setAttribute('data-speak',clean);const exact=formalityDict[clean]||formalityDict[normalizeTranslateKey(clean)]||Object.keys(formalityDict).find(k=>normalizeTranslateKey(k)===normalizeTranslateKey(clean))&&formalityDict[Object.keys(formalityDict).find(k=>normalizeTranslateKey(k)===normalizeTranslateKey(clean))],formalityBox=document.getElementById('formalityBox');if(exact){renderFormality(exact);formalityBox.classList.add('show')}else formalityBox.classList.remove('show');addToHistory({jp:clean,romaji:romaji||'—',id,originalText:original});setTimeout(()=>speak(clean),120);return currentTranslationState}
async function doTranslate(){
 const input=document.getElementById('translateInput').value.trim(); if(!input)return;
 const btn=document.getElementById('translateBtn'),resultBox=document.getElementById('translateResult'),notFoundBox=document.getElementById('translateNotFound'),formalityBox=document.getElementById('formalityBox');
 if(btn.disabled)return; btn.disabled=true; const old=btn.textContent; btn.textContent='⏳ Menerjemahkan…'; resultBox.classList.remove('show'); notFoundBox.classList.remove('show'); formalityBox.classList.remove('show');
 try{
   const script=detectJapaneseScript(input); const isJp=script!=='none'; const isRom=detectRomaji(input);
   let local=findLocalTranslation(input,isJp);
   if(local&&local.jp){ let r=local.e?.romaji||findLocalRomaji(local.jp); if(!r)r=await ensureRomaji(local.jp); if(local.id){showTranslationResult(local.jp,local.id,input,local.e,r);return} }
   if(isRom){
     let jp=romajiToJapanese(input);
     if(!jp) jp=await fetchTranslateProvider('auto','ja',input,'romaji-to-ja');
     if(jp){ const id=localWordMeaning[jp]||dbFind(jp)?.meaning||await fetchTranslateProvider('ja','id',jp); const r=findLocalRomaji(jp)||await ensureRomaji(jp); if(id){showTranslationResult(jp,id,input,dbFind(jp)||entryForJapanese(jp),r);return;} }
   } else if(isJp){
     const id=await fetchTranslateProvider('ja','id',input); if(id){const r=await ensureRomaji(input);showTranslationResult(input,id,input,null,r);return;}
   } else {
     const jp=await fetchTranslateProvider('id','ja',input); if(jp){const r=await ensureRomaji(jp);showTranslationResult(jp,input,input,null,r);return;}
   }
   notFoundBox.classList.add('show');
 }catch(e){if(e?.name!=='AbortError')notFoundBox.classList.add('show')}
 finally{btn.disabled=false;btn.textContent=old;}
}
function addToHistory(entry) {
  let h = JSON.parse(localStorage.getItem('translate_history_v19') || '[]');
  h = h.filter(x => x.originalText !== entry.originalText);
  h.unshift(entry); h = h.slice(0, 15);
  try { localStorage.setItem('translate_history_v19', JSON.stringify(h)); } catch (e) {}
  renderHistory();
}
