'use strict';
// Intl uses the browser's IANA rules, including historical offsets and DST.
// No network requests or pupil identifiers are needed.
globalThis.SscTime = (() => {
  function valid(zone) {try {new Intl.DateTimeFormat('en',{timeZone:zone});return !!zone;} catch (_) {return false;}}
  function wall(value, zone) {
    if (!value) return '';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  function candidates(text, zone) {
    if (!valid(zone) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(text)) return [];
    const guess=Date.parse(text+'Z'); if(!Number.isFinite(guess)) return [];
    const offsets=new Set();
    // Sample both sides of a transition; verify each candidate by round-trip.
    for(let hours=-48;hours<=48;hours+=6) {
      const probe=guess+hours*3600000;
      offsets.add(Date.parse(wall(probe,zone)+'Z')-probe);
    }
    return [...offsets].map(offset=>guess-offset).filter(t=>wall(t,zone)===text)
      .sort((a,b)=>a-b).map(t=>new Date(t).toISOString());
  }
  function zones() {return [...new Set(['UTC',Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...(Intl.supportedValuesOf?.('timeZone') || ['Europe/Moscow','Europe/Berlin','Asia/Almaty','Asia/Tokyo','America/New_York'])])].sort();}
  function label(zone, instant=new Date()) {
    const city=({'Europe/Berlin':'Берлин','Europe/Moscow':'Москва','Asia/Tokyo':'Токио','America/Los_Angeles':'Лос-Анджелес'})[zone] || zone.split('/').pop().replaceAll('_',' ');
    const abbreviation=new Intl.DateTimeFormat('en-GB',{timeZone:zone,timeZoneName:'short'}).formatToParts(instant).find(p=>p.type==='timeZoneName').value;
    return `${city} (${abbreviation}) · ${zone}`;
  }
  return {valid,wall,candidates,zones,label};
})();
