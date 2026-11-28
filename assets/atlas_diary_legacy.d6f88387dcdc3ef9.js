'use strict';
(function(global){
 const MAX=2000000,encoder=new TextEncoder(),decoder=new TextDecoder();
 const categories=['','Заметки','Идеи','Инсайты','Полезные ссылки','Вопросы','Практические задания','Мой проект'];
 const scopeId=s=>JSON.stringify([s.course,s.cohort]);
 const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 function safeURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
 function validate(data){
  if(!data||data.version!==1||!Array.isArray(data.notes)||data.notes.length>1000)throw Error('Неверный формат дневника.');
  for(const n of [...data.notes,...(data.draft?[data.draft]:[])]){
   if(!n||!['id','title','text','created','updated','lesson','module','category'].every(k=>typeof n[k]==='string')||n.title.length>300||n.text.length>100000||!categories.includes(n.category)||!Array.isArray(n.links)||n.links.length>30||n.links.some(l=>typeof l!=='string'||l.length>2000||!safeURL(l)))throw Error('Некорректная запись или небезопасная ссылка.');
  }return data;
 }
 async function key(password,salt){return crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(salt),iterations:210000,hash:'SHA-256'},await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']),{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
 async function unseal(envelope,password,scope){
  if(!envelope||envelope.version!==1||envelope.scope!==scopeId(scope)||typeof envelope.vault!=='string'||!/^[-a-f0-9]{36}$/.test(envelope.vault)||typeof envelope.cipher!=='string'||envelope.cipher.length>MAX*2||typeof envelope.salt!=='string'||bytes(envelope.salt).length!==16||typeof envelope.iv!=='string'||bytes(envelope.iv).length!==12)throw Error('Неверная резервная копия или другой курс/поток.');
  const k=await key(password,envelope.salt);let plain;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:encoder.encode(scopeId(scope))},k,bytes(envelope.cipher))}catch{throw Error('Неверный пароль или повреждённая копия.');}return {key:k,data:validate(JSON.parse(decoder.decode(plain)))};
 }
 const api={safeURL,validate,unseal,scopeId};global.SscAtlasDiaryLegacy=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
