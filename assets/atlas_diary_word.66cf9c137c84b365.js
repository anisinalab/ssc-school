'use strict';
(function(global){
  const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true}),NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main',REL='http://schemas.openxmlformats.org/package/2006/relationships',MAX=8*1024*1024;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  function safe(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
  function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function zip(files){const parts=[],central=[];let offset=0;for(const [name,value]of Object.entries(files)){const fn=enc.encode(name),body=enc.encode(value),h=new Uint8Array(30+fn.length),v=new DataView(h.buffer),sum=crc(body);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,fn.length,true);h.set(fn,30);const ch=new Uint8Array(46+fn.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,sum,true);cv.setUint32(20,body.length,true);cv.setUint32(24,body.length,true);cv.setUint16(28,fn.length,true);cv.setUint32(42,offset,true);ch.set(fn,46);parts.push(h,body);central.push(ch);offset+=h.length+body.length;}const end=new Uint8Array(22),ev=new DataView(end.buffer),length=central.reduce((s,b)=>s+b.length,0);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,length,true);ev.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
  const fingerprint=note=>global.SscAtlasDiaryStore?.fingerprint(note)||'';
  const dateLabel=value=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)).replace(' г.','');
  function exportDocument(notes,{courseTitle='Учебный курс',lessonTitles={}}={}){
    if(!Array.isArray(notes)||notes.length>1000)throw Error('Слишком много записей.');
    const rels=[],run=text=>'<w:r><w:t xml:space="preserve">'+escape(text)+'</w:t></w:r>',paragraph=(text,style='')=>'<w:p>'+(style?'<w:pPr><w:pStyle w:val="'+style+'"/></w:pPr>':'')+run(text)+'</w:p>';
    function linked(text){let result='',cursor=0;for(const m of text.matchAll(/https?:\/\/[^\s<>"\u0000-\u001f]+/gi)){result+=run(text.slice(cursor,m.index));const url=safe(m[0]);if(url){const id='link'+(rels.length+1);rels.push('<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="'+escape(url)+'" TargetMode="External"/>');result+='<w:hyperlink r:id="'+id+'"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>'+escape(m[0])+'</w:t></w:r></w:hyperlink>';}else result+=run(m[0]);cursor=m.index+m[0].length;}return result+run(text.slice(cursor));}
    const wrap=(tag,content)=>'<w:sdt><w:sdtPr><w:tag w:val="'+escape(tag)+'"/></w:sdtPr><w:sdtContent>'+content+'</w:sdtContent></w:sdt>';
    let body=wrap('ssc3:header',paragraph('Дневник открытий','Title')+paragraph(courseTitle,'Subtitle')),metadata='';
    const manifest={version:3,documentId:global.crypto.randomUUID(),courseTitle,notes:[]};
    let bodyBytes=enc.encode(body).length;
    for(const n of notes){
      if(typeof n.text!=='string'||n.text.length>100000||!Number.isFinite(Date.parse(n.created))||!Number.isFinite(Date.parse(n.updated)))throw Error('Неверная запись.');
      if(typeof n.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(n.id))throw Error('Неверный идентификатор записи.');
      const date=dateLabel(n.created),lessonTitle=lessonTitles[n.lesson]||n.lessonTitle||'';
      let section=paragraph(date,'SSCDate');
      if(lessonTitle)section+=paragraph('Урок: '+lessonTitle,'SSCMeta');
      for(const line of n.text.split(/\r?\n/))section+='<w:p>'+linked(line)+'</w:p>';
      section=wrap('ssc3:note:'+n.id,section);bodyBytes+=enc.encode(section).length;
      if(bodyBytes>MAX-1024)throw Error('Экспорт превышает безопасный размер одной части. Используйте экспорт частями.');
      body+=section;
      metadata+='<note id="'+escape(n.id)+'" created="'+escape(n.created)+'" updated="'+escape(n.updated)+'" lesson="'+escape(n.lesson||'')+'" module="'+escape(n.module||'')+'"/>';
      manifest.notes.push({id:n.id,created:n.created,updated:n.updated,lesson:n.lesson||'',module:n.module||'',baseline:fingerprint(n),dateLabel:date,lessonLabel:lessonTitle?'Урок: '+lessonTitle:''});
    }
    const files={'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="'+REL+'"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>',
      'word/styles.xml':'<?xml version="1.0"?><w:styles xmlns:w="'+NS+'"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>',
      'word/_rels/document.xml.rels':'<?xml version="1.0"?><Relationships xmlns="'+REL+'"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="diary" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../customXml/ssc-diary.xml"/>'+rels.join('')+'</Relationships>',
      'customXml/ssc-diary.xml':'<?xml version="1.0" encoding="UTF-8"?><diary xmlns="urn:ssc:diary:1" version="2">'+metadata+'</diary>'};
    // Settings/docVars and tagged content controls survive Word's customXml renaming.
    // Only provenance is duplicated; the editable note text exists once, in document.xml.
    const header={version:3,documentId:manifest.documentId,courseTitle};
    files['word/settings.xml']='<?xml version="1.0" encoding="UTF-8"?><w:settings xmlns:w="'+NS+'"><w:docVars><w:docVar w:name="SSC_DIARY_V3" w:val="'+escape(JSON.stringify(header))+'"/>'+manifest.notes.map(n=>'<w:docVar w:name="SSC_NOTE_V3_'+escape(n.id)+'" w:val="'+escape(JSON.stringify(n))+'"/>').join('')+'</w:docVars></w:settings>';
    files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>','<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>');
    files['word/_rels/document.xml.rels']=files['word/_rels/document.xml.rels'].replace('</Relationships>','<Relationship Id="settings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>');
    files['word/styles.xml']=files['word/styles.xml'].replace('</w:styles>','<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="655079"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="SSCDate"><w:name w:val="SSC Date"/><w:pPr><w:keepNext/><w:pBdr><w:top w:val="single" w:sz="4" w:space="8" w:color="BBA9CF"/></w:pBdr><w:spacing w:before="140" w:after="60"/></w:pPr><w:rPr><w:b/><w:color w:val="655079"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="SSCMeta"><w:name w:val="SSC Meta"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:i/></w:rPr></w:style></w:styles>').replace('</w:docDefaults>','<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>');
    const sizes=Object.values(files).map(v=>enc.encode(v).length);
    if(sizes.some(n=>n>MAX)||sizes.reduce((a,b)=>a+b,0)>MAX*2)throw Error('Экспорт превышает безопасный размер одной части. Используйте экспорт частями.');
    const result=zip(files);if(result.size>20*1024*1024)throw Error('Экспорт превышает 20 МБ. Используйте экспорт частями.');return result;
  }
  function xml(text){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Небезопасная структура XML.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Повреждён документ Word.');return doc;}
  async function unzip(buffer){const bytes=new Uint8Array(buffer);if(bytes.length>20*1024*1024||bytes.length<22)throw Error('Выберите .docx до 20 МБ.');const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(v.getUint32(p,true)===0x06054b50&&p+22+v.getUint16(p+20,true)===bytes.length){end=p;break;}if(end<0)throw Error('Неверный ZIP-контейнер Word.');const count=v.getUint16(end+10,true),map=new Map();let p=v.getUint32(end+16,true);if(count>4096||count===65535||v.getUint16(end+4,true)||v.getUint16(end+6,true))throw Error('Неподдерживаемый контейнер Word.');for(let i=0;i<count;i++){if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw Error('Повреждён ZIP.');const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),compressed=v.getUint32(p+20,true),size=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),offset=v.getUint32(p+42,true);if(p+46+nl+extra+comment>end)throw Error('Повреждён ZIP.');const name=dec.decode(bytes.slice(p+46,p+46+nl));if(flags&1||!['0','8'].includes(String(method))||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||map.has(name)||/vbaProject|\.exe$/i.test(name))throw Error('Неподдерживаемое или небезопасное содержимое Word.');map.set(name,{flags,method,compressed,size,offset,crc:v.getUint32(p+16,true)});p+=46+nl+extra+comment;}let total=0;return async name=>{const e=map.get(name);if(!e)return null;if(e.size>MAX||(total+=e.size)>MAX*2||e.offset+30>bytes.length||v.getUint32(e.offset,true)!==0x04034b50)throw Error('Документ слишком большой или повреждён.');const start=e.offset+30+v.getUint16(e.offset+26,true)+v.getUint16(e.offset+28,true);if(start+e.compressed>bytes.length)throw Error('Повреждён ZIP.');let data=bytes.slice(start,start+e.compressed);if(e.method===8){if(!global.DecompressionStream)throw Error('Для импорта нужен современный браузер.');let stream;try{stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw Error('Браузер не поддерживает распаковку Word. Обновите браузер.');}const reader=stream.getReader(),parts=[];let length=0;while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>e.size||length>MAX){await reader.cancel();throw Error('Превышен размер документа.');}parts.push(next.value);}data=new Uint8Array(length);let at=0;for(const chunk of parts){data.set(chunk,at);at+=chunk.length;}}if(data.length!==e.size||crc(data)!==e.crc)throw Error('Повреждён документ Word (контрольная сумма).');return dec.decode(data);};}
  async function importDocument(buffer,options={}){const read=await unzip(buffer),root=await read('_rels/.rels');if(!root)throw Error('Это не документ Word.');const relations=xml(root),main=[...relations.getElementsByTagNameNS(REL,'Relationship')].find(r=>r.getAttribute('Type')?.endsWith('/officeDocument'));if(!main||main.getAttribute('TargetMode')==='External')throw Error('Не найден основной документ.');const part=main.getAttribute('Target').replace(/^\//,'');if(!part||part.split('/').includes('..'))throw Error('Неверная структура Word.');const content=await read(part);if(!content)throw Error('Не найден текст Word.');const doc=xml(content),body=doc.getElementsByTagNameNS(NS,'body')[0];if(!body)throw Error('Формат Word не поддерживается.');
    // Metadata carries dates and associations only. Visible Word paragraphs are authoritative.
    let metadata=[];
    const folder=part.slice(0,part.lastIndexOf('/')+1),basename=part.slice(part.lastIndexOf('/')+1),rxml=await read(folder+'_rels/'+basename+'.rels'),links=new Map();if(rxml)for(const r of xml(rxml).getElementsByTagNameNS(REL,'Relationship'))if(r.getAttribute('Type')?.endsWith('/hyperlink')){const target=safe(r.getAttribute('Target'));if(target)links.set(r.getAttribute('Id'),target);}
    function visible(node){
      for(let parent=node;parent;parent=parent.parentElement){
        if(parent.namespaceURI!==NS)continue;
        if(['del','moveFrom'].includes(parent.localName))return false;
        if(parent.localName==='r'){
          const hidden=[...parent.children].find(e=>e.namespaceURI===NS&&e.localName==='rPr')?.getElementsByTagNameNS(NS,'vanish')[0];
          if(hidden&&!['0','false','off'].includes(hidden.getAttributeNS(NS,'val')))return false;
        }
      }
      return true;
    }
    function text(node){if(!visible(node))return '';if(node.nodeType===3)return '';if(node.namespaceURI===NS&&node.localName==='t')return node.textContent;if(node.namespaceURI===NS&&['br','cr'].includes(node.localName))return '\n';if(node.namespaceURI===NS&&node.localName==='tab')return '\t';const result=[...node.childNodes].map(text).join('');if(node.namespaceURI===NS&&node.localName==='hyperlink'){const target=links.get(node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));return target&&!result.includes(target)?result+' ('+target+')':result;}if(node.namespaceURI===NS&&node.localName==='fldSimple'){const target=safe(node.getAttributeNS(NS,'instr')?.match(/HYPERLINK\s+"([^"]+)"/i)?.[1]);return target?result+' ('+target+')':result;}return result;}
    const nodes=[...body.getElementsByTagNameNS(NS,'p')].filter(visible),paragraphs=nodes.map(p=>{let value=text(p);for(const instruction of p.getElementsByTagNameNS(NS,'instrText')){if(!visible(instruction))continue;const target=safe(instruction.textContent.match(/HYPERLINK\s+\x22([^\x22]+)\x22/i)?.[1]);if(target&&!value.includes(target))value+=' ('+target+')';}return value;});
    function targetPart(target){if(!target||target.includes('\\')||target.startsWith('//')||/^[a-z]+:/i.test(target))throw Error('Неверная связь Word.');const parts=target.startsWith('/')?[]:folder.split('/').filter(Boolean);for(const s of target.split('/')){if(s==='..'){if(!parts.length)throw Error('Неверная связь Word.');parts.pop();}else if(s&&s!=='.')parts.push(s);}return parts.join('/');}
    let manifest=null,metadataFound=false;const styleNames=new Map();
    if(rxml)for(const r of xml(rxml).getElementsByTagNameNS(REL,'Relationship')){
      if(r.getAttribute('TargetMode')==='External')continue;
      if(r.getAttribute('Type')?.endsWith('/settings')){const settings=await read(targetPart(r.getAttribute('Target')));if(settings){const vars=[...xml(settings).getElementsByTagNameNS(NS,'docVar')],headers=vars.filter(v=>v.getAttributeNS(NS,'name')==='SSC_DIARY_V3');if(headers.length){if(manifest||headers.length!==1)throw Error('Повторные метаданные дневника.');manifest=JSON.parse(headers[0].getAttributeNS(NS,'val'));manifest.notes=vars.filter(v=>v.getAttributeNS(NS,'name')?.startsWith('SSC_NOTE_V3_')).map(v=>{const n=JSON.parse(v.getAttributeNS(NS,'val'));if(v.getAttributeNS(NS,'name')!=='SSC_NOTE_V3_'+n.id)throw Error('Неверная привязка записи.');return n;});}}}
      // Resolve internal relationships; a filename alone never identifies SSC metadata.
      if(r.getAttribute('Type')?.endsWith('/customXml')){const value=await read(targetPart(r.getAttribute('Target')));if(value){const d=xml(value).documentElement;if(d.namespaceURI==='urn:ssc:diary:1'&&d.localName==='diary'){
        if(metadataFound||!['1','2'].includes(d.getAttribute('version')))throw Error('Неоднозначные или неподдерживаемые метаданные дневника.');metadataFound=true;
        if([...d.children].some(n=>n.namespaceURI!==d.namespaceURI||n.localName!=='note'))throw Error('Неверная структура метаданных дневника.');
        metadata=[...d.children].map(n=>({id:n.getAttribute('id'),created:n.getAttribute('created'),updated:n.getAttribute('updated'),lesson:n.getAttribute('lesson')||'',module:n.getAttribute('module')||''}));
        if(metadata.length>1000||new Set(metadata.map(n=>n.id)).size!==metadata.length||metadata.some(n=>!/^[a-zA-Z0-9_-]{1,100}$/.test(n.id)||!['created','updated'].every(k=>Number.isFinite(Date.parse(n[k])))))throw Error('Неверные данные дневника.');
      }}}
      if(r.getAttribute('Type')?.endsWith('/styles')){const value=await read(targetPart(r.getAttribute('Target')));if(value)for(const s of xml(value).getElementsByTagNameNS(NS,'style'))styleNames.set(s.getAttributeNS(NS,'styleId'),s.getElementsByTagNameNS(NS,'name')[0]?.getAttributeNS(NS,'val')||'');}
    }
    function bounded(value){if(value.length>100000)throw Error('Слишком много текста в записи: максимум 100 000 символов.');return value;}
    function tag(node){for(let p=node.parentElement;p;p=p.parentElement){if(p.namespaceURI===NS&&p.localName==='sdt'){const pr=[...p.children].find(e=>e.localName==='sdtPr'),t=pr?.getElementsByTagNameNS(NS,'tag')[0]?.getAttributeNS(NS,'val');if(t?.startsWith('ssc3:'))return t;}}return '';}
    if(manifest){
      if(manifest.version!==3||typeof manifest.documentId!=='string'||manifest.documentId.length>100||!Array.isArray(manifest.notes)||manifest.notes.length>1000)throw Error('Неверные метаданные дневника.');
      const entries=new Map(),order=[];for(const n of manifest.notes){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(n.id)||entries.has(n.id)||!['created','updated'].every(k=>Number.isFinite(Date.parse(n[k])))||!['lesson','module','dateLabel','lessonLabel','baseline'].every(k=>typeof n[k]==='string'))throw Error('Неверные метаданные записи.');entries.set(n.id,{...n,lines:[]});}
      const extra=[];let block=[],before='start',lastTag='';
      function flushExtra(after){const value=block.join('\n').trim();if(value){const stamp=new Date().toISOString(),key=fingerprint({text:manifest.documentId+'\n'+before+'\n'+after});if(!key)throw Error('Не загружено хранилище дневника.');extra.push({id:'word-'+key,created:stamp,updated:stamp,text:bounded(value),lesson:'',module:''});}block=[];}
      for(let i=0;i<nodes.length;i++){
        const t=tag(nodes[i]),value=paragraphs[i];
        if(t.startsWith('ssc3:note:')){const id=t.slice(10),entry=entries.get(id);if(!entry)throw Error('Неизвестная запись в документе.');if(t!==lastTag){flushExtra(id);if(order.includes(id))throw Error('Нарушены границы записи.');order.push(id);}before=id;lastTag=t;
          const style=nodes[i].getElementsByTagNameNS(NS,'pStyle')[0]?.getAttributeNS(NS,'val');if(!((style==='SSCDate'&&value===entry.dateLabel)||(style==='SSCMeta'&&value===entry.lessonLabel)))entry.lines.push(value);
        }else{lastTag=t;if(t==='ssc3:header'&&['Дневник открытий',manifest.courseTitle].includes(value))continue;block.push(value);}
      }
      flushExtra('end');
      if(order.length!==entries.size)throw Error('Word удалил границы записей. Импорт отменён, исходные записи сохранены. Сохраните документ и передайте его для проверки.');
      const notes=order.map(id=>{const {lines,...n}=entries.get(id);return {...n,text:bounded(lines.join('\n'))};}).filter(n=>n.text.trim());
      return {own:true,notes:[...notes,...extra],notice:'Восстановлены отдельные записи и их даты. Использован видимый текст Word.'};
    }
    if(metadata.length){
      const boundaries=[];
      for(let i=0;i<paragraphs.length;i++){
        const match=paragraphs[i].match(/ · (\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/);
        if(match&&metadata.some(n=>n.created===match[1]))boundaries.push({index:i,date:match[1]});
      }
      if(boundaries.length===metadata.length&&boundaries.every((b,i)=>b.date===metadata[i].created)){
        const notes=boundaries.map((b,i)=>{
          const lines=paragraphs.slice(b.index+1,boundaries[i+1]?.index??paragraphs.length);
          if(metadata[i].updated!==metadata[i].created&&lines[0]?.startsWith('Изменено: '))lines.shift();
          if(lines.at(-1)==='')lines.pop();
          const value=lines.join('\n');if(value.length>100000)throw Error('Слишком много текста в записи: максимум 100 000 символов.');
          return {...metadata[i],text:value};
        });
        // Keep text added before the first legacy entry, without importing the generated headings.
        const prelude=paragraphs.slice(0,boundaries[0].index),styleAt=i=>{const id=nodes[i].getElementsByTagNameNS(NS,'pStyle')[0]?.getAttributeNS(NS,'val')||'';return (styleNames.get(id)||id).toLowerCase().replace(/\s/g,'');};
        const titleAt=prelude.findIndex((v,i)=>styleAt(i)==='title'&&v.split('\n').includes('Дневник открытий'));
        const candidates=prelude.map((value,i)=>({value,i})).filter(n=>n.i>titleAt&&titleAt>=0&&styleAt(n.i)==='heading1'&&n.value.trim());
        const explicit=candidates.find(n=>n.value===options.courseTitle),courseAt=explicit?.i??(candidates.length===1?candidates[0].i:-1);
        const leading=prelude.flatMap((value,i)=>i===courseAt?[]:i===titleAt?value.split('\n').filter(line=>line!=='Дневник открытий'):[value]);
        if(leading.join('\n').trim()){const stamp=new Date().toISOString(),value=bounded(leading.join('\n').trim()),identity=fingerprint({text:'legacy-prefix:'+metadata.map(n=>n.id).join(',')});notes.push({id:'word-'+identity,created:stamp,updated:stamp,text:value,lesson:'',module:''});}
        return {own:true,notes:notes.filter(n=>n.text.trim()),notice:'Импортирован актуальный видимый текст прежнего дневника. Даты и отдельные записи сохранены.'};
      }
    }
    if(metadataFound||nodes.some(p=>tag(p).startsWith('ssc3:'))||(paragraphs.some(p=>p.split('\n').includes('Дневник открытий'))&&paragraphs.some(p=>/ · \d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(p))))throw Error('Не удалось восстановить структуру дневника. Импорт отменён; существующие записи сохранены.');
    const value=paragraphs.join('\n').trim();if(value.length>100000)throw Error('Слишком много текста: максимум 100 000 символов. Разделите документ.');const identity=fingerprint({text:value});if(!identity)throw Error('Не загружено хранилище дневника.');const stamp=new Date().toISOString();return {own:false,notes:value?[{id:'word-'+identity,text:value,created:stamp,updated:stamp,lesson:'',module:''}]:[],notice:'Импортированы текст и ссылки обычного документа. Оформление и изображения не переносятся.'};
  }
  function exportDocuments(notes,options={}){
    if(!Array.isArray(notes)||notes.length>1000)throw Error('Слишком много записей.');
    // Try one file first. On a size error partition without changing importer safeguards.
    try{return [exportDocument(notes,options)];}catch(error){if(!error.message.startsWith('Экспорт превышает'))throw error;}
    if(notes.length<2)throw Error('Одна запись превышает безопасный размер документа Word. Сохранённая запись не изменена.');
    const middle=Math.ceil(notes.length/2);
    return [...exportDocuments(notes.slice(0,middle),options),...exportDocuments(notes.slice(middle),options)];
  }
  const api={exportDocument,exportDocuments,importDocument,crc};global.SscAtlasDiaryWord=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
