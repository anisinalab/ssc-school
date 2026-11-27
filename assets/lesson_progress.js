"use strict";
// UI depends only on the async store contract, never on browser storage APIs.
(() => {
  // Derived only from lesson marks and the current programme; no module records.
  function moduleProgress(lessons, completed, moduleId) {
    const members = lessons.filter(lesson => lesson.moduleId === moduleId);
    const total = members.length;
    const done = members.filter(lesson => lesson.available && completed.has(lesson.id)).length;
    const finished = total > 0 && done === total;
    const percent = finished ? 100 : total ? Math.min(99, Math.round(done / total * 100)) : 0;
    const state = !total ? 'empty' : finished ? 'completed' :
      members.some(lesson => lesson.available) ? 'in-progress' : 'planned';
    return {total, done, finished, percent, state};
  }
  async function mount(root, store) {
    if (root.sscProgress) return root.sscProgress;
    const scope={courseId:root.dataset.progressCourse,cohortId:root.dataset.progressCohort};
    const cards=[...root.querySelectorAll('[data-lesson-id]')],lessons=cards.map(c=>({id:c.dataset.lessonId,moduleId:c.dataset.moduleId,available:c.dataset.lessonAvailable==='true'}));
    const available=new Set(lessons.filter(l=>l.available).map(l=>l.id)),modules=[...root.querySelectorAll('[data-module-progress]')];
    let completed=new Set(),busy=true,error=false;const clean=ids=>new Set(ids.filter(id=>available.has(id)));
    const snapshot=()=>({scope:{...scope},lessons:lessons.map(l=>({...l})),completed:new Set(completed),busy,error});
    function render(){
      cards.forEach(card=>{const done=available.has(card.dataset.lessonId)&&completed.has(card.dataset.lessonId),checkbox=card.querySelector('[data-lesson-complete]');checkbox.checked=done;checkbox.disabled=busy||!available.has(card.dataset.lessonId);card.classList.toggle('is-completed',done);card.querySelector('[data-completion-status]').textContent=done?'✓ Пройдено':available.has(card.dataset.lessonId)?'Доступен':'Откроется по расписанию';});
      const count=root.querySelector('[data-progress-count]'),meter=root.querySelector('[data-progress-meter]');count.textContent=completed.size+' из '+cards.length+' · '+(cards.length?Math.round(completed.size/cards.length*100):0)+'%';meter.max=Math.max(1,cards.length);meter.value=completed.size;
      modules.forEach(card=>{const p=moduleProgress(lessons,completed,card.dataset.moduleProgress);card.classList.toggle('is-module-completed',p.finished);card.querySelector('[data-module-status]').textContent={empty:'Пока нет уроков',planned:'Откроется по расписанию','in-progress':'В процессе',completed:'✓ Модуль пройден'}[p.state];card.querySelector('[data-module-count]').textContent=' · '+p.done+' из '+p.total+' · '+p.percent+'%';});
      const message=root.querySelector('[data-progress-error]');message.hidden=!error;if(error)message.textContent='Не удалось прочитать или сохранить прогресс в браузере. Изменение не подтверждено. Проверьте разрешение на хранение данных сайта.';
      root.dispatchEvent(new CustomEvent('ssc:progress',{detail:snapshot()}));
    }
    async function refresh(){if(busy)return;busy=true;render();try{completed=clean(await store.load(scope));error=false}catch{error=true}busy=false;render();}
    async function setCompleted(id,value){if(busy||!available.has(id)){render();return false}busy=true;render();let saved=false;
      try{completed=clean(await store.setCompleted(scope,id,value));error=false;saved=true}catch{error=true}busy=false;render();return saved;
    }
    root.sscProgress={snapshot,setCompleted,refresh};
    try{completed=clean(await store.load(scope))}catch{error=true}busy=false;render();
    root.addEventListener('change',event=>{if(!event.target.matches('[data-lesson-complete]'))return;const card=event.target.closest('[data-lesson-id]');setCompleted(card?.dataset.lessonId,event.target.checked)});
    window.addEventListener('storage',event=>{if(event.key===SscProgressStorage.key(scope)||event.key===null)refresh()});window.addEventListener('focus',refresh);
    return root.sscProgress;
  }
  globalThis.SscLessonProgress = {mount, moduleProgress};
  if (typeof module !== 'undefined') module.exports = globalThis.SscLessonProgress;
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-lesson-progress]').forEach(root => {
    // Supply SscProgressStore before this script to substitute server storage later.
    mount(root, globalThis.SscProgressStore || SscProgressStorage.createLocal());
  });
})();
