"use strict";
// Formatting only: no identifiers, storage, cookies, analytics or network calls.
(() => {
  const autoZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let zone=autoZone;
  const selectors=[];
  function formatTimes() {
    const formatter=new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeStyle:'short',timeZone:zone});
    document.querySelectorAll('time[datetime]').forEach(element=>{
      const value=new Date(element.dateTime);
      if(!Number.isNaN(value.getTime())) {
        element.textContent=formatter.format(value);
        // The zone's abbreviation is computed for the event, not today's offset.
        element.title=SscTime.label(zone,value);
      }
    });
    document.querySelectorAll('[data-timezone-label]').forEach(label=>{
      label.textContent=`Ваше время: ${SscTime.label(zone)}. У каждой даты указан её часовой пояс во всплывающей подсказке.`;
    });
    selectors.forEach(select=>{select.value=zone;});
  }
  const label=document.querySelector('#timezone-label');
  if(label) {
    const wrapper=document.createElement('label');wrapper.className='timezone-control';
    wrapper.append(document.createTextNode('Часовой пояс для просмотра '));
    const select=document.createElement('select');select.setAttribute('aria-label','Часовой пояс ученика');
    const automatic=document.createElement('option');automatic.value=autoZone;automatic.textContent=`Автоматически · ${autoZone}`;select.append(automatic);
    SscTime.zones().filter(z=>z!==autoZone).forEach(z=>{const option=document.createElement('option');option.value=z;option.textContent=z.replaceAll('_',' ');select.append(option);});
    select.addEventListener('change',()=>{zone=select.value;formatTimes();});selectors.push(select);wrapper.append(select);label.after(wrapper);
  }
  formatTimes();
  document.querySelectorAll('[data-choose-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      document.body.dataset.theme = button.dataset.chooseTheme;
      document.querySelectorAll('[data-choose-theme]').forEach((choice) => {
        const selected = choice === button;
        choice.classList.toggle('selected', selected);
        choice.setAttribute('aria-pressed', String(selected));
      });
    });
  });
  document.querySelectorAll('a[href="#data"]').forEach((link) => {
    link.addEventListener('click', () => { document.getElementById('data').open = true; });
  });
})();
