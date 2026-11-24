"use strict";
// Storage adapter only. No pupil identifiers, content, URLs, cookies or network calls.
// Async contract for a future authenticated store:
// load({courseId, cohortId}) -> lesson ID[]
// setCompleted(scope, lessonId, completed) -> updated lesson ID[]
(() => {
  function key(scope) {
    if (!scope || !scope.courseId || !scope.cohortId) throw new TypeError('Progress scope required');
    return 'ssc:lesson-progress:v1:' + JSON.stringify([scope.courseId, scope.cohortId]);
  }
  function read(storage, scope) {
    const raw = storage.getItem(key(scope));
    if (!raw) return [];
    let record;
    try { record = JSON.parse(raw); } catch { return []; }
    if (record?.version !== 1 || !Array.isArray(record.completed)) return [];
    return [...new Set(record.completed.filter(id => typeof id === 'string' && id.length > 0))];
  }
  function createLocal(provider = () => globalThis.localStorage) {
    return {
      async load(scope) { return read(provider(), scope); },
      async setCompleted(scope, lessonId, completed) {
        if (typeof lessonId !== 'string' || !lessonId) throw new TypeError('Lesson ID required');
        const storage = provider();
        // Re-read so sequential edits from another tab are retained.
        const ids = new Set(read(storage, scope));
        if (completed) ids.add(lessonId); else ids.delete(lessonId);
        storage.setItem(key(scope), JSON.stringify({version: 1, completed: [...ids]}));
        return [...ids];
      }
    };
  }
  globalThis.SscProgressStorage = {createLocal, key};
  if (typeof module !== 'undefined') module.exports = globalThis.SscProgressStorage;
})();
