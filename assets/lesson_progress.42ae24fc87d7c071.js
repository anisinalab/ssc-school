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
    const scope = {courseId: root.dataset.progressCourse, cohortId: root.dataset.progressCohort};
    const cards = [...root.querySelectorAll('[data-lesson-id]')];
    const available = new Set(cards.filter(c => c.dataset.lessonAvailable === 'true').map(c => c.dataset.lessonId));
    const lessons = cards.map(card => ({id: card.dataset.lessonId, moduleId: card.dataset.moduleId,
      available: card.dataset.lessonAvailable === 'true'}));
    const modules = [...root.querySelectorAll('[data-module-progress]')];
    const count = root.querySelector('[data-progress-count]');
    const meter = root.querySelector('[data-progress-meter]');
    const error = root.querySelector('[data-progress-error]');
    let completed = new Set(), busy = true;
    const clean = ids => new Set(ids.filter(id => available.has(id)));
    function render() {
      cards.forEach(card => {
        const id = card.dataset.lessonId, done = available.has(id) && completed.has(id);
        const checkbox = card.querySelector('[data-lesson-complete]');
        checkbox.checked = done;
        checkbox.disabled = busy || !available.has(id);
        card.classList.toggle('is-completed', done);
        card.querySelector('[data-completion-status]').textContent = done ? '✓ Пройдено' :
          available.has(id) ? 'Доступен' : 'Откроется по расписанию';
      });
      const percent = cards.length ? Math.round(completed.size / cards.length * 100) : 0;
      count.textContent = `${completed.size} из ${cards.length} · ${percent}%`;
      meter.max = Math.max(1, cards.length);
      meter.value = completed.size;
      modules.forEach(card => {
        const progress = moduleProgress(lessons, completed, card.dataset.moduleProgress);
        card.classList.toggle('is-module-completed', progress.finished);
        card.querySelector('[data-module-status]').textContent = {
          empty: 'Пока нет уроков', planned: 'Откроется по расписанию',
          'in-progress': 'В процессе', completed: '✓ Модуль пройден'
        }[progress.state];
        card.querySelector('[data-module-count]').textContent = ` · ${progress.done} из ${progress.total} · ${progress.percent}%`;
      });
    }
    function storageError() {
      error.textContent = 'Не удалось сохранить прогресс в браузере. Отметки могут исчезнуть после перезагрузки. Проверьте разрешение на хранение данных сайта.';
      error.hidden = false;
    }
    try { completed = clean(await store.load(scope)); } catch { storageError(); }
    busy = false; render();
    root.addEventListener('change', async event => {
      const checkbox = event.target;
      if (!checkbox.matches('[data-lesson-complete]')) return;
      const card = checkbox.closest('[data-lesson-id]'), id = card?.dataset.lessonId;
      // Enforce release state even for a synthetic change on a disabled input.
      if (busy || !available.has(id)) { render(); return; }
      const checked = checkbox.checked;
      if (checked) completed.add(id); else completed.delete(id);
      busy = true; render();
      try {
        completed = clean(await store.setCompleted(scope, id, checked));
        error.hidden = true;
      } catch { storageError(); }
      busy = false; render();
    });
  }
  globalThis.SscLessonProgress = {mount, moduleProgress};
  if (typeof module !== 'undefined') module.exports = globalThis.SscLessonProgress;
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-lesson-progress]').forEach(root => {
    // Supply SscProgressStore before this script to substitute server storage later.
    mount(root, globalThis.SscProgressStore || SscProgressStorage.createLocal());
  });
})();
