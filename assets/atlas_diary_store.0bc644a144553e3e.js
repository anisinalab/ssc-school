'use strict';
(function(global){
  const MAX_NOTES=1000,MAX_TEXT=100000;
  // SHA-256 of content only: export provenance, never a second copy of private text.
  function fingerprint(note){
    const bytes=new TextEncoder().encode(JSON.stringify([note.text,note.lesson||'',note.module||''])),length=bytes.length;
    const data=new Uint8Array((length+9+63)&~63);data.set(bytes);data[length]=128;const view=new DataView(data.buffer);view.setUint32(data.length-4,length*8,false);
    const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2],h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),rot=(x,n)=>(x>>>n)|(x<<(32-n));
    for(let offset=0;offset<data.length;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4,false);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rot(a,7)^rot(a,18)^(a>>>3))+w[i-7]+(rot(b,17)^rot(b,19)^(b>>>10)))>>>0;}let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const t=(j+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,u=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t)>>>0;d=c;c=b;b=a;a=(t+u)>>>0;}[a,b,c,d,e,f,g,j].forEach((v,i)=>h[i]=(h[i]+v)>>>0);}
    return h.map(n=>n.toString(16).padStart(8,'0')).join('');
  }
  function planImport(current,incoming){
    if(!Array.isArray(incoming)||incoming.length>MAX_NOTES)throw Error('Слишком много записей для импорта.');
    const byId=new Map(current.map(n=>[n.id,n])),seen=new Set(),plan={added:[],updated:[],skipped:[],conflicts:[]};
    for(const n of incoming){if(seen.has(n.id))throw Error('Повтор идентификатора внутри документа. Импорт отменён.');seen.add(n.id);const old=byId.get(n.id);if(!old){plan.added.push(n);continue;}const local=fingerprint(old),imported=fingerprint(n);
      if(local===imported||(n.baseline&&imported===n.baseline))plan.skipped.push(n);
      else if(n.baseline&&local===n.baseline)plan.updated.push({old,note:n});
      else plan.conflicts.push({old,note:n});
    }
    if(current.length+plan.added.length>MAX_NOTES)throw Error('Импорт превысит предел записей. Ничего не изменено.');return plan;
  }
  function scopeId(scope){
    if(!scope||['course','cohort','access'].some(k=>typeof scope[k]!=='string'||!scope[k]||scope[k].length>200))throw Error('Не удалось определить курс и доступ дневника.');
    return JSON.stringify([scope.course,scope.cohort,scope.access]);
  }
  function safeURL(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null}catch{return null}}
  function validate(note,scope){
    if(!note||typeof note.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(note.id)||note.scope!==scope||typeof note.text!=='string'||!note.text.trim()||note.text.length>MAX_TEXT||!['created','updated'].every(k=>typeof note[k]==='string'&&Number.isFinite(Date.parse(note[k])))||!['lesson','module'].every(k=>typeof(note[k]||'')==='string')||(note.source!==undefined&&(typeof note.source!=='string'||note.source.length>300)))throw Error('Некорректная запись дневника или превышен объём текста.');
    return {...note,created:new Date(note.created).toISOString(),updated:new Date(note.updated).toISOString()};
  }
  function create(scope){
    const key=scopeId(scope);
    let opening;
    function db(){if(!opening)opening=new Promise((resolve,reject)=>{if(!global.indexedDB){reject(Error('Браузер не разрешает локальное хранение. Текст можно сохранить в Word.'));return;}const req=indexedDB.open('ssc-atlas-diary',1);req.onupgradeneeded=()=>{const store=req.result.createObjectStore('notes',{keyPath:['scope','id']});store.createIndex('scope','scope');store.createIndex('source',['scope','source'],{unique:true});};req.onerror=()=>reject(Error('Не удалось открыть хранилище дневника.'));req.onblocked=()=>reject(Error('Закройте другие вкладки SSC, чтобы открыть дневник.'));req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();opening=null;};resolve(req.result)};});return opening;}
    async function list(){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('notes','readonly'),req=tx.objectStore('notes').index('scope').getAll(IDBKeyRange.only(key),MAX_NOTES+1);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{if(result.length>MAX_NOTES){reject(Error('Слишком много записей. Сначала сохраните их в Word.'));return;}try{resolve(result.map(n=>validate(n,key)).sort((a,b)=>b.created.localeCompare(a.created)||b.id.localeCompare(a.id)))}catch(e){reject(e)}};tx.onerror=tx.onabort=()=>reject(Error('Не удалось прочитать записи. Данные не удалены.'));});}
    async function put(note,expected=0){note=validate({...note,scope:key},key);const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('notes','readwrite'),store=tx.objectStore('notes');let failure,result;const req=store.get([key,note.id]);req.onsuccess=()=>{if((req.result?.revision||0)!==expected){failure=Error('Запись изменена в другой вкладке. Сохраните свой текст в Word и откройте дневник заново.');tx.abort();return;}const write=()=>{result={...note,revision:expected+1};store.put(result)};if(req.result)write();else{const count=store.index('scope').count(IDBKeyRange.only(key));count.onsuccess=()=>{if(count.result>=MAX_NOTES){failure=Error('Достигнут предел записей. Сначала выгрузите дневник в Word.');tx.abort()}else write()};}};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(failure||Error('Не удалось сохранить запись. Проверьте свободное место и разрешения браузера.'));});}
    async function remove(id,expected){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('notes','readwrite'),store=tx.objectStore('notes');let failure;const req=store.get([key,id]);req.onsuccess=()=>{if((req.result?.revision||0)!==expected){failure=Error('Запись уже изменена в другой вкладке. Обновите дневник.');tx.abort();return;}store.delete([key,id]);};tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(failure||Error('Не удалось удалить запись.'));});}
    async function append(notes){if(!Array.isArray(notes)||notes.length>MAX_NOTES)throw Error('Слишком много записей для импорта.');const seen=new Set(),rows=notes.map(n=>validate({...n,scope:key},key)).filter(n=>{if(!n.source)return true;if(seen.has(n.source))return false;seen.add(n.source);return true;}),database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('notes','readwrite'),store=tx.objectStore('notes');let added=0,skipped=0,failure;const count=store.index('scope').count(IDBKeyRange.only(key));count.onsuccess=()=>{let remaining=MAX_NOTES-count.result;for(const note of rows){const add=()=>{if(remaining--<=0){failure=Error('Импорт превысит предел записей. Ничего не добавлено.');tx.abort();return;}store.add({...note,revision:1});added++;};if(note.source){const req=store.index('source').getKey([key,note.source]);req.onsuccess=()=>{if(req.result)skipped++;else add()};}else add();}};tx.oncomplete=()=>resolve({added,skipped});tx.onerror=tx.onabort=()=>reject(failure||Error('Импорт не сохранён. Существующие записи не изменены.'));});}
    async function importNotes(notes,expected,replaceConflicts=false){
      const incoming=notes.map(n=>validate({...n,scope:key},key)),database=await db();
      return new Promise((resolve,reject)=>{const tx=database.transaction('notes','readwrite'),store=tx.objectStore('notes');let result,failure;
        const read=store.index('scope').getAll(IDBKeyRange.only(key),MAX_NOTES+1);read.onsuccess=()=>{try{const current=read.result;
          const revisions=new Map(expected.map(n=>[n.id,n.revision]));if(current.length!==expected.length||current.some(n=>revisions.get(n.id)!==n.revision))throw Error('Дневник изменён в другой вкладке. Импорт отменён; повторите его после обновления дневника.');
          const plan=planImport(current,incoming),changes=[...plan.updated,...(replaceConflicts?plan.conflicts:[])];
          for(const n of plan.added)store.add({...n,revision:1});
          for(const {old,note}of changes)store.put({...old,text:note.text,lesson:note.lesson||'',module:note.module||'',updated:new Date().toISOString(),revision:old.revision+1});
          result={added:plan.added.length,updated:changes.length,skipped:plan.skipped.length,conflicts:plan.conflicts.length,unresolved:replaceConflicts?0:plan.conflicts.length};
        }catch(e){failure=e;tx.abort();}};
        tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(failure||Error('Импорт отменён. Существующие записи не изменены.'));
      });
    }
    function close(){const pending=opening;opening=null;if(pending)pending.then(database=>database.close(),()=>{});}
    return {scope:key,list,put,remove,append,importNotes,close};
  }
  const api={create,scopeId,safeURL,validate,fingerprint,planImport,MAX_NOTES,MAX_TEXT};global.SscAtlasDiaryStore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
