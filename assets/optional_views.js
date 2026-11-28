'use strict';
// Small optional-view bootstrap. Course content and progress belong to Core.
(() => {
  const resources = {...document.currentScript.dataset};
  const pending = new Map();
  function resource(kind, name, attributes = {}) {
    const key = kind + ':' + name;
    if (pending.has(key)) return pending.get(key);
    const promise = new Promise((resolve, reject) => {
      const source = resources[name];
      if (!source) { reject(Error('Не найден дополнительный компонент.')); return; }
      const url = new URL(source, document.baseURI);
      if (url.origin !== location.origin) { reject(Error('Внешняя загрузка запрещена.')); return; }
      const element = document.createElement(kind === 'style' ? 'link' : 'script');
      if (kind === 'style') { element.rel = 'stylesheet'; element.href = url.href; }
      else { element.src = url.href; Object.assign(element.dataset, attributes); }
      element.onload = () => {
        const expected = {viewRulesSrc: 'SscAtlasRules', viewJsSrc: 'SscAtlas', diaryStoreSrc: 'SscAtlasDiaryStore', diaryUiSrc: 'SscAtlasDiary'}[name];
        if (expected && !window[expected]) { element.remove(); reject(Error('Компонент загружен не полностью. Повторите попытку.')); }
        else resolve(element);
      };
      element.onerror = () => { element.remove(); reject(Error('Не удалось загрузить компонент. Попробуйте ещё раз.')); };
      // Preserve the approved cascade: diary rules originally preceded shared Atlas workspace rules.
      const atlasStyle=document.querySelector('link[href*="/atlas."]');
      if(name==='diaryCssSrc'&&atlasStyle)atlasStyle.before(element);else document.head.append(element);
    }).catch(error => { pending.delete(key); throw error; });
    pending.set(key, promise);
    return promise;
  }
  let diaryPending;
  async function loadDiary() {
    if (window.SscAtlasDiary && window.SscAtlasDiaryStore) return;
    if (!diaryPending) diaryPending = (async () => {
      await Promise.all([resource('style', 'diaryCssSrc'),resource('script', 'diaryStoreSrc')]);
      await resource('script', 'diaryUiSrc', {
        diaryWordSrc: resources.diaryWordSrc,
        diaryLegacySrc: resources.diaryLegacySrc
      });
      if (!window.SscAtlasDiary || !window.SscAtlasDiaryStore) throw Error('Дневник не загрузился.');
    })().catch(error => { diaryPending = null; throw error; });
    return diaryPending;
  }
  const templates = new Map();
  function registerTemplate(payload) {
    if (!payload || typeof payload.id !== 'string' || typeof payload.html !== 'string') throw Error('Повреждён шаблон курса.');
    templates.set(payload.id, payload.html);
  }
  window.SscOptionalViews = {loadDiary, registerTemplate};
  function init() {
    const template = document.querySelector('template[data-optional-view]');
    const switcher = document.querySelector('.atlas-mode-switch');
    const root = document.querySelector('[data-lesson-progress]');
    if (!template || !switcher || !root?.sscProgress) return;
    const config = {default_mode: template.dataset.viewDefaultMode, allow_switch: template.dataset.viewAllowSwitch === 'true'};
    resources.viewTemplateSrc = template.dataset.viewTemplateSrc;
    const status = switcher.querySelector('[data-atlas-message]');
    let instance, starting, retry, turn = 0;
    switcher.hidden = !config.allow_switch;
    document.body.dataset.sscMode = 'classic';
    async function choose(mode) {
      const ticket = ++turn;
      if (mode === 'classic') {
        try { await instance?.mode('classic'); }
        catch(error) { status.textContent = 'Переход отменён: '+error.message; return; }
        if(ticket!==turn)return;
        document.body.dataset.sscMode = 'classic';
        switcher.querySelectorAll('[data-ssc-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sscMode === mode)));
        status.textContent = '';
        return;
      }
      status.textContent = 'Загружаем Атлас…';
      try {
        if (!instance) {
          if (!starting) starting = (async () => {
            await Promise.all([resource('style', 'viewCssSrc'), resource('script', 'viewRulesSrc'), resource('script', 'viewTemplateSrc')]);
            await resource('script', 'viewJsSrc');
            if (!window.SscAtlas?.mount || !templates.has(template.dataset.viewKey)) throw Error('Атлас не загрузился.');
          })().catch(error => { starting = null; throw error; });
          await starting;
          if (ticket !== turn) return;
          if (!instance) {
            template.innerHTML = templates.get(template.dataset.viewKey);
            const fragment = template.content.cloneNode(true);
            template.after(fragment);
            try { instance = window.SscAtlas.mount(); }
            catch (error) { document.querySelector('[data-atlas-config]')?.remove(); throw error; }
          }
        }
        if (ticket !== turn) return;
        await instance.mode('atlas');
        if(ticket!==turn)return;
        switcher.hidden = !config.allow_switch;
        if (retry) retry.hidden = true;
        status.textContent = '';
      } catch (error) {
        if (ticket !== turn) return;
        try { await instance?.mode('classic'); }
        catch(saveError) { status.textContent='Переход отменён: '+saveError.message; return; }
        document.body.dataset.sscMode = 'classic';
        status.textContent = error.message + ' Классический режим доступен.';
        if (!config.allow_switch) {
          switcher.hidden = false;
          switcher.querySelectorAll('[data-ssc-mode]').forEach(button => { button.hidden = true; });
          if (!retry) {
            retry = document.createElement('button'); retry.type = 'button'; retry.className = 'secondary-button';
            retry.textContent = 'Повторить загрузку Атласа'; retry.addEventListener('click', () => choose('atlas')); switcher.append(retry);
          }
          retry.hidden = false;
        }
      }
    }
    switcher.querySelectorAll('[data-ssc-mode]').forEach(b => b.addEventListener('click', () => choose(b.dataset.sscMode)));
    if (config.default_mode === 'atlas') choose('atlas');
  }
  document.addEventListener('DOMContentLoaded', () => queueMicrotask(init));
})();
