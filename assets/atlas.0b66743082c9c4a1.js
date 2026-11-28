'use strict';
window.SscAtlas={mount(){
 const view=document.querySelector('[data-atlas-config]'),root=document.querySelector('[data-lesson-progress]');if(!view||!root)throw Error('Не найден курс.');if(view.sscAtlas)return view.sscAtlas;
 const config=JSON.parse(view.dataset.atlasConfig),controller=root.sscProgress;
 if(!controller)throw Error('Прогресс ещё не готов.'); // Classic remains fully available if integration fails.
 const $=s=>view.querySelector(s),all=s=>[...view.querySelectorAll(s)],el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
 const cards=[...root.querySelectorAll('[data-lesson-id]')],modules=[...root.querySelectorAll('.portal-week[data-module-progress]')].map(m=>({id:m.dataset.moduleProgress,title:m.querySelector('h3').textContent,element:m}));
 const dialog=$('#ssc-atlas-dialog'),dialogBody=$('#ssc-atlas-dialog-content'),dialogTitle=$('#ssc-atlas-dialog-title');let opener=null,snapshot=controller.snapshot(),state;
 function open(title,build,trigger){opener=trigger||document.activeElement;dialogTitle.textContent=title;dialogBody.replaceChildren();build(dialogBody);dialog.showModal();dialog.querySelector('button').focus();}
 function close(){dialog.close();if(opener?.isConnected)opener.focus();else document.querySelector('[data-ssc-mode=atlas]')?.focus();}
 function action(parent,text,callback,cls='art-cta'){const b=el('button',text);b.type='button';b.className=cls;b.addEventListener('click',event=>navigate(()=>callback(event)));parent.append(b);return b;}
 function moduleProgress(id){return SscLessonProgress.moduleProgress(snapshot.lessons,snapshot.completed,id);}
 async function lesson(id){const card=cards.find(c=>c.dataset.lessonId===id);if(!card||card.dataset.lessonAvailable!=='true')return;await hideDiary();$('#atlas-classroom-space').hidden=true;document.querySelector('[data-course-welcome]')?.setAttribute('hidden','');
  if(dialog.open)close();document.body.classList.add('ssc-atlas-lesson-open');card.classList.add('atlas-selected');cards.filter(c=>c!==card).forEach(c=>c.classList.remove('atlas-selected'));
  history.replaceState(history.state,'','#lesson-'+encodeURIComponent(id));card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 function hall(moduleId,trigger){const m=modules.find(m=>m.id===moduleId);if(!m)return;open(m.title,box=>{
  box.append(el('p','Выберите доступный урок, чтобы открыть его материалы.'));
  const progress=moduleProgress(moduleId);box.append(el('p',`${progress.done} из ${progress.total} · ${progress.percent}%`));
  cards.filter(c=>c.dataset.moduleId===moduleId).forEach(c=>{const b=action(box,c.querySelector('h3').textContent+ (snapshot.completed.has(c.dataset.lessonId)?' · ✓ Пройдено':''),()=>lesson(c.dataset.lessonId),'hall-lesson');b.disabled=c.dataset.lessonAvailable!=='true';b.textContent+=b.disabled?' · Откроется по расписанию':' · Открыть урок ↗';});
 },trigger);}
 function overview(title,trigger){open(title,box=>modules.forEach(m=>{const p=moduleProgress(m.id);action(box,`${m.title} · ${p.done}/${p.total} · ${p.percent}%`,()=>{close();hall(m.id,trigger)},'overview-module')}),trigger);}
 async function classroom(){
  if(config.show_classroom===false)return;await hideDiary();document.body.classList.remove('ssc-atlas-lesson-open');const box=$('#atlas-classroom-space'),welcome=document.querySelector('[data-course-welcome]');if(welcome)welcome.remove();box.hidden=false;box.replaceChildren();box.append(el('h2','Учебный зал'));
  if(welcome){welcome.hidden=false;box.append(welcome);}
  const hero=document.querySelector('.course-hero .hero-copy');if(hero){box.append(el('h3',hero.querySelector('h1').textContent));for(const p of hero.querySelectorAll('p'))box.append(p.cloneNode(true));}
  box.append(el('p','Мой прогресс: '+snapshot.completed.size+' из '+snapshot.lessons.length+' уроков · '+(snapshot.lessons.length?Math.round(snapshot.completed.size/snapshot.lessons.length*100):0)+'%'));action(box,'Продолжить путь ↗',resume);
  if(snapshot.lessons.length&&snapshot.lessons.every(l=>snapshot.completed.has(l.id)))box.append(el('p','Поздравляем! Все уроки пройдены. Материалы доступны для повторного просмотра.'));
  const next=snapshot.lessons.find(l=>l.available&&!snapshot.completed.has(l.id));
  function group(m,items){const section=el('section');section.className='classroom-module';const p=m?moduleProgress(m.id):null;section.append(el('h3',m?m.title:'Другие уроки'));if(p)section.append(el('p',p.done+' из '+p.total+' · '+p.percent+'% · '+(p.finished?'Модуль пройден':items.some(c=>c.dataset.lessonAvailable==='true')?'Доступен':'Пока закрыт')));items.forEach(c=>{const id=c.dataset.lessonId,available=c.dataset.lessonAvailable==='true',status=snapshot.completed.has(id)?'✓ Пройден':!available?'🔒 Пока закрыт':next?.id===id?'Текущий':'Доступен';const b=action(section,c.querySelector('h3').textContent+' — '+status,()=>lesson(id),'hall-lesson');b.disabled=!available;if(!available){const date=c.querySelector('time');if(date)section.append(date.cloneNode(true));}});box.append(section);}
  modules.forEach(m=>group(m,cards.filter(c=>c.dataset.moduleId===m.id)));const other=cards.filter(c=>!modules.some(m=>m.id===c.dataset.moduleId));if(other.length)group(null,other);
  action(box,'Карта исследователя',()=>{box.hidden=true;$('#map-title').scrollIntoView();});action(box,'Мой маршрут',()=>overview('Мой маршрут'));if(config.show_diary!==false)action(box,'Дневник открытий',()=>navigate(()=>diary()));action(box,'Шкатулка ключей',()=>$('.chest-card [data-open]').click());box.focus();box.scrollIntoView({block:'start',behavior:'instant'});active('classroom');
 }
 function active(name){all('.voyage-nav a,.voyage-nav button').forEach(b=>b.setAttribute('aria-current',String((name==='classroom'&&b.hasAttribute('data-classroom'))||b.dataset.open===name)));}
 function navigate(fn){return Promise.resolve().then(fn).catch(error=>{const status=$('#atlas-diary-space [data-diary-status]');if(status){status.textContent='Переход не выполнен: '+error.message+' Текст остаётся в дневнике.';status.dataset.error='true';}document.querySelector('[data-atlas-message]').textContent=error.message;});}
 async function hideDiary(){const box=$('#atlas-diary-space');if(box.hidden)return;const ticket=++diaryTurn;await diaryController?.suspend();if(ticket!==diaryTurn)throw Error('Раздел изменился. Повторите переход.');box.hidden=true;}
 function diaryOrigin(lessonId){const mode=document.body.dataset.sscMode||'classic',selected=document.body.classList.contains('ssc-atlas-lesson-open')?cards.find(c=>c.classList.contains('atlas-selected')):null,id=lessonId||selected?.dataset.lessonId;const kind=id?'lesson':mode==='atlas'&&$('#atlas-classroom-space').hidden?'map':'program';return {mode,kind,lessonId:id,hash:location.hash,x:scrollX,y:scrollY,trigger:document.activeElement};}
 async function returnFromDiary(origin){
  await hideDiary();await mode(origin.mode,{followHash:false});
  let target;if(origin.kind==='lesson'){target=cards.find(c=>c.dataset.lessonId===origin.lessonId);if(origin.mode==='atlas')await lesson(origin.lessonId);}
  else if(origin.mode==='atlas'&&origin.kind==='program'){await classroom();target=$('#atlas-classroom-space');}
  else if(origin.mode==='atlas'){document.body.classList.remove('ssc-atlas-lesson-open');$('#atlas-classroom-space').hidden=true;active('');target=$('#map-title');}
  else target=document.querySelector('#program');
  history.replaceState(history.state,'',location.pathname+location.search+origin.hash);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const focus=origin.trigger?.isConnected&&origin.trigger.getClientRects().length?origin.trigger:target;if(focus){if(!focus.hasAttribute('tabindex')&&!focus.matches('button,a,input,textarea,select'))focus.setAttribute('tabindex','-1');focus.focus({preventScroll:true});}
  scrollTo({left:origin.x,top:origin.y,behavior:'instant'});
 }
 let diaryController,diaryTurn=0;async function diary(origin=diaryOrigin()){
  if(config.show_diary===false)return;const box=$('#atlas-diary-space');if(!box.hidden&&diaryController)return diaryController;
  if(document.body.dataset.sscMode!=='atlas')await mode('atlas',{followHash:false});const ticket=++diaryTurn;
  $('#atlas-classroom-space').hidden=true;box.hidden=false;document.body.classList.remove('ssc-atlas-lesson-open');
  if(!diaryController){box.textContent='Загружаем дневник…';try{await SscOptionalViews.loadDiary();if(ticket!==diaryTurn||document.body.dataset.sscMode!=='atlas'||box.hidden)return;}catch(error){box.textContent=error.message+' Нажмите «Дневник» для повторной попытки.';return;}
   if(!diaryController)diaryController=SscAtlasDiary.mount(box,{course:root.dataset.progressCourse,cohort:root.dataset.progressCohort},cards.map(c=>({id:c.dataset.lessonId,module:c.dataset.moduleId,title:c.querySelector('h3').textContent,available:c.dataset.lessonAvailable==='true'})));}
  diaryController.setReturnContext({kind:origin.kind,onReturn:()=>returnFromDiary(origin)});diaryController.resume();active('journal');box.focus();box.scrollIntoView({block:'start',behavior:'instant'});return diaryController;
 }
 function keyDetail(key,trigger){open(key.title,box=>{const art=el('div'),sprite=el('span');art.className='key-art';sprite.className='key-sprite large-key key-'+(state.keys.findIndex(k=>k.id===key.id)%6);sprite.style.backgroundImage='url("'+new URL('../../../assets/atlas/'+config.resources.keys,document.baseURI).href+'")';sprite.setAttribute('aria-hidden','true');art.append(sprite);box.append(art);box.append(el('p',key.earned?(key.rule.type==='module_complete'?'Все уроки зала пройдены. Поздравляем с получением ключа!':'Условия выполнены. Поздравляем с получением ключа!'):(key.rule.type==='module_complete'?'Чтобы получить ключ, завершите все уроки этого зала':'Чтобы получить ключ, завершите указанные в условии уроки')),el('p',key.ids.length?`Условие: ${key.done} из ${key.ids.length} настроенных уроков. Все должны быть открыты и отмечены пройденными.`:'Условия ещё не настроены. Ключ не выдаётся.'));action(box,'Открыть зал',()=>{close();hall(key.moduleId,trigger)});},trigger);}
 function master(trigger){open('Мастер-ключ',box=>{const art=el('div'),image=el('img');art.className='key-art master-art';image.src=$('#master-space img').dataset.src||$('#master-space img').getAttribute('src');image.alt='Золотой мастер-ключ';art.append(image);box.append(art);box.append(el('p',state.master?'✓ Мастер-ключ получен':'Мастер-ключ пока не получен'),el('p',config.route.master_enabled&&state.required.length?`Пройдено обязательных уроков: ${state.done} из ${state.required.length}. Будущие обязательные уроки тоже должны быть пройдены после открытия.`:'Обязательные уроки и выдача мастер-ключа пока не настроены.'),el('p','Самостоятельные отметки, не подтверждение квалификации.'));},trigger);}
 function resume(){const next=snapshot.lessons.find(l=>l.available&&!snapshot.completed.has(l.id));next?lesson(next.id):overview('Мой маршрут');}
 async function mode(value,{followHash=true}={}){const brand=document.querySelector('.topbar-title');if(brand){brand.dataset.originalBrand??=brand.textContent;if(brand.dataset.originalBrand==='SSC · Учебная платформа')brand.textContent=value==='atlas'?'SSC · Атлас открытий':brand.dataset.originalBrand;}if(value==='classic')await hideDiary();const w=document.querySelector('[data-course-welcome]');if(w){if(value==='classic'){w.hidden=false;root.querySelector('.portal-module-index, .lesson-progress-summary').before(w);}else if(!$('#atlas-classroom-space').contains(w))w.hidden=true;}document.body.dataset.sscMode=value;document.querySelectorAll('[data-ssc-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sscMode===value)));view.hidden=value!=='atlas';
  if(value==='classic'){document.body.classList.remove('ssc-atlas-lesson-open');cards.forEach(c=>c.classList.remove('atlas-selected'));}
  if(value==='atlas'){render(controller.snapshot());if(!$('#atlas-classroom-space').hidden)await classroom();}
  if(value==='atlas'&&followHash&&$('#atlas-diary-space').hidden&&location.hash.startsWith('#lesson-'))await lesson(decodeURIComponent(location.hash.slice(8)));
 }
 function render(next){snapshot=next;state=SscAtlasRules.derive(config,snapshot);const markerBox=$('#module-markers');markerBox.replaceChildren();
  // Stable module IDs, optional configured slots; unmapped/new modules remain in accessible chapters.
  modules.forEach((m,i)=>{const mapping=config.route.halls.find(h=>h.module_id===m.id),p=moduleProgress(m.id),b=el('button');b.type='button';b.className='module-marker hall-'+(mapping?.slot||i%6+1);b.dataset.module=m.id;b.dataset.state=p.finished?'complete':snapshot.lessons.some(l=>l.moduleId===m.id&&l.available)?'available':'locked';b.dataset.slot=String(mapping?.slot||i%6+1);b.dataset.chapter=String(Math.floor(i/6));b.setAttribute('aria-label',`${m.title}: ${p.done} из ${p.total}`);b.append(el('span',`Зал ${i+1}`),el('strong',m.title),el('small',b.dataset.state==='locked'?'Пока закрыто':`${p.done}/${p.total} · ${p.percent}%`));b.children[0].className='marker-kicker';b.children[1].className='marker-title';b.children[2].className='marker-state';const badge=el('span',String(i+1));if(b.dataset.state==='locked'||p.finished){const status=el('span',p.finished?'✓':'🔒');status.className='marker-lock';status.setAttribute('aria-hidden','true');b.append(status);}badge.className='marker-badge';badge.setAttribute('aria-hidden','true');b.append(badge);b.addEventListener('click',()=>hall(m.id,b));markerBox.append(b);});
  const done=snapshot.completed.size,total=snapshot.lessons.length,percent=total?Math.round(done/total*100):0;
  $('#overall-label').textContent=`Мой прогресс: ${done} из ${total} уроков`;$('#overall-percent').textContent=percent+'%';$('#book-percent').textContent=percent+'%';$('#book-count').textContent=`${done} из ${total} открытий`;
  for(const p of all('progress')){p.max=Math.max(1,total);p.value=done;}
  const earned=state.keys.filter(k=>k.earned).length;$('#collection-count').textContent=`Собрано ${earned} из ${state.keys.length} ключей`;const grid=$('#key-grid');grid.replaceChildren();
  state.keys.forEach((k,i)=>{const b=action(grid,'',()=>keyDetail(k,b),'key-button'+(k.earned?' earned':''));b.setAttribute('aria-label',k.title+(k.earned?' — получен':' — не получен'));const sprite=el('span');sprite.className='key-sprite key-'+i%6;sprite.setAttribute('aria-hidden','true');b.append(sprite,el('strong',k.title),el('span',k.earned?'✓ Получен':'Не получен'));});
  $('#master-space').dataset.earned=String(state.master);$('#master-space p').textContent=state.master?'Мастер-ключ получен':!config.route.master_enabled||!state.required.length?'Условия мастер-ключа ещё не настроены.':`Обязательные уроки: ${state.done} из ${state.required.length}.`;$('#master-mini-status').textContent=state.master?'Получен':'Условия получения';
  const message=document.querySelector('[data-atlas-message]');message.textContent=snapshot.busy?'Прогресс обрабатывается…':snapshot.error?'Не удалось сохранить прогресс. Изменение не подтверждено.':'';
 }
 all('[data-open]').forEach(b=>b.addEventListener('click',()=>navigate(()=>b.dataset.open==='chest'?open('Шкатулка ключей',box=>{box.append(el('p',`Собрано ${state.keys.filter(k=>k.earned).length} из ${state.keys.length} ключей`));action(box,'Перейти в коллекцию',()=>{close();$('#collection-title').focus();$('#collection').scrollIntoView()});},b):b.dataset.open==='journal'?diary():overview('Мой маршрут',b))));
 all('.voyage-nav a').forEach(b=>b.addEventListener('click',event=>{event.preventDefault();navigate(async()=>{await hideDiary();$('#atlas-classroom-space').hidden=true;active('');b.setAttribute('aria-current','true');const hash=new URL(b.href,location.href).hash;const target=hash&&document.getElementById(decodeURIComponent(hash.slice(1)));if(target){history.replaceState(history.state,'',hash);target.scrollIntoView({block:'start',behavior:'instant'});}});}));
 all('.voyage-nav [data-open]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.open!=='journal')active(b.dataset.open);}));
 all('[data-classroom]').forEach(b=>{b.hidden=config.show_classroom===false;b.addEventListener('click',()=>navigate(classroom))});all('[data-open=journal]').forEach(b=>b.hidden=config.show_diary===false);if(config.show_diary===false)$('#journal').hidden=true;if(config.show_classroom===false)$('#classroom').hidden=true;
 cards.filter(c=>c.dataset.lessonAvailable==='true').forEach(c=>{if(config.show_diary!==false){const practice=c.querySelector('.portal-assignment');if(practice){const hint=el('small','Мысли, идеи и результаты практики можно записывать в Дневнике открытий.');hint.className='atlas-practice-hint';practice.append(hint);}}if(config.show_diary!==false)action(c,'Записать в Дневник открытий',()=>diary(diaryOrigin(c.dataset.lessonId)).then(d=>d?.newEntry(c.dataset.lessonId)),'secondary-button diary-lesson-action')});
 all('[data-master]').forEach(b=>b.addEventListener('click',()=>master(b)));all('[data-resume]').forEach(b=>b.addEventListener('click',resume));
 all('.mode-choice').forEach(b=>{const classic=b.dataset.mode==='classic';b.addEventListener('click',()=>navigate(()=>mode(classic?'classic':'atlas')));b.hidden=!config.allow_switch&&classic;});
 const switcher=document.querySelector('.atlas-mode-switch');switcher.hidden=!config.allow_switch;
 dialog.querySelector('[data-atlas-close]').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
 root.addEventListener('ssc:progress',e=>{snapshot=e.detail;if(document.body.dataset.sscMode!=='atlas')return;render(snapshot);if(!$('#atlas-classroom-space').hidden)navigate(classroom);});
 const back=el('button','← К карте Атласа');back.type='button';back.className='secondary-button atlas-back';back.addEventListener('click',()=>{document.body.classList.remove('ssc-atlas-lesson-open');view.focus();view.scrollIntoView();location.hash='atlas-view'});root.querySelector('.portal-lessons').before(back);
 window.addEventListener('hashchange',()=>{if(document.body.dataset.sscMode==='atlas'&&location.hash.startsWith('#lesson-'))navigate(()=>lesson(decodeURIComponent(location.hash.slice(8))))});
 const fallback=()=>navigate(async()=>{await mode('classic');document.body.classList.remove('ssc-atlas-ready');document.querySelector('[data-atlas-message]').textContent='Не удалось загрузить оформление Атласа. Классический режим доступен.';});
 all('img').forEach(i=>i.addEventListener('error',fallback));
 
 // Inert template images are hydrated only when their section is used or visible.
 function imageSize(image){if(!image.dataset.srcset||!image.getClientRects().length)return;const r=image.getBoundingClientRect(),ratio=Number(image.getAttribute('width'))/Number(image.getAttribute('height'));image.sizes=Math.ceil(Math.max(r.width,r.height*(ratio||1)))+'px';}
 const imageObserver=new ResizeObserver(entries=>{if(document.body.dataset.sscMode==='atlas')entries.forEach(e=>imageSize(e.target));});
 function hydrate(image){if(image.dataset.src&&!image.getAttribute('src')){imageSize(image);if(image.dataset.srcset)image.srcset=image.dataset.srcset;image.src=image.dataset.src;imageObserver.observe(image);}}
 const keyURL=new URL('../../../assets/atlas/'+(config.resource_variants?.keys||config.resources.keys),document.baseURI);
 function keys(){view.style.setProperty('--atlas-key-art','url("'+keyURL.href+'")');}
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;const target=entry.target;if(target.tagName==='IMG')hydrate(target);else keys();observer.unobserve(target);}));
 all('img[data-src]').forEach(image=>observer.observe(image));observer.observe($('#key-grid'));
 all('.book-screen img').forEach(hydrate);
 view.addEventListener('click',event=>{if(event.target.closest('.key-button'))keys();});
 render(controller.snapshot());document.body.classList.add('ssc-atlas-ready');
 view.sscAtlas={mode};return view.sscAtlas;
}};
